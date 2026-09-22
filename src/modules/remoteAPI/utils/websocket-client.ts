// WebSocket client for the Amarisoft remote API.
//
// Protocol (lteenb.html 2026-09-11, 10.1-10.3; same for MME/IMS/UE/MBMSGW/
// license server):
//
//   Startup, no auth:  server -> {message:"ready", type, name, version, product?, time?, utc?}
//   Startup, auth:     server -> {message:"authenticate", type, name, challenge}
//                      client -> {message:"authenticate", res: hex(HMAC-SHA256(key="type:password:name", data=challenge))}
//                      server -> {message:"authenticate", ready:true}
//                              | {message:"authenticate", error, challenge}   (new challenge)
//   Request:           {message, message_id?, start_time?, absolute_time?, standalone?, loop_count?, loop_delay?, group_id?}
//   Notification:      same message_id, `notification` set (e.g. trx_iq_dump start, ext_app progress). NOT the response.
//   Response:          same message_id; `error` string on failure; `loop_index` for looped requests.
//   Event:             {message:"<event>"} without our message_id (after `register`).
//   Server error:      {message:"error", error} outside any request (e.g. "Too many connections").
//   Signal events:     binary frames: u32 json_len, json, u32 data_len, ... (lteenb 10.8).
//
// The server rejects the WebSocket handshake without an Origin header. A
// browser always sends one; Node clients (tests) must set it.

import { EventEmitter } from 'events';
import type { RemoteAPIConfig, RemoteAPIMessage } from '../types';

/** Fallback when a server sends neither `ready` nor `authenticate` (not seen on
 *  documented releases; kept so an odd build still becomes usable). */
const NO_BANNER_GRACE_MS = 3000;

/** Seconds the long-poll messages may legitimately hold a response beyond their own timeout. */
const LONG_POLL_MARGIN_S = 30;

export interface ServerInfo {
  type?: string;
  name?: string;
  version?: string;
  product?: string;
  time?: number;
  utc?: number;
  /** How the session became usable. */
  via: 'ready' | 'authenticate' | 'grace';
}

export interface SendOptions {
  /** Override the per-message timeout (seconds). */
  timeoutSec?: number;
  /** Called for `notification` frames and intermediate loop responses. */
  onProgress?: (msg: any) => void;
}

/** Error response from the server; the full response is kept for display. */
export class RemoteAPIError extends Error {
  response: any;
  constructor(message: string, response: any) {
    super(message);
    this.name = 'RemoteAPIError';
    this.response = response;
  }
}

interface Pending {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timer: ReturnType<typeof setTimeout>;
  request: RemoteAPIMessage;
  onProgress?: (msg: any) => void;
}

/** Timeout to use for a request, allowing for documented long-running messages. */
export function timeoutForMessage(msg: RemoteAPIMessage, baseSec: number): number {
  let t = baseSec;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  switch (msg.message) {
    case 'log_get':
      t = Math.max(t, num(msg.timeout, 1) + LONG_POLL_MARGIN_S);
      break;
    case 'ue_get':
      if (msg.update === true) t = Math.max(t, num(msg.timeout, 5) + LONG_POLL_MARGIN_S);
      break;
    case 'trx_iq_dump':
      t = Math.max(t, num(msg.duration, 1000) / 1000 + 60);
      break;
    case 'ext_app':
      t = Math.max(t, num(msg.end_time, 0) + LONG_POLL_MARGIN_S);
      break;
  }
  if (msg.absolute_time !== true) t += Math.max(0, num(msg.start_time, 0));
  if (num(msg.loop_count, 0) > 0) t += num(msg.loop_count, 0) * num(msg.loop_delay, 1);
  return t;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private connected = false;
  private authState: 'pending' | 'authenticated' | 'failed' = 'pending';
  private pendingMessages = new Map<string, Pending>();
  /** Banner details from `ready` / `authenticate`, null until known. */
  serverInfo: ServerInfo | null = null;

  constructor(private config: RemoteAPIConfig) {
    super();
    this.config.timeout = this.config.timeout || 60; // Default 60s per-message
  }

  get isReady(): boolean {
    return this.connected && this.authState === 'authenticated';
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = this.config.ssl ? 'wss' : 'ws';
      const url = `${protocol}://${formatHost(this.config.server)}:${this.config.port}`;

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(`Cannot open ${url}`));
        return;
      }
      this.ws = ws;
      ws.binaryType = 'arraybuffer';

      let resolved = false;
      let graceTimer: ReturnType<typeof setTimeout> | undefined;
      const settle = (kind: 'ok' | 'error', err?: Error) => {
        if (resolved) return;
        resolved = true;
        if (graceTimer) clearTimeout(graceTimer);
        if (kind === 'ok') resolve();
        else reject(err);
      };
      const markReady = (info: ServerInfo) => {
        this.authState = 'authenticated';
        this.serverInfo = info;
        this.emit('ready', info);
        settle('ok');
      };

      ws.onopen = () => {
        this.connected = true;
        this.emit('connected');
        graceTimer = setTimeout(() => {
          if (this.authState === 'pending') markReady({ via: 'grace' });
        }, NO_BANNER_GRACE_MS);
      };

      ws.onclose = (ev: CloseEvent) => {
        this.connected = false;
        this.emit('disconnected', ev);
        this.cleanup();
        if (!resolved) {
          const detail = ev && (ev.code || ev.reason) ? ` (code ${ev.code}${ev.reason ? `: ${ev.reason}` : ''})` : '';
          settle('error', new Error(`Connection to ${url} closed before the server was ready${detail}`));
        }
      };

      ws.onerror = () => {
        const err = new Error(`WebSocket error on ${url}. Check the host/port, that the remote API (com_addr) is enabled, and that nothing blocks the connection.`);
        if (this.listenerCount('error') > 0) this.emit('error', err);
        if (!resolved) settle('error', err);
      };

      ws.onmessage = async (event: MessageEvent) => {
        if (typeof event.data !== 'string') {
          this.handleBinary(event.data);
          return;
        }
        let parsed: any;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          this.emitError(new Error('Received a frame that is not JSON'));
          return;
        }
        // A server may batch several responses into one array frame.
        const frames = Array.isArray(parsed) ? parsed : [parsed];
        for (const frame of frames) {
          if (!frame || typeof frame !== 'object') continue;

          if (frame.message === 'ready' && this.authState === 'pending') {
            markReady({ type: frame.type, name: frame.name, version: frame.version, product: frame.product, time: frame.time, utc: frame.utc, via: 'ready' });
            continue;
          }

          if (frame.message === 'authenticate' && this.authState !== 'authenticated') {
            if (graceTimer) clearTimeout(graceTimer);
            await this.handleAuthenticate(frame, markReady, settle);
            continue;
          }

          if (frame.message === 'error' && frame.message_id === undefined) {
            const err = new Error(`Server error: ${frame.error ?? 'unknown'}`);
            if (!resolved) {
              settle('error', err);
            } else {
              this.emit('server_error', frame);
            }
            continue;
          }

          this.handleMessage(frame);
        }
      };
    });
  }

  private async handleAuthenticate(
    frame: any,
    markReady: (info: ServerInfo) => void,
    settle: (kind: 'ok' | 'error', err?: Error) => void,
  ) {
    if (frame.ready === true) {
      const base = this.serverInfo ?? { via: 'authenticate' as const };
      markReady({ ...base, via: 'authenticate' });
      this.emit('authenticated');
      if (!this.serverInfo?.version) void this.learnVersion();
      return;
    }
    if (frame.error) {
      this.authState = 'failed';
      const hint = /unsecure/i.test(String(frame.error))
        ? ' The browser cannot compute HMAC-SHA256 outside a secure context (https or localhost), so it fell back to sending the password, which this server forbids. Serve SimTool over https/localhost or set com_auth.unsecure: true on the callbox.'
        : '';
      settle('error', new Error(`Authentication failed: ${frame.error}.${hint}`));
      this.ws?.close();
      return;
    }
    if (frame.challenge === undefined) return;
    // Remember the banner details carried by the challenge.
    this.serverInfo = { type: frame.type, name: frame.name, version: frame.version, product: frame.product, via: 'authenticate' };
    if (!this.config.password) {
      this.authState = 'failed';
      settle('error', new Error(`Remote API requires a password (type="${frame.type}", name="${frame.name}")`));
      this.ws?.close();
      return;
    }
    try {
      const key = `${frame.type ?? ''}:${this.config.password}:${frame.name ?? ''}`;
      const res = await computeAuthResponse(key, String(frame.challenge));
      this.ws?.send(JSON.stringify(res === null
        // No WebCrypto (insecure context): same fallback as the Amarisoft web GUI.
        // Only accepted when com_auth.unsecure is true on the server.
        ? { message: 'authenticate', password: key }
        : { message: 'authenticate', res }));
    } catch (err) {
      this.authState = 'failed';
      settle('error', err instanceof Error ? err : new Error('Failed to compute auth response'));
    }
  }

  /** After password auth there is no `ready` banner; config_get carries `version`. */
  private async learnVersion() {
    try {
      const cfg = await this.sendMessage({ message: 'config_get' }, { timeoutSec: 10 });
      if (cfg && typeof cfg.version === 'string') {
        this.serverInfo = { ...(this.serverInfo ?? { via: 'authenticate' }), version: cfg.version, type: this.serverInfo?.type ?? cfg.type, name: this.serverInfo?.name ?? cfg.name };
        this.emit('ready', this.serverInfo);
      }
    } catch { /* version stays unknown; validation then skips version gating */ }
  }

  private nextId(): string {
    return `simtool#${++this.messageId}`;
  }

  private track(message: RemoteAPIMessage, opts: SendOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = String(message.message_id);
      if (this.pendingMessages.has(id)) {
        reject(new Error(`message_id ${id} is already pending`));
        return;
      }
      const timeoutSec = opts.timeoutSec ?? timeoutForMessage(message, this.config.timeout!);
      const timer = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`No response to ${message.message} after ${Math.round(timeoutSec)} s`));
      }, timeoutSec * 1000);
      this.pendingMessages.set(id, { resolve, reject, timer, request: message, onProgress: opts.onProgress });
    });
  }

  private assertReady() {
    if (!this.ws || !this.connected) throw new Error('Not connected');
    if (this.authState !== 'authenticated') throw new Error('Not authenticated yet');
  }

  /**
   * Send one request and resolve with its response. Rejects with
   * RemoteAPIError when the response carries `error`. The caller's object is
   * not modified.
   */
  async sendMessage(message: RemoteAPIMessage, opts: SendOptions = {}): Promise<any> {
    this.assertReady();
    const msg: RemoteAPIMessage = { ...message };
    if (msg.message_id === undefined || msg.message_id === null || msg.message_id === '') msg.message_id = this.nextId();
    const p = this.track(msg, opts);
    this.ws!.send(JSON.stringify(msg));
    return p;
  }

  /**
   * Send several requests in ONE frame (a JSON array, lteenb 10.1). Resolves
   * with one settled result per request, in order.
   */
  async sendBatch(messages: RemoteAPIMessage[], opts: SendOptions = {}): Promise<Array<{ ok: true; response: any } | { ok: false; error: Error }>> {
    this.assertReady();
    const msgs = messages.map(m => ({ ...m, message_id: m.message_id ?? this.nextId() }));
    const promises = msgs.map(m => this.track(m, opts));
    this.ws!.send(JSON.stringify(msgs));
    const settled = await Promise.allSettled(promises);
    return settled.map(s => (s.status === 'fulfilled'
      ? { ok: true as const, response: s.value }
      : { ok: false as const, error: s.reason instanceof Error ? s.reason : new Error(String(s.reason)) }));
  }

  /**
   * Fire-and-forget send: no message_id, no response tracking. Replies (if
   * any) arrive as 'message' / '<name>' events.
   */
  sendRaw(message: RemoteAPIMessage): void {
    this.assertReady();
    this.ws!.send(JSON.stringify(message));
  }

  private handleMessage(message: any) {
    if (message.message_id !== undefined && message.message_id !== null) {
      const id = String(message.message_id);
      const pending = this.pendingMessages.get(id);
      if (pending) {
        // Notifications share the request's message_id but are not the response.
        if (message.notification !== undefined) {
          pending.onProgress?.(message);
          this.emit('notification', message);
          return;
        }
        // Looped requests answer once per iteration (loop_index).
        const loops = Number(pending.request.loop_count) || 0;
        if (loops > 0 && typeof message.loop_index === 'number' && message.loop_index < loops - 1 && !message.error) {
          pending.onProgress?.(message);
          this.emit('loop', message);
          return;
        }
        clearTimeout(pending.timer);
        this.pendingMessages.delete(id);
        if (message.error) {
          pending.reject(new RemoteAPIError(String(message.error), message));
        } else {
          pending.resolve(message);
        }
        return;
      }
    }

    this.emit('message', message);
    if (message.message) {
      this.emit(message.message, message);
    }
  }

  /** Signal events (lteenb 10.8): u32 LE json length, JSON header, u32 data length, data. */
  private handleBinary(data: unknown) {
    try {
      const buf = data instanceof ArrayBuffer ? data : null;
      if (!buf || buf.byteLength < 4) return;
      const view = new DataView(buf);
      const len = view.getUint32(0, true);
      const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, Math.min(len, buf.byteLength - 4))));
      this.emit('binary', { header, byteLength: buf.byteLength });
    } catch {
      this.emit('binary', { header: null, byteLength: (data as ArrayBuffer)?.byteLength ?? 0 });
    }
  }

  private emitError(err: Error) {
    if (this.listenerCount('error') > 0) this.emit('error', err);
  }

  private cleanup() {
    for (const [, pending] of this.pendingMessages) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingMessages.clear();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

function formatHost(host: string): string {
  // Bare IPv6 literals need brackets in a URL.
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

/**
 * res = hex(HMAC-SHA256(key, challenge)). Returns null when WebCrypto is not
 * available (browsers only expose crypto.subtle in secure contexts: https or
 * localhost), so the caller can use the plaintext fallback.
 */
async function computeAuthResponse(key: string, challenge: string): Promise<string | null> {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (!subtle) return null;
  const enc = new TextEncoder();
  const cryptoKey = await subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', cryptoKey, enc.encode(challenge));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

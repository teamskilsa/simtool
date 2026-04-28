// WebSocket client for Amarisoft Remote API.
//
// Protocol references:
//   https://tech-academy.amarisoft.com/RemoteAPI.html
//   https://tech-academy.amarisoft.com/ltemonitor.doc
//
// Authentication (when the callbox has `password` set in its remote API
// config):
//   1. Server sends:  { message: "authenticate", challenge, type, name }
//   2. Client sends:  { message: "authenticate", res }
//      where res = hex( HMAC-SHA256(
//        key  = `${type}:${password}:${name}`,
//        data = challenge,
//      ) )
//   3. Server replies: { message: "authenticate", ready: true }   on success
//                      { message: "authenticate", error, challenge } on failure
//
// If the callbox has no password set, the server does NOT send an
// authenticate message — the WebSocket simply opens and is immediately
// ready. We handle both shapes by deferring the connect() promise resolution
// until either we hit `ready: true` OR a short grace period elapses without
// any auth challenge arriving (which signals an auth-disabled deployment).

import { EventEmitter } from 'events';
import type { RemoteAPIConfig, RemoteAPIMessage } from '../types';

// How long to wait after the socket opens before assuming the callbox does
// not require auth at all. Amarisoft sends the challenge on the very first
// frame; 1500ms is generous for any reasonable network.
const NO_AUTH_GRACE_MS = 1500;

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private connected = false;
  private authState: 'pending' | 'authenticated' | 'failed' = 'pending';
  private pendingMessages = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(private config: RemoteAPIConfig) {
    super();
    this.config.timeout = this.config.timeout || 60; // Default 60s per-message
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = this.config.ssl ? 'wss' : 'ws';
      const url = `${protocol}://${this.config.server}:${this.config.port}`;

      this.ws = new WebSocket(url);

      // ── Connect resolution ───────────────────────────────────────────────
      // We don't resolve on `onopen` directly because Amarisoft may still
      // require a challenge/response before the channel is usable. Two
      // resolution paths:
      //   1. We see authenticate.ready=true → resolve.
      //   2. NO_AUTH_GRACE_MS elapses without any authenticate message →
      //      assume the server doesn't require auth, resolve.
      let resolved = false;
      const settle = (kind: 'ok' | 'error', err?: Error) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(noAuthTimer);
        if (kind === 'ok') resolve();
        else reject(err);
      };
      let noAuthTimer: ReturnType<typeof setTimeout>;

      this.ws.onopen = () => {
        this.connected = true;
        this.emit('connected');
        // If no authenticate frame arrives in time, assume no auth required.
        noAuthTimer = setTimeout(() => {
          this.authState = 'authenticated';
          settle('ok');
        }, NO_AUTH_GRACE_MS);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('disconnected');
        this.cleanup();
        if (!resolved) settle('error', new Error('Connection closed before authentication'));
      };

      this.ws.onerror = (event) => {
        this.emit('error', event);
        if (!resolved) settle('error', new Error(`WebSocket error connecting to ${url}`));
      };

      this.ws.onmessage = async (event) => {
        let parsed: any;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          this.emit('error', new Error('Failed to parse message'));
          return;
        }

        // ── Auth challenge handling ────────────────────────────────────────
        // The server sends authenticate as a top-level message (no
        // message_id), so we intercept it before normal request/response
        // dispatch.
        if (parsed.message === 'authenticate') {
          // Got something — cancel the no-auth grace window.
          clearTimeout(noAuthTimer);

          if (parsed.ready === true) {
            this.authState = 'authenticated';
            this.emit('authenticated');
            settle('ok');
            return;
          }

          if (parsed.error) {
            this.authState = 'failed';
            this.emit('error', new Error(`Authentication failed: ${parsed.error}`));
            settle('error', new Error(`Authentication failed: ${parsed.error}`));
            // Server will close the socket; no need to send anything else.
            return;
          }

          if (parsed.challenge) {
            if (!this.config.password) {
              const err = new Error(
                `Callbox requires a password but none was provided ` +
                `(authenticating as type="${parsed.type}", name="${parsed.name}")`,
              );
              this.authState = 'failed';
              this.emit('error', err);
              settle('error', err);
              return;
            }
            try {
              const res = await computeAuthResponse(
                String(parsed.type ?? ''),
                String(this.config.password),
                String(parsed.name ?? ''),
                String(parsed.challenge),
              );
              this.ws!.send(JSON.stringify({ message: 'authenticate', res }));
              // Don't resolve yet — wait for the server's ready/error reply.
            } catch (err) {
              this.authState = 'failed';
              const e = err instanceof Error ? err : new Error('Failed to compute auth response');
              this.emit('error', e);
              settle('error', e);
            }
          }
          return;
        }

        this.handleMessage(parsed);
      };
    });
  }

  async sendMessage(message: RemoteAPIMessage): Promise<any> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected');
    }
    if (this.authState !== 'authenticated') {
      throw new Error('Not authenticated yet');
    }

    return new Promise((resolve, reject) => {
      if (!message.message_id) {
        message.message_id = `id#${++this.messageId}`;
      }

      const timer = setTimeout(() => {
        this.pendingMessages.delete(message.message_id!.toString());
        reject(new Error(`Message timeout: ${message.message}`));
      }, this.config.timeout! * 1000);

      this.pendingMessages.set(message.message_id!.toString(), {
        resolve,
        reject,
        timer,
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  private handleMessage(message: any) {
    if (message.message_id) {
      const pending = this.pendingMessages.get(message.message_id.toString());
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingMessages.delete(message.message_id.toString());

        if (message.error) {
          pending.reject(new Error(message.error));
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

/**
 * Compute the Amarisoft auth response.
 *   res = hex( HMAC-SHA256(key=`${type}:${password}:${name}`, data=challenge) )
 *
 * Uses the browser Web Crypto API (window.crypto.subtle), which is
 * available in any reasonably modern browser over an http(s) origin.
 */
async function computeAuthResponse(
  type: string,
  password: string,
  name: string,
  challenge: string,
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = enc.encode(`${type}:${password}:${name}`);
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(challenge));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

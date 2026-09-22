// Amarisoft remote API client for captures.
//
// Same handshake as traffic.server's helper (Origin header, wait for
// {message:"ready"}), with two differences captures need:
//   • notifications that share the request's message_id (trx_iq_dump sends
//     {notification:"started"} before its real response) are reported through
//     onNotification instead of resolving the request;
//   • a persistent session, because log_get is per-connection: logs already
//     returned are not returned again on the same socket.
import WebSocket from 'ws';

export class RemoteApiSession {
  private ws: WebSocket;
  private seq = 0;
  private pending = new Map<string, {
    resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout; onNotification?: (m: any) => void;
  }>();
  private readyPromise: Promise<any>;
  private closed = false;

  constructor(readonly host: string, readonly port: number, connectTimeoutMs = 5000) {
    this.ws = new WebSocket(`ws://${host}:${port}/`, { handshakeTimeout: Math.min(connectTimeoutMs, 4000), origin: 'http://simtool' });
    this.readyPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.close(); reject(new Error(`No answer from ${host}:${port}`)); }, connectTimeoutMs);
      this.ws.on('message', raw => {
        let msg: any;
        try { msg = JSON.parse(String(raw)); } catch { return; }
        if (msg.message === 'ready') { clearTimeout(timer); resolve(msg); return; }
        if (msg.message === 'authenticate' && !msg.message_id) {
          clearTimeout(timer);
          this.close();
          reject(new Error(`Remote API ${host}:${port} requires authentication (com_auth), which Capture does not support yet`));
          return;
        }
        const p = msg.message_id ? this.pending.get(String(msg.message_id)) : undefined;
        if (!p) return;
        if (msg.notification !== undefined) { p.onNotification?.(msg); return; }
        this.pending.delete(String(msg.message_id));
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(String(msg.error))); else p.resolve(msg);
      });
      this.ws.on('error', err => {
        clearTimeout(timer);
        const e = new Error(`Remote API ${host}:${port}: ${err.message}`);
        reject(e);
        this.failAll(e);
      });
      this.ws.on('close', () => {
        this.closed = true;
        clearTimeout(timer);
        reject(new Error(`Remote API ${host}:${port} closed the connection`));
        this.failAll(new Error(`Remote API ${host}:${port} closed the connection`));
      });
    });
    // Avoid an unhandled rejection when nobody awaited ready() yet.
    this.readyPromise.catch(() => {});
  }

  ready() { return this.readyPromise; }
  get isClosed() { return this.closed; }

  private failAll(e: Error) {
    for (const [id, p] of this.pending) { clearTimeout(p.timer); p.reject(e); this.pending.delete(id); }
  }

  async request<T = any>(message: Record<string, unknown>, timeoutMs = 5000, onNotification?: (m: any) => void): Promise<T> {
    await this.readyPromise;
    if (this.closed) throw new Error(`Remote API ${this.host}:${this.port} is closed`);
    const id = `simtool-capture-${++this.seq}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${String(message.message)}: no response from ${this.host}:${this.port} within ${Math.round(timeoutMs / 1000)} s`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, onNotification });
      this.ws.send(JSON.stringify({ ...message, message_id: id }));
    });
  }

  close() {
    this.closed = true;
    try { this.ws.close(); } catch { /* already closed */ }
    setTimeout(() => { try { this.ws.terminate(); } catch { /* gone */ } }, 1000).unref?.();
  }
}

/** One request on a throwaway connection. */
export async function remoteApiOnce<T = any>(host: string, port: number, message: Record<string, unknown>, timeoutMs = 5000,
  onNotification?: (m: any) => void): Promise<T> {
  const s = new RemoteApiSession(host, port, Math.min(timeoutMs, 5000));
  try {
    return await s.request<T>(message, timeoutMs, onNotification);
  } finally {
    s.close();
  }
}

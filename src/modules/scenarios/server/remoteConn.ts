// A persistent Amarisoft remote API connection for the length of a run.
//
// traffic.server.ts opens a socket per request, which is fine for polling but
// wrong here: log_get is a per-connection long-poll, and a handover assert
// polls ue_get every 250 ms. One socket per daemon (plus one for logs) with
// message_id matching keeps that cheap. Origin is mandatory (nopoll) and the
// server greets with {"message":"ready"} before it accepts requests.
import WebSocket from 'ws';

export class RemoteApiError extends Error {
  constructor(message: string, public reply?: any) { super(message); }
}

export class RemoteConn {
  private ws: WebSocket | null = null;
  private ready: Promise<void> | null = null;
  private seq = 0;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout; sentAt?: number }>();
  public info: { type?: string; name?: string; version?: string } = {};
  private closed = false;
  /** callbox clock − SimTool clock (ms), from the "utc" every reply carries;
   *  the sample with the shortest round trip wins. Log timestamps use the
   *  callbox clock, so this is what lines a SimTool mark up with them. */
  public clockOffsetMs: number | null = null;
  private bestRtt = Infinity;

  constructor(public readonly label: string, public readonly host: string, public readonly port: number, private readonly idPrefix = 'simtool-mob') {}

  get url() { return `ws://${this.host}:${this.port}/`; }

  connect(timeoutMs = 5000): Promise<void> {
    if (this.closed) return Promise.reject(new Error(`${this.label} connection closed`));
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url, { handshakeTimeout: Math.min(timeoutMs, 4000), origin: 'http://simtool' });
      this.ws = ws;
      let greeted = false;
      const timer = setTimeout(() => {
        if (!greeted) { ws.terminate(); this.reset(); reject(new Error(`${this.label} ${this.host}:${this.port}: no "ready" greeting`)); }
      }, timeoutMs);
      ws.on('message', raw => {
        let msg: any;
        try { msg = JSON.parse(String(raw)); } catch { return; }
        const rxAt = Date.now();
        if (!greeted) {
          if (msg.message === 'ready') {
            greeted = true;
            clearTimeout(timer);
            this.info = { type: msg.type, name: msg.name, version: msg.version };
            resolve();
          } else if (msg.message === 'authenticate') {
            clearTimeout(timer);
            ws.terminate();
            this.reset();
            reject(new Error(`${this.label} remote API requires authentication — not supported yet`));
          }
          return;
        }
        const id = msg.message_id !== undefined ? String(msg.message_id) : '';
        const p = this.pending.get(id);
        if (!p) return; // events / notifications we did not ask for
        if (msg.notification) return;
        this.pending.delete(id);
        clearTimeout(p.timer);
        if (typeof msg.utc === 'number' && p.sentAt !== undefined) {
          const rtt = rxAt - p.sentAt;
          if (rtt <= this.bestRtt) { this.bestRtt = rtt; this.clockOffsetMs = msg.utc * 1000 - (p.sentAt + rtt / 2); }
        }
        if (msg.error) p.reject(new RemoteApiError(String(msg.error), msg));
        else p.resolve(msg);
      });
      ws.on('error', e => {
        clearTimeout(timer);
        if (!greeted) { this.reset(); reject(new Error(`${this.label} ${this.host}:${this.port}: ${e.message}`)); }
      });
      ws.on('close', () => {
        clearTimeout(timer);
        const err = new Error(`${this.label} connection to ${this.host}:${this.port} closed`);
        for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(err); }
        this.pending.clear();
        this.reset();
      });
    });
    return this.ready;
  }

  private reset() { this.ws = null; this.ready = null; }

  /** Send a request and wait for the reply with the same message_id. Reconnects if the socket dropped. */
  async send<T = any>(message: Record<string, unknown>, timeoutMs = 5000): Promise<T> {
    await this.connect();
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error(`${this.label} not connected`);
    const id = `${this.idPrefix}-${++this.seq}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.label}: no reply to ${String(message.message)} within ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, sentAt: Date.now() });
      ws.send(JSON.stringify({ ...message, message_id: id }));
    });
  }

  close() {
    this.closed = true;
    try { this.ws?.close(); } catch { /* ignore */ }
    this.reset();
  }
}

export interface LogLine { /** SimTool receive time (callbox clocks drift). */ rx: number; t: number; layer: string; level: string; dir?: string; ueId?: number; text: string }

/** Continuous log_get long-poll on its own connection. */
export class LogCollector {
  private conn: RemoteConn;
  private running = false;
  public lines: LogLine[] = [];
  public error: string | null = null;
  private static MAX = 20000;

  constructor(label: string, host: string, port: number, private layers?: Record<string, string>) {
    this.conn = new RemoteConn(`${label} logs`, host, port, 'simtool-mob-log');
  }

  async start() {
    await this.conn.connect();
    this.running = true;
    void this.loop();
  }

  private async loop() {
    while (this.running) {
      try {
        const req: Record<string, unknown> = { message: 'log_get', min: 1, max: 2000, timeout: 1, allow_empty: true };
        if (this.layers && Object.keys(this.layers).length) req.layers = this.layers;
        const r = await this.conn.send<any>(req, 10000);
        const rx = Date.now();
        for (const l of r.logs ?? []) {
          const t = typeof l.timestamp === 'number' ? l.timestamp : typeof l.timestamp_us === 'number' ? l.timestamp_us / 1000 : Date.now();
          this.lines.push({ rx, t, layer: String(l.layer ?? ''), level: String(l.level ?? ''), dir: l.dir, ueId: l.ue_id, text: (l.data ?? []).join('\n') });
        }
        if (this.lines.length > LogCollector.MAX) this.lines.splice(0, this.lines.length - LogCollector.MAX);
        this.error = null;
      } catch (e: any) {
        this.error = e?.message ?? String(e);
        if (!this.running) break;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  stop() { this.running = false; this.conn.close(); }
}

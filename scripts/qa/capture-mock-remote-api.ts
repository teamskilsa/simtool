// Mock Amarisoft remote API for Capture QA (no callbox needed).
//
//   npx tsx scripts/qa/capture-mock-remote-api.ts [port]     (default 19001)
//
// Speaks the documented handshake ({message:"ready"} on connect) and answers:
//   config_get   canned lteenb config (capture-mock-config.ts), live log levels
//   config_set   applies logs.layers.<layer>.level
//   log_get      per-connection long-poll over a generated log stream,
//                honouring min / timeout / allow_empty / layers / start_timestamp
//   trx_iq_dump  sends {notification:"started"}, waits `duration`, writes
//                synthetic float32 IQ (tones + noise) to rx_filename/tx_filename
//                with %d per channel, then answers with rf_ports / *_files
//   qa_history   (mock-only) every message received, for assertions
//
// Synthetic tones, so the inspector can be checked end to end:
//   RX channel c → +1.25 MHz + c·0.5 MHz at 0.3 (−10.5 dBFS)
//   TX channel c → −3.0 MHz − c·0.5 MHz at 0.5 (−6 dBFS)
import { WebSocketServer, type WebSocket } from 'ws';
import { mockConfigGet } from './capture-mock-config';
import { writeSynthIq } from './capture-synth';

export interface MockHandle { port: number; history: any[]; origins: string[]; close: () => Promise<void> }

const LAYERS = ['phy', 'mac', 'rrc', 's1ap', 'nas'];
const LEVEL_RANK: Record<string, number> = { none: 0, error: 1, warn: 2, info: 3, debug: 4 };

export function startMockRemoteApi(port = 19001): Promise<MockHandle> {
  const cfg = JSON.parse(JSON.stringify(mockConfigGet));
  const history: any[] = [];
  const origins: string[] = [];
  // A shared log buffer: 20 logs/s spread over layers and levels.
  const logs: any[] = [];
  let idx = 0;
  const gen = setInterval(() => {
    const now = Date.now();
    for (const layer of LAYERS) {
      for (const level of ['info', 'debug']) {
        logs.push({ idx: idx++, timestamp: now, layer, level, dir: 'DL', ue_id: 1, src: 'ENB', data: [`${layer} ${level} message ${idx}`] });
      }
    }
    if (logs.length > 20000) logs.splice(0, logs.length - 20000);
  }, 250);

  return new Promise(resolve => {
    const wss = new WebSocketServer({ port, host: '127.0.0.1' });
    wss.on('connection', (ws: WebSocket, req) => {
      origins.push(String(req.headers.origin ?? ''));
      let cursor = -1; // per-connection log_get position
      let pendingLogGet: { resolve: () => void } | null = null;
      const send = (m: any) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));
      send({ message: 'ready', type: 'ENB', name: cfg.name, version: cfg.version });

      ws.on('message', async raw => {
        let msg: any;
        try { msg = JSON.parse(String(raw)); } catch { return; }
        history.push(msg);
        const reply = (body: any) => send({ message: msg.message, message_id: msg.message_id, ...body });
        switch (msg.message) {
          case 'qa_history': return reply({ history, origins });
          case 'config_get': return reply(cfg);
          case 'config_set': {
            for (const [l, v] of Object.entries<any>(msg.logs?.layers ?? {})) {
              cfg.logs.layers[l] = { ...(cfg.logs.layers[l] ?? {}), ...v };
            }
            return reply({});
          }
          case 'log_get': {
            // A new request answers the pending one immediately (per the docs).
            pendingLogGet?.resolve();
            const min = msg.min ?? 1, timeoutMs = (msg.timeout ?? 1) * 1000;
            const filter = msg.layers as Record<string, string> | undefined;
            const pick = () => logs.filter(l => l.idx > cursor
              && (msg.start_timestamp === undefined || l.timestamp >= msg.start_timestamp)
              && (filter ? LEVEL_RANK[l.level] <= LEVEL_RANK[filter[l.layer] ?? 'none'] : true)
              && LEVEL_RANK[l.level] <= LEVEL_RANK[cfg.logs.layers[l.layer]?.level ?? 'none']);
            await new Promise<void>(res => {
              const t0 = Date.now();
              const timer = setInterval(() => {
                if (pick().length >= min || Date.now() - t0 >= timeoutMs) { clearInterval(timer); res(); }
              }, 50);
              pendingLogGet = { resolve: () => { clearInterval(timer); res(); } };
            });
            pendingLogGet = null;
            const out = pick().slice(0, msg.max ?? 4096);
            if (out.length === 0 && !msg.allow_empty) return; // real server would keep waiting
            if (out.length) cursor = out[out.length - 1].idx;
            // Skipped (filtered) logs are consumed too.
            cursor = Math.max(cursor, logs.filter(l => l.timestamp <= Date.now()).at(-1)?.idx ?? cursor);
            return reply({ logs: out, ...(msg.headers ? { headers: ['mock lteenb 2026-06-12', 'Licensed to QA'] } : {}) });
          }
          case 'trx_iq_dump': {
            const duration = Math.min(30000, Number(msg.duration ?? 1000));
            const ports: number[] = msg.rf_port === undefined ? [0] : ([] as number[]).concat(msg.rf_port);
            for (const f of [msg.rx_filename, msg.tx_filename]) {
              if (f !== undefined && !/^\/tmp\/simtool-[A-Za-z0-9._%-]+$/.test(f)) return reply({ error: `mock refuses path ${f}` });
            }
            send({ message: msg.message, message_id: msg.message_id, notification: 'started', time: Date.now() / 1000 });
            await new Promise(r => setTimeout(r, duration));
            const rateOf = (p: number) => cfg.rf_ports?.[p]?.sample_rate ?? 61.44e6;
            const rx_files: string[] = [], tx_files: string[] = [];
            for (const dir of ['rx', 'tx'] as const) {
              const pattern = msg[`${dir}_filename`];
              if (!pattern) continue;
              const chans: any[] = cfg[`${dir}_channels`];
              chans.forEach((ch, index) => {
                if (!ports.includes(ch.port)) return;
                const file = pattern.replace('%d', String(index));
                const rate = rateOf(ch.port);
                const samples = Math.round((rate * duration) / 1000);
                const c = index % 2;
                const tone = dir === 'rx' ? { offsetHz: 1.25e6 + c * 0.5e6, amplitude: 0.3 } : { offsetHz: -3.0e6 - c * 0.5e6, amplitude: 0.5 };
                writeSynthIq(file, rate, samples, [tone], 0.01, index + 1);
                (dir === 'rx' ? rx_files : tx_files).push(file);
              });
            }
            return reply({
              dump_utc: Date.now() - duration,
              rf_ports: ports.map(p => ({ index: p, sample_rate: rateOf(p), timestamp: 0, frame: 0, slot: 0 })),
              ...(rx_files.length ? { rx_files, rx_timestamp0: 1234 } : {}),
              ...(tx_files.length ? { tx_files, tx_timestamp0: 1234 } : {}),
              rx_overflows: 0, tx_overflows: 0,
            });
          }
          default: return reply({ error: `mock: unsupported message ${msg.message}` });
        }
      });
    });
    wss.on('listening', () => resolve({
      port, history, origins,
      close: () => new Promise<void>(r => { clearInterval(gen); for (const c of wss.clients) c.terminate(); wss.close(() => r()); }),
    }));
  });
}

if (require.main === module) {
  const port = Number(process.argv[2] ?? 19001);
  startMockRemoteApi(port).then(() => console.log(`mock remote API on ws://127.0.0.1:${port}/`));
}

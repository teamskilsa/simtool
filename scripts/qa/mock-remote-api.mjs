#!/usr/bin/env node
// Mock Amarisoft remote API servers for offline QA of SimTool's Remote API
// console. Speaks the protocol documented in the 2026-09-11 docs
// (lteenb.html chapter 10, ltemme/lteims/lteue/ltembmsgw/ltelicense chapter
// "Remote API") for a representative set of messages, including errors.
//
//   node scripts/qa/mock-remote-api.mjs                      # ENB 19001, MME 19000, UE 19002, IMS 19003, MBMS 19004, LICENSE 19006
//   node scripts/qa/mock-remote-api.mjs --base-port 29000 --version 2026-06-12
//   node scripts/qa/mock-remote-api.mjs --password secret    # com_auth on every server
//   node scripts/qa/mock-remote-api.mjs --trace              # print every frame in/out
//
// Behaviour copied from the docs / live callbox (2026-06-12):
//   * handshake rejected without an Origin header (nopoll)
//   * banner {message:"ready", type, name, version, product, time, utc}, or
//     {message:"authenticate", type, name, challenge} with com_auth
//   * errors are {message, message_id, error}; unknown -> "Unknown message: 'x'"
//   * notifications share message_id and carry `notification` (trx_iq_dump)
//   * start_time / loop_count / loop_delay / group_id / cancel (cancel only >= 2026-06-12)
//   * arrays of messages in one frame
//   * log_get is a per-connection long-poll; eNB stats windows are per
//     connection; eNB ue_get bitrates share one window across connections
//   * cell_gain range [-200:0]; handover needs the target in ncell_list;
//     page_ue needs imsi (except nr); ue_del removes from ue_db; ue_detach
//     default cause 3 invalidates the SIM
//   * there is NO `monitor` message (the old Screen Monitor relied on one)
//
// Not a simulator: values are plausible, not physical.

import { createHmac, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { WebSocketServer } = require('ws');

const OFFSETS = { MME: 0, ENB: 1, UE: 2, IMS: 3, MBMS: 4, LICENSE: 6 };
const BANNER_TYPE = { ENB: 'ENB', MME: 'MME', UE: 'UE', IMS: 'IMS', MBMS: 'MBMSGW', LICENSE: 'LICENSE' };
const CANCEL_VERSION = 20260612;

const vnum = (v) => {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0;
};

class ApiError extends Error {}
const fail = (text) => { throw new ApiError(text); };

// ── Param helpers mimicking lteenb's generic errors ("Missing param 'x'", "Bad type for 'x'")
function need(msg, key, type) {
  if (msg[key] === undefined) fail(`Missing param '${key}'`);
  return typed(msg, key, type);
}
function opt(msg, key, type, dflt) {
  if (msg[key] === undefined) return dflt;
  return typed(msg, key, type);
}
function typed(msg, key, type) {
  const v = msg[key];
  const ok = type === 'integer' ? Number.isInteger(v)
    : type === 'number' ? typeof v === 'number' && Number.isFinite(v)
    : type === 'array' ? Array.isArray(v)
    : type === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v)
    : typeof v === type;
  if (!ok) fail(`Bad type for '${key}'`);
  return v;
}
const ueIdOf = (msg, primary) => {
  const key = msg[primary] !== undefined ? primary : (primary === 'ran_ue_id' ? 'enb_ue_id' : 'ran_ue_id');
  return need(msg, msg[key] !== undefined ? key : primary, 'integer');
};

function makeState() {
  const now = Date.now();
  return {
    enb: {
      cells: {
        1: { n_id_cell: 1, dl_earfcn: 3350, ul_earfcn: 21350, n_rb_dl: 100, gain: 0, ul_disabled: false, label: 'B7 20MHz', ncell_list: [] },
        2: { n_id_cell: 2, dl_earfcn: 1575, ul_earfcn: 19575, n_rb_dl: 50, gain: 0, ul_disabled: false, label: 'B3 10MHz', ncell_list: [] },
      },
      ues: [
        { enb_ue_id: 1, mme_ue_id: 11, rnti: 0x4601, pcell: 1, scells: [2], activated: [], released: false },
      ],
      rf: { tx_gain: [70, 70], rx_gain: [50, 50] },
      s1: [{ state: 'setup_done', address: '127.0.1.100:36412', name: 'mme', PLMN: '00101' }],
      ueGetWindowAt: now, // shared across connections (live-observed)
      sib: {},
      configSet: [],
    },
    mme: {
      ue_db: new Map([
        ['001010123456789', { imsi: '001010123456789', imeisv: '3560920407930101', registered: true, sim_invalid: false }],
        ['001010123456790', { imsi: '001010123456790', imeisv: '3560920407930201', registered: true, sim_invalid: false }],
      ]),
      attachRejectError: 0,
    },
    ue: { ues: [{ ue_id: 1, imsi: '001010123456789', power_on: true, rrc_state: 'connected', emm_state: 'registered' }] },
    ims: { users: [{ impi: '001010123456789', bindings: [{ uri: 'sip:001010123456789@10.0.0.2', impu: ['tel:0600000001'], expires: 3600 }] }] },
    mbms: { services: { 1: false } },
    license: { licenses: [{ uid: 'mock-uid-1', products: 'lteenb,ltemme', origin: 'file', max: 4, version: '2026-12-31', connections: [] }] },
  };
}

const COMMON = ['config_get', 'config_set', 'log_get', 'log_set', 'log_reset', 'license', 'quit', 'help', 'stats', 'register', 'cancel'];
const SPECIFIC = {
  ENB: ['ue_get', 'erab_get', 'qos_flow_get', 'cell_gain', 'rf', 'trx_iq_dump', 'cell_ul_disable', 'handover', 'rrc_cnx_release', 'rrc_ue_info_req', 'rrc_cnx_reconf', 'scells_act_deact', 'ncell_list_add', 'ncell_list_del', 'sib_set', 'page_ue', 'noise_level', 's1', 's1connect', 's1disconnect', 'ng', 'x2', 'xn', 'm2'],
  MME: ['ue_get', 'ue_add', 'ue_del', 'ue_detach', 'load_balancing_tau', 'enb', 's6'],
  UE: ['ue_get', 'power_on', 'power_off', 'rf'],
  IMS: ['users_get', 'sms'],
  MBMS: ['service_start', 'service_stop'],
  LICENSE: ['list', 'reload', 'message'],
};

export async function startMockServers(options = {}) {
  const {
    basePort = 19000,
    host = '127.0.0.1',
    version = '2026-09-11',
    password = null,
    unsecure = false,
    components = Object.keys(OFFSETS),
    maxConnections = {},
    quiet = true,
    trace = false,
  } = options;
  const state = makeState();
  const startedAt = Date.now();
  const servers = [];
  const ports = {};
  const log = (...a) => { if (!quiet) console.log('[mock]', ...a); };

  for (const comp of components) {
    const port = basePort + OFFSETS[comp];
    ports[comp] = port;
    const logs = []; // server log buffer
    let logIdx = 0;
    const pushLog = (layer, level, text, extra = {}) => {
      logs.push({ data: [text], timestamp: Date.now(), layer, level, src: comp, idx: logIdx++, ...extra });
      if (logs.length > 2000) logs.shift();
      for (const w of waiters) w();
    };
    const waiters = new Set();
    const logTimer = setInterval(() => pushLog(comp === 'ENB' ? 'RRC' : 'NAS', 'info', `${comp} heartbeat ${logIdx}`), 400);
    const conns = new Set();

    const wss = new WebSocketServer({
      host,
      port,
      // nopoll refuses the upgrade when Origin is missing.
      verifyClient: (info, cb) => (info.req.headers.origin ? cb(true) : cb(false, 403, 'Origin header required')),
    });
    await new Promise((resolve, reject) => { wss.once('listening', resolve); wss.once('error', reject); });

    wss.on('connection', (ws) => {
      const conn = {
        ws,
        authed: !password,
        challenge: null,
        logCursor: -1,
        statsAt: null,
        registered: new Set(),
        pending: new Map(), // timer -> {group_id, msg}
        closed: false,
      };
      conns.add(conn);
      const send = (obj) => {
        if (conn.closed || ws.readyState !== 1) return;
        const text = JSON.stringify(obj);
        if (trace) console.log(`[mock ${comp}] -> ${text.slice(0, 300)}`);
        ws.send(text);
      };
      const base = () => ({ time: (Date.now() - startedAt) / 1000, utc: Date.now() / 1000 });

      const limit = maxConnections[comp];
      if (limit && conns.size > limit) {
        send({ message: 'error', error: 'Too many connections' });
        ws.close();
        return;
      }

      const name = `${comp.toLowerCase()}-mock`;
      const newChallenge = () => (conn.challenge = randomBytes(16).toString('hex'));
      if (password) {
        send({ message: 'authenticate', type: BANNER_TYPE[comp], name, challenge: newChallenge() });
      } else {
        send({ message: 'ready', type: BANNER_TYPE[comp], name, version, product: 'Amarisoft Callbox Mock', ...base() });
      }

      ws.on('close', () => {
        conn.closed = true;
        conns.delete(conn);
        for (const [t] of conn.pending) clearTimeout(t);
      });

      ws.on('message', async (raw) => {
        let parsed;
        try {
          parsed = JSON.parse(String(raw));
        } catch {
          send({ message: 'error', error: 'Error while parsing JSON' });
          return;
        }
        const list = Array.isArray(parsed) ? parsed : [parsed];
        if (!Array.isArray(parsed) && (parsed === null || typeof parsed !== 'object')) {
          send({ message: 'error', error: 'Message must be ARRAY or OBJECT' });
          return;
        }
        if (trace) console.log(`[mock ${comp}] <- ${String(raw).slice(0, 300)}`);
        for (const msg of list) await dispatch(msg);
      });

      async function dispatch(msg) {
        if (!msg || typeof msg.message !== 'string') {
          send({ message: 'error', error: 'Missing string message' });
          return;
        }
        const reply = (body) => send({ message: msg.message, ...(msg.message_id !== undefined ? { message_id: msg.message_id } : {}), ...base(), ...body });

        if (msg.message === 'authenticate') {
          if (!password) { reply({ error: 'Authentication not enabled' }); return; }
          const expected = createHmac('sha256', `${BANNER_TYPE[comp]}:${password}:${name}`).update(conn.challenge).digest('hex');
          const plainOk = msg.password !== undefined && msg.password === `${BANNER_TYPE[comp]}:${password}:${name}`;
          if (msg.password !== undefined && !unsecure) {
            reply({ error: 'Unsecure authentication forbidden', type: BANNER_TYPE[comp], name, challenge: newChallenge() });
            return;
          }
          if (msg.res === expected || plainOk) {
            conn.authed = true;
            reply({ ready: true });
          } else {
            reply({ error: 'Authentication failed', type: BANNER_TYPE[comp], name, challenge: newChallenge() });
          }
          return;
        }
        if (!conn.authed) { reply({ error: 'Authentication not done' }); return; }

        // Envelope checks
        const v = vnum(version);
        if (msg.group_id !== undefined && v < CANCEL_VERSION) { /* older servers just ignore it */ }
        if (msg.loop_count !== undefined && msg.loop_count > 0 && msg.loop_delay === undefined) { reply({ error: "Missing param 'loop_delay'" }); return; }

        const delayMs = typeof msg.start_time === 'number' && !msg.absolute_time ? msg.start_time * 1000 : 0;
        const loops = Number.isInteger(msg.loop_count) && msg.loop_count > 0 ? msg.loop_count : 0;
        const loopDelayMs = (msg.loop_delay ?? 0) * 1000;

        const runOnce = async (loopIndex) => {
          try {
            const body = await handle(msg, reply);
            if (body === null) return; // handler replied itself
            reply({ ...body, ...(loops ? { loop_index: loopIndex } : {}) });
          } catch (e) {
            if (e instanceof ApiError) reply({ error: e.message, ...(loops ? { loop_index: loopIndex } : {}) });
            else { reply({ error: `Internal error: ${e.message}` }); console.error(e); }
          }
        };

        if (!delayMs && !loops) { await runOnce(0); return; }
        let i = 0;
        const schedule = (ms) => {
          const t = setTimeout(async () => {
            conn.pending.delete(t);
            await runOnce(i);
            i++;
            if (i < loops) schedule(loopDelayMs);
          }, ms);
          conn.pending.set(t, { group_id: msg.group_id, msg, reply });
        };
        schedule(delayMs);
      }

      // ── Handlers ──────────────────────────────────────────────────────────
      async function handle(msg, reply) {
        const m = msg.message;
        const v = vnum(version);
        const known = [...COMMON.filter(x => x !== 'cancel' || v >= CANCEL_VERSION), ...SPECIFIC[comp]];
        if (comp === 'MBMS' || comp === 'LICENSE') {
          const i = known.indexOf('register'); if (i >= 0) known.splice(i, 1);
        }
        if (!known.includes(m)) fail(`Unknown message: '${m}'`);

        switch (m) {
          // ── common ──
          case 'config_get': {
            const out = { type: BANNER_TYPE[comp], name, version, logs: { layers: { PHY: { level: 'warn', max_size: 1 }, RRC: { level: 'debug', max_size: 1 } }, count: 8192, bcch: false, mib: false } };
            if (comp === 'ENB') {
              out.cells = Object.fromEntries(Object.entries(state.enb.cells).map(([id, c]) => [id, { ...c, ncell_list: undefined }]));
              out.global_enb_id = { plmn: '00101', enb_id_type: 'macro', enb_id: 0x1a2d0, enb_name: 'mock' };
            }
            return out;
          }
          case 'config_set': {
            if (msg.logs !== undefined) typed(msg, 'logs', 'object');
            if (comp === 'ENB' && msg.cells !== undefined) {
              typed(msg, 'cells', 'object');
              for (const [id, c] of Object.entries(msg.cells)) {
                if (!state.enb.cells[id]) fail(`Unknown cell id: ${id}`);
                if (c.pdsch_mcs !== undefined && (!Number.isInteger(c.pdsch_mcs) || c.pdsch_mcs < -1 || c.pdsch_mcs > 28)) fail('pdsch_mcs must be in range [-1:28]');
              }
              state.enb.configSet.push(msg.cells);
            }
            if (comp === 'MME' && msg.attach_reject_error !== undefined) state.mme.attachRejectError = msg.attach_reject_error;
            return {};
          }
          case 'log_get': {
            const min = opt(msg, 'min', 'number', 1);
            const max = opt(msg, 'max', 'number', 4096);
            const timeout = opt(msg, 'timeout', 'number', 1);
            const allowEmpty = opt(msg, 'allow_empty', 'boolean', false);
            const collect = () => logs.filter(l => l.idx > conn.logCursor);
            const deadline = Date.now() + timeout * 1000;
            let got = collect();
            while (got.length < min && !conn.closed) {
              const remaining = deadline - Date.now();
              if (remaining <= 0 && (allowEmpty || got.length > 0)) break;
              await new Promise((r) => {
                const w = () => { waiters.delete(w); r(); };
                waiters.add(w);
                setTimeout(w, Math.max(50, Math.min(remaining > 0 ? remaining : 200, 500)));
              });
              got = collect();
            }
            const out = got.slice(0, max);
            if (out.length) conn.logCursor = out[out.length - 1].idx;
            return { logs: out };
          }
          case 'log_set': {
            if (msg.log !== undefined) { need(msg, 'layer', 'string'); need(msg, 'level', 'string'); pushLog(msg.layer, msg.level, msg.log); }
            return {};
          }
          case 'log_reset': logs.length = 0; return {};
          case 'license': return { products: 'lteenb,ltemme,lteims,lteue', user: 'mock', validity: '2026-12-31', id: '0000-mock', id_type: 'host_id' };
          case 'help': return { messages: known, events: comp === 'ENB' ? ['ue_measurement_report', 'srs', 'pusch', 'npusch', 'carrier_sense'] : [] };
          case 'quit': setTimeout(() => ws.close(), 50); return {};
          case 'register': {
            if (msg.register !== undefined && msg.unregister !== undefined) fail("Can't register and unregister register simultaneously");
            const evs = [].concat(msg.register ?? []);
            evs.forEach(e => conn.registered.add(e));
            if (evs.includes('ue_measurement_report')) {
              setTimeout(() => send({ message: 'ue_measurement_report', ran_ue_id: 1, cell_id: 1, c_rnti: 0x4601, meas_results: '{ measId 1 }', time: 1 }), 100);
            }
            return {};
          }
          case 'cancel': {
            const gid = msg.group_id;
            let n = 0;
            for (const [t, p] of conn.pending) {
              if (gid === undefined || p.group_id === gid) {
                clearTimeout(t);
                conn.pending.delete(t);
                p.reply({ cancel: true });
                n++;
              }
            }
            return { cancelled: n };
          }
          case 'stats': {
            const now = Date.now();
            let duration;
            if (comp === 'ENB') {
              // Per connection window (lteenb 10.5 stats). The first call on a
              // connection samples for initial_delay seconds before answering.
              if (conn.statsAt === null) {
                duration = opt(msg, 'initial_delay', 'number', 0.4);
                await new Promise(r => setTimeout(r, duration * 1000));
              } else {
                duration = (now - conn.statsAt) / 1000;
              }
              conn.statsAt = Date.now();
            } else {
              // Global window, reset on every call (ltemme 6.5 stats).
              duration = state[`${comp}_statsAt`] ? (now - state[`${comp}_statsAt`]) / 1000 : 0;
              state[`${comp}_statsAt`] = now;
            }
            const out = { cpu: { global: 12.5 }, instance_id: 42, counters: { messages: {}, errors: {} }, duration };
            if (comp === 'ENB') {
              out.cells = Object.fromEntries(Object.keys(state.enb.cells).map(id => [id, { dl_bitrate: 1.2e6, ul_bitrate: 3e5, dl_tx: 1000, ul_tx: 500, dl_retx: 3, ul_retx: 1, ue_count_avg: state.enb.ues.length }]));
              if (msg.samples) out.samples = { tx: [{ rms: -20.1, max: -3.2, sat: 0, count: 1e6 }], rx: [{ rms: -40.3, max: -20.0, sat: 0, count: 1e6 }] };
              if (msg.rf) out.rf_ports = { 0: { rxtx_delay_min: 1, rxtx_delay_avg: 1.5, rxtx_delay_max: 2 } };
            }
            if (comp === 'MME') out.emm_registered_ue_count = [...state.mme.ue_db.values()].filter(u => u.registered).length;
            return out;
          }
        }

        if (comp === 'ENB') return enb(msg, reply);
        if (comp === 'MME') return mme(msg);
        if (comp === 'UE') return uesim(msg);
        if (comp === 'IMS') return ims(msg);
        if (comp === 'MBMS') return mbms(msg);
        if (comp === 'LICENSE') return lic(msg);
        fail(`Unknown message: '${m}'`);
      }

      function enbUe(id) {
        const ue = state.enb.ues.find(u => u.enb_ue_id === id && !u.released);
        if (!ue) fail(`Unknown UE id: ${id}`);
        return ue;
      }

      async function enb(msg, reply) {
        const s = state.enb;
        switch (msg.message) {
          case 'ue_get': {
            const stats = opt(msg, 'stats', 'boolean', false);
            const now = Date.now();
            // Shared window across connections (observed live 2026-06-12).
            const windowS = Math.max(0.001, (now - s.ueGetWindowAt) / 1000);
            s.ueGetWindowAt = now;
            return {
              ue_list: s.ues.filter(u => !u.released).map(u => ({
                time: 12.3, enb_ue_id: u.enb_ue_id, mme_ue_id: u.mme_ue_id, rnti: u.rnti,
                cells: [u.pcell, ...u.activated].map(cid => (stats
                  ? { cell_id: cid, cqi: 15, ri: 2, dl_bitrate: Math.round(1e6 / windowS), ul_bitrate: Math.round(2e5 / windowS), dl_tx: 100, ul_tx: 50, dl_retx: 1, ul_retx: 0, dl_mcs: 27.5, ul_mcs: 20.1, pusch_snr: 25 }
                  : { cell_id: cid })),
                erabs: [{ erab_id: 5, qci: 9, dl_total_bytes: 1234, ul_total_bytes: 567 }],
              })),
            };
          }
          case 'erab_get': return { timestamp: Date.now(), erab_list: s.ues.filter(u => !u.released).map(u => ({ enb_ue_id: u.enb_ue_id, erab_id: 5, qci: 9, dl_total_bytes: 1234, ul_total_bytes: 567 })) };
          case 'qos_flow_get': return { timestamp: Date.now(), qos_flow_list: [] };
          case 'cell_gain': {
            const id = need(msg, 'cell_id', 'integer');
            const gain = need(msg, 'gain', 'number');
            const cell = s.cells[id];
            if (!cell) fail('Unknown cell id');
            if (gain < -200 || gain > 0) fail('gain must be between -200 and 0');
            cell.gain = gain;
            return {};
          }
          case 'cell_ul_disable': {
            const id = need(msg, 'cell_id', 'integer');
            if (!s.cells[id]) fail('Unknown cell id');
            s.cells[id].ul_disabled = need(msg, 'disabled', 'boolean');
            return {};
          }
          case 'rf': {
            if (msg.tx_gain !== undefined) {
              const idx = opt(msg, 'tx_channel_index', 'integer', undefined);
              if (idx !== undefined && (idx < 0 || idx >= s.rf.tx_gain.length)) fail(`Invalid channel number, should be from 0 to ${s.rf.tx_gain.length - 1}`);
              const g = msg.tx_gain;
              if (Array.isArray(g)) s.rf.tx_gain = g.slice(0, s.rf.tx_gain.length);
              else if (idx !== undefined) s.rf.tx_gain[idx] = g;
              else s.rf.tx_gain = s.rf.tx_gain.map(() => g);
            }
            if (msg.rx_gain !== undefined) {
              const g = msg.rx_gain;
              s.rf.rx_gain = Array.isArray(g) ? g : s.rf.rx_gain.map(() => g);
            }
            return { tx_gain: s.rf.tx_gain, rx_gain: s.rf.rx_gain, rf_info: 'TRX mock: 2 channels\nsample_rate=30.72 MHz' };
          }
          case 'trx_iq_dump': {
            const duration = opt(msg, 'duration', 'number', 1000);
            if (duration > 30000) fail('duration must be <= 30000');
            if (msg.rx_filename === undefined && msg.tx_filename === undefined) fail('Nothing to dump');
            // Notification when the dump really starts, then the response.
            await new Promise(r => setTimeout(r, 50));
            reply({ notification: 'start' });
            await new Promise(r => setTimeout(r, Math.min(duration, 2000)));
            return {
              dump_utc: Date.now(),
              rf_ports: [{ sample_rate: 30720000, index: 0, timestamp: 123456, frame: 10, slot: 0, mu: 0, rx_files: msg.rx_filename ? [String(msg.rx_filename).replace('%d', '0')] : [], tx_files: msg.tx_filename ? [String(msg.tx_filename).replace('%d', '0')] : [], rx_timestamp0: 123000 }],
            };
          }
          case 'handover': {
            const id = ueIdOf(msg, 'ran_ue_id');
            const pci = need(msg, 'pci', 'integer');
            const earfcn = opt(msg, 'dl_earfcn', 'integer', undefined);
            const ue = enbUe(id);
            const serving = s.cells[ue.pcell];
            const f = earfcn ?? serving.dl_earfcn;
            // lteenb resolves the target through the serving cell's ncell_list.
            const inNcell = serving.ncell_list.some(n => n.n_id_cell === pci && (n.dl_earfcn ?? serving.dl_earfcn) === f);
            if (!inNcell) fail(`Unknown target cell: pci=${pci} earfcn=${f} not in ncell_list of cell ${ue.pcell}`);
            const target = Object.entries(s.cells).find(([, c]) => c.n_id_cell === pci && c.dl_earfcn === f);
            if (target) ue.pcell = Number(target[0]);
            pushLog('RRC', 'info', `handover ue ${id} -> pci ${pci} earfcn ${f}`);
            return {};
          }
          case 'ncell_list_add': {
            const id = need(msg, 'cell_id', 'integer');
            const n = need(msg, 'ncell', 'object');
            if (!s.cells[id]) fail('Unknown cell id');
            if (!Number.isInteger(n.n_id_cell)) fail("Missing param 'n_id_cell'");
            if ((n.rat ?? 'eutra') === 'eutra' && n.cell_id === undefined) fail("Missing param 'cell_id'");
            if (s.cells[id].ncell_list.some(x => x.n_id_cell === n.n_id_cell && x.dl_earfcn === n.dl_earfcn)) fail('Neighbour cell already exists');
            s.cells[id].ncell_list.push({ ...n });
            return {};
          }
          case 'ncell_list_del': {
            const id = need(msg, 'cell_id', 'integer');
            const pci = need(msg, 'n_id_cell', 'integer');
            const arfcn = opt(msg, 'dl_arfcn', 'integer', undefined);
            const cell = s.cells[id];
            if (!cell) fail('Unknown cell id');
            const before = cell.ncell_list.length;
            cell.ncell_list = cell.ncell_list.filter(x => !(x.n_id_cell === pci && (arfcn === undefined || (x.dl_earfcn ?? cell.dl_earfcn) === arfcn)));
            if (cell.ncell_list.length === before) fail('Neighbour cell not found');
            return {};
          }
          case 'rrc_cnx_release': {
            const ue = enbUe(ueIdOf(msg, 'ran_ue_id'));
            ue.released = true;
            setTimeout(() => { ue.released = false; }, 1500); // UE comes back
            return {};
          }
          case 'rrc_ue_info_req': {
            enbUe(ueIdOf(msg, 'enb_ue_id'));
            const mask = need(msg, 'req_mask', 'integer');
            if (mask < 0 || mask > 511) fail('req_mask out of range');
            return {};
          }
          case 'rrc_cnx_reconf': {
            const ue = enbUe(ueIdOf(msg, 'enb_ue_id'));
            if (msg.eutra_secondary_cell_list !== undefined) {
              const lst = typed(msg, 'eutra_secondary_cell_list', 'array');
              for (const sc of lst) if (!s.cells[sc.cell_id]) fail('Invalid secondary_cell_list');
              ue.scells = lst.map(x => x.cell_id);
              ue.activated = ue.activated.filter(c => ue.scells.includes(c));
            }
            return {};
          }
          case 'scells_act_deact': {
            const ue = enbUe(ueIdOf(msg, 'enb_ue_id'));
            for (const c of opt(msg, 'activate', 'array', [])) if (ue.scells.includes(c) && !ue.activated.includes(c)) ue.activated.push(c);
            const de = opt(msg, 'deactivate', 'array', []);
            ue.activated = ue.activated.filter(c => !de.includes(c));
            return { scells: ue.scells, activated: ue.activated };
          }
          case 'sib_set': {
            const cells = need(msg, 'cells', 'object');
            for (const [id, body] of Object.entries(cells)) {
              if (!s.cells[id]) fail('Unknown cell id');
              for (const [sib, content] of Object.entries(body)) {
                if (content && content.type && !['gser', 'hex', 'jer'].includes(content.type)) fail(`Bad type for '${sib}.type'`);
              }
              s.sib[id] = { ...(s.sib[id] ?? {}), ...body };
            }
            return {};
          }
          case 'page_ue': {
            const type = need(msg, 'type', 'string');
            if (!['normal', 'cat0', 'ce', 'nb-iot', 'nr'].includes(type)) fail(`Bad value for 'type'`);
            if (type !== 'nr') need(msg, 'imsi', 'string');
            const cells = need(msg, 'cell_id', 'array');
            for (const c of cells) if (!s.cells[c]) fail('Unknown cell id');
            return {};
          }
          case 'noise_level': fail('channel simulator not enabled'); break;
          case 's1': return { s1_list: s.s1 };
          case 's1connect': s.s1[0].state = 'setup_done'; return {};
          case 's1disconnect': s.s1[0].state = 'disconnected'; return {};
          case 'ng': return { ng_list: [] };
          case 'x2': return { peers: [] };
          case 'xn': return { peers: [] };
          case 'm2': return { state: 'disconnected', address: '' };
        }
        fail(`Unknown message: '${msg.message}'`);
      }

      function mme(msg) {
        const db = state.mme.ue_db;
        const subscriber = () => {
          if (msg.imsi === undefined && msg.nai === undefined) fail("Missing param 'imsi'");
          const u = db.get(msg.imsi);
          if (!u) fail(`Unknown UE: ${msg.imsi}`);
          return u;
        };
        switch (msg.message) {
          case 'ue_get': {
            const list = [...db.values()].filter(u => (msg.imsi ? u.imsi === msg.imsi : true));
            return { ue_list: list.map(u => ({ rat_type: 'LTE', imsi: u.imsi, imeisv: u.imeisv, registered: u.registered && !u.sim_invalid, tac: 1, tac_plmn: '00101', bearers: u.registered ? [{ erab_id: 5, apn: 'internet', ip: '192.168.3.2', dl_total_bytes: 1000, ul_total_bytes: 500 }] : [] })) };
          }
          case 'ue_add': {
            for (const u of need(msg, 'ue_db', 'array')) {
              if (!u.imsi) fail("Missing param 'imsi'");
              db.set(u.imsi, { imsi: u.imsi, imeisv: '0000000000000000', registered: false, sim_invalid: false });
            }
            return {};
          }
          case 'ue_del': { const u = subscriber(); db.delete(u.imsi); return {}; }
          case 'ue_detach': {
            const u = subscriber();
            const cause = opt(msg, 'cause', 'integer', 3);
            u.registered = false;
            // #3/#6/#7/#8 make the UE consider its USIM invalid.
            if ([3, 6, 7, 8].includes(cause)) u.sim_invalid = true;
            return {};
          }
          case 'load_balancing_tau': { need(msg, 'imsi', 'string'); subscriber(); return {}; }
          case 'enb': return { enb_list: [{ plmn: '00101', eNB_ID_type: 'macro', eNB_ID: 0x1a2d0, name: 'enb-mock', address: '127.0.1.1:36412', ue_ctx: 1 }] };
          case 's6': return { state: 'inactive', address: '' };
        }
        fail(`Unknown message: '${msg.message}'`);
      }

      function uesim(msg) {
        const s = state.ue;
        const ue = () => { const id = need(msg, 'ue_id', 'integer'); const u = s.ues.find(x => x.ue_id === id); if (!u) fail(`Unknown UE ID: ${id}`); return u; };
        switch (msg.message) {
          case 'ue_get': return { ue_list: s.ues.filter(u => msg.ue_id === undefined || u.ue_id === msg.ue_id) };
          case 'power_on': { const u = ue(); u.power_on = true; u.emm_state = 'registered'; return {}; }
          case 'power_off': { const u = ue(); u.power_on = false; u.emm_state = 'deregistered'; return {}; }
          case 'rf': return { tx_gain: [60], rx_gain: [40] };
        }
        fail(`Unknown message: '${msg.message}'`);
      }

      function ims(msg) {
        switch (msg.message) {
          case 'users_get': return { users: state.ims.users };
          case 'sms': { if (msg.impi === undefined && msg.impu === undefined) fail("Missing param 'impi'"); return {}; }
        }
        fail(`Unknown message: '${msg.message}'`);
      }

      function mbms(msg) {
        const id = need(msg, 'service_id', 'integer');
        if (!(id in state.mbms.services)) fail(`Unknown service: ${id}`);
        state.mbms.services[id] = msg.message === 'service_start';
        return {};
      }

      function lic(msg) {
        switch (msg.message) {
          case 'list': return { licenses: state.license.licenses };
          case 'reload': return {};
          case 'message': need(msg, 'text', 'string'); return {};
        }
        fail(`Unknown message: '${msg.message}'`);
      }
    });

    servers.push({ wss, logTimer, conns });
    log(`${comp} listening on ws://${host}:${port} (version ${version}${password ? ', auth' : ''})`);
  }

  return {
    ports,
    state,
    async close() {
      for (const s of servers) {
        clearInterval(s.logTimer);
        for (const c of s.conns) { try { c.ws.terminate(); } catch { /* gone */ } }
        await new Promise(r => s.wss.close(() => r()));
      }
    },
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const opts = {
    basePort: Number(get('--base-port') ?? 19000),
    host: get('--host') ?? '127.0.0.1',
    version: get('--version') ?? '2026-09-11',
    password: get('--password') ?? null,
    unsecure: args.includes('--unsecure'),
    trace: args.includes('--trace'),
    quiet: false,
  };
  startMockServers(opts).then((m) => {
    console.log('[mock] ports', m.ports);
    const stop = () => m.close().then(() => process.exit(0));
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  }).catch((e) => { console.error(e); process.exit(1); });
}

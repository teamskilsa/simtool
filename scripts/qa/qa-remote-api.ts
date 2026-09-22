// Offline QA for the Remote API console.
//
//   npx tsx scripts/qa/qa-remote-api.ts
//   AMARISOFT_DOCS_DIR=/path/to/2026-09-11/doc npx tsx scripts/qa/qa-remote-api.ts   # + doc coverage
//
// 1. Catalogue: every example/preset validates on its own component, no
//    duplicates, doc coverage against the release HTML (when available).
// 2. Validator: ranges, required params, aliases, version gating, danger levels.
// 3. Protocol: SimTool's real WebSocketClient against scripts/qa/mock-remote-api.mjs
//    (ready banner, Origin, errors, notifications, batches, loops, cancel,
//    long-poll log_get, per-connection stats, auth, server errors).
// 4. Screen Monitor: console lines translate to valid documented requests.
//
// The mock follows the docs; it cannot prove the real box behaves the same.
// See scripts/qa/REMOTE_API_LIVE_CHECKLIST.md for the live run.

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import {
  COMPONENT_TYPES,
  getCatalogue,
  type ComponentType,
} from '../../src/shared/default/templates/remoteapi';
import { validateRequest } from '../../src/modules/remoteAPI/utils/validate-request';
import { WebSocketClient, RemoteAPIError, timeoutForMessage } from '../../src/modules/remoteAPI/utils/websocket-client';
import { getMonitorCommands, resolveMonitorLine } from '../../src/modules/remoteAPI/components/monitor-commands';

const require_ = createRequire(__filename);
const WS = require_('ws');

// Browser-like WebSocket global with an Origin header (Amarisoft rejects the
// upgrade without one; browsers always send it).
(globalThis as any).WebSocket = class extends WS {
  constructor(url: string) { super(url, { origin: 'http://simtool.qa' }); }
};

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; if (process.env.QA_VERBOSE) console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
const section = (s: string) => console.log(`\n## ${s}`);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const V0911 = '2026-09-11';
const V0612 = '2026-06-12';

// ─────────────────────────────────────────────────────────────────────────────
section('1. Catalogue integrity');
for (const comp of COMPONENT_TYPES) {
  const cat = getCatalogue(comp);
  const names = cat.map(c => c.message);
  const dups = names.filter((n, i) => names.indexOf(n) !== i);
  check(`${comp}: no duplicate messages`, dups.length === 0, dups.join(','));
  for (const cmd of cat) {
    check(`${comp}/${cmd.message}: example message matches`, cmd.example.message === cmd.message);
    check(`${comp}/${cmd.message}: has docRef`, !!cmd.docRef);
    const bodies = [{ label: 'example', body: cmd.example }, ...(cmd.presets ?? [])];
    for (const b of bodies) {
      const r = validateRequest(b.body, { component: comp, serverVersion: V0911 });
      const errs = r.issues.filter(i => i.level !== 'info');
      check(`${comp}/${cmd.message} ${b.label}: validates clean`, r.ok && errs.length === 0, JSON.stringify(errs));
    }
  }
  console.log(`  ${comp}: ${cat.length} commands`);
}

// Doc coverage: top-level <dt> in each "... messages" section of the release HTML.
const docsDir = process.env.AMARISOFT_DOCS_DIR;
const DOCS: Record<ComponentType, { file: string; start: string; end: string; skip: string[] }> = {
  ENB: { file: 'lteenb-2026-09-11/lteenb.html', start: 'id="Common-messages"', end: 'id="Remote-events"', skip: ['rrc_logged_meas_config'] },
  MME: { file: 'ltemme-2026-09-11/ltemme.html', start: 'id="Common-messages"', end: 'id="Positioning-messages"', skip: ['ue_modify_bearer', 'ue_modify_pdu_session', 'ue_modify_reflective_qos', 'non_ip_data', 'generic_nas_transport', '5gs_nas_transport', 'ursp_rules', 'reset_ue_pos_stored_info', 'cbc_notif_subscribe', 'cbc_notif_unsubscribe', 'n13', 'n13connect', 'n13disconnect', 'mbs_broadcast_session_setup', 'mbs_broadcast_session_release', 'mbs_tmgi_allocate', 'mbs_tmgi_deallocate'] },
  IMS: { file: 'ltemme-2026-09-11/lteims.html', start: 'id="Common-messages"', end: 'id="Remote-events"', skip: [] },
  UE: { file: 'lteue-2026-09-11/lteue.html', start: 'id="Common-messages"', end: 'id="Remote-events"', skip: [] },
  MBMS: { file: 'ltembmsgw-2026-09-11/ltembmsgw.html', start: 'id="Common-messages"', end: 'id="Log-file-format"', skip: [] },
  LICENSE: { file: 'ltelicense-2026-09-11/ltelicense.html', start: 'id="Common-messages"', end: 'id="Command-line-monitor-reference"', skip: [] },
};
function docMessages(html: string, start: string, end: string): string[] {
  const i = html.indexOf(start);
  const j = html.indexOf(end, i + 1);
  const seg = html.slice(i, j < 0 ? undefined : j);
  const out: string[] = [];
  let depth = 0;
  const re = /<(\/?)(dl|dt)\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(seg))) {
    if (m[2] === 'dl') depth += m[1] ? -1 : 1;
    else if (!m[1] && depth === 1) {
      const close = seg.indexOf('</dt>', m.index);
      const name = seg.slice(re.lastIndex, close).replace(/<[^>]+>/g, '').trim();
      if (/^[a-z0-9_]+$/.test(name)) out.push(name);
    }
  }
  return out;
}
if (docsDir && fs.existsSync(docsDir)) {
  for (const comp of COMPONENT_TYPES) {
    const d = DOCS[comp];
    const html = fs.readFileSync(path.join(docsDir, d.file), 'utf8');
    const documented = Array.from(new Set(docMessages(html, d.start, d.end)));
    const cat = new Set(getCatalogue(comp).map(c => c.message));
    const missing = documented.filter(x => !cat.has(x) && !d.skip.includes(x));
    // dl_sync is documented in lteenb 10.10 (DL synchronization), outside the messages sections.
    const extra = [...cat].filter(x => !documented.includes(x) && !(comp === 'ENB' && x === 'dl_sync'));
    check(`${comp}: every documented message is catalogued (or explicitly skipped)`, missing.length === 0, `missing: ${missing.join(', ')}`);
    check(`${comp}: no catalogued message absent from the docs`, extra.length === 0, `extra: ${extra.join(', ')}`);
    console.log(`  ${comp}: docs list ${documented.length}, catalogue ${cat.size}, intentionally skipped ${d.skip.length}`);
  }
} else {
  console.log('  (doc coverage skipped: set AMARISOFT_DOCS_DIR to the extracted 2026-09-11 doc folder)');
}

// ─────────────────────────────────────────────────────────────────────────────
section('2. Validation and danger rules');
const v = (body: unknown, component: ComponentType = 'ENB', serverVersion: string | null = V0911) => validateRequest(body, { component, serverVersion });
const hasErr = (r: ReturnType<typeof v>, path: string) => r.issues.some(i => i.level === 'error' && i.path === path);

check('cell_gain -20 ok, caution', v({ message: 'cell_gain', cell_id: 1, gain: -20 }).ok && v({ message: 'cell_gain', cell_id: 1, gain: -20 }).danger.level === 'caution');
check('cell_gain -201 rejected', hasErr(v({ message: 'cell_gain', cell_id: 1, gain: -201 }), 'gain'));
check('cell_gain +1 rejected', hasErr(v({ message: 'cell_gain', cell_id: 1, gain: 1 }), 'gain'));
check('cell_gain -200 allowed but destructive', v({ message: 'cell_gain', cell_id: 1, gain: -200 }).ok && v({ message: 'cell_gain', cell_id: 1, gain: -200 }).danger.level === 'destructive');
check('cell_gain "−20" string rejected', hasErr(v({ message: 'cell_gain', cell_id: 1, gain: '-20' }), 'gain'));
check('cell_gain missing cell_id rejected', hasErr(v({ message: 'cell_gain', gain: -10 }), 'cell_id'));
const muteAll = v([{ message: 'cell_gain', cell_id: 1, gain: -200 }, { message: 'cell_gain', cell_id: 2, gain: -200 }]);
check('batch muting 2 cells is destructive with a batch reason', muteAll.batch && muteAll.danger.level === 'destructive' && /Mutes 2 cells/.test(muteAll.danger.reasons[0]));
check('handover without pci rejected', hasErr(v({ message: 'handover', ran_ue_id: 1 }), 'pci'));
check('handover without ue id rejected', v({ message: 'handover', pci: 2, dl_earfcn: 3350 }).ok === false);
const hoAlias = v({ message: 'handover', enb_ue_id: 1, pci: 2, dl_earfcn: 1575 });
check('handover with enb_ue_id alias accepted (info)', hoAlias.ok && hoAlias.issues.some(i => i.level === 'info' && i.path === 'enb_ue_id'));
check('handover without dl_earfcn warns', v({ message: 'handover', ran_ue_id: 1, pci: 2 }).issues.some(i => i.level === 'warning' && i.path === 'dl_earfcn'));
check('handover bad type enum rejected', hasErr(v({ message: 'handover', ran_ue_id: 1, pci: 2, dl_earfcn: 1, type: 'x3' }), 'type'));
check('ncell_list_add eutra without cell_id rejected', hasErr(v({ message: 'ncell_list_add', cell_id: 1, ncell: { n_id_cell: 2, dl_earfcn: 1575 } }), 'ncell.cell_id'));
check('page_ue without imsi rejected', hasErr(v({ message: 'page_ue', type: 'normal', cell_id: [1] }), 'imsi'));
check('page_ue nr without imsi allowed', v({ message: 'page_ue', type: 'nr', cell_id: [1], '5g-s-tmsi': { amf_set_id: 1, amf_pointer: 0, '5g-tmsi': 1 } }).ok);
check('page_ue bad IMSI rejected', hasErr(v({ message: 'page_ue', type: 'normal', imsi: '12ab', cell_id: [1] }), 'imsi'));
check('rrc_cnx_reconf reconf_pucch_srs + scell list rejected', v({ message: 'rrc_cnx_reconf', enb_ue_id: 1, reconf_pucch_srs: true, eutra_secondary_cell_list: [] }).ok === false);
check('scells_act_deact activate must be int array', hasErr(v({ message: 'scells_act_deact', enb_ue_id: 1, activate: ['2'] }), 'activate[0]'));
check('sib_set bar cell is destructive', v({ message: 'sib_set', cells: { 1: { sib1: { cell_barred: true } } } }).danger.level === 'destructive');
check('sib_set bad hex payload rejected', v({ message: 'sib_set', cells: { 1: { sib3: { type: 'hex', payload: 'abc' } } } }).ok === false);
check('config_set logs only is safe', v({ message: 'config_set', logs: { layers: { PHY: { level: 'debug' } } } }).danger.level === 'safe');
check('config_set pdsch_mcs 29 rejected', hasErr(v({ message: 'config_set', cells: { 1: { pdsch_mcs: 29 } } }), 'cells.1.pdsch_mcs'));
check('config_set pdsch_mcs array ok', v({ message: 'config_set', cells: { 1: { pdsch_mcs: [-1, 5, 28, -1, -1, -1, -1, -1, -1, -1] } } }).ok);
check('config_set rrc filter reject is destructive', v({ message: 'config_set', cells: { 1: { rrc_procedure_filter: { rrc_connection_request: { action: 'reject' } } } } }).danger.level === 'destructive');
check('stats "Initial_delay" (old template key) flagged unknown', v({ message: 'stats', Initial_delay: 0.7 }).issues.some(i => i.level === 'warning' && i.path === 'Initial_delay'));
check('loop_count without loop_delay rejected', hasErr(v({ message: 'stats', loop_count: 3 }), 'loop_delay'));
check('loop_delay below 0.1 rejected', hasErr(v({ message: 'stats', loop_count: 3, loop_delay: 0.01 }), 'loop_delay'));
check('cancel on 2026-03-13 server rejected', hasErr(v({ message: 'cancel', group_id: 1 }, 'ENB', '2026-03-13'), 'message'));
check('cancel on 2026-06-12 server ok', v({ message: 'cancel', group_id: 1 }, 'ENB', V0612).ok);
check('group_id on 2026-03-13 server rejected', hasErr(v({ message: 'stats', group_id: 1 }, 'ENB', '2026-03-13'), 'group_id'));
check('ntn t_service on 2026-06-12 rejected', hasErr(v({ message: 'ntn_satellite_update', cell_id: 1, t_service: 0 }, 'ENB', V0612), 't_service'));
check('ntn t_service on 2026-09-11 ok', v({ message: 'ntn_satellite_update', cell_id: 1, t_service: 0 }, 'ENB', V0911).ok);
check('unknown server version does not block', v({ message: 'ntn_satellite_update', cell_id: 1, t_service: 0 }, 'ENB', null).ok);
check('quit is destructive everywhere', COMPONENT_TYPES.every(c => v({ message: 'quit' }, c).danger.level === 'destructive'));
check('MME ue_del destructive', v({ message: 'ue_del', imsi: '001010123456789' }, 'MME').danger.level === 'destructive');
check('MME ue_del needs imsi or nai', v({ message: 'ue_del' }, 'MME').ok === false);
const detachDefault = v({ message: 'ue_detach', imsi: '001010123456789' }, 'MME');
check('MME ue_detach default cause: warning + destructive (SIM lock)', detachDefault.ok && detachDefault.danger.level === 'destructive' && detachDefault.issues.some(i => i.path === 'cause' && i.level === 'warning'));
check('MME ue_detach cause -1 only caution', v({ message: 'ue_detach', imsi: '001010123456789', cause: -1 }, 'MME').danger.level === 'caution');
check('MME load_balancing_tau needs imsi', hasErr(v({ message: 'load_balancing_tau', imei: '35609204079301' }, 'MME'), 'imsi'));
check('MME config_set attach_reject_error destructive', v({ message: 'config_set', attach_reject_error: 15 }, 'MME').danger.level === 'destructive');
check('UE ue_del_all destructive', v({ message: 'ue_del_all' }, 'UE').danger.level === 'destructive');
check('UE ue_ntn_stats blocked on 2026-03-13', v({ message: 'ue_ntn_stats', ue_id: 1 }, 'UE', '2026-03-13').ok === false);
check('eNB message on MME is flagged', v({ message: 'cell_gain', cell_id: 1, gain: 0 }, 'MME').issues.some(i => /ENB message/.test(i.text)));
check('uncatalogued message warns and needs confirm', (() => { const r = v({ message: 'prof_dump' }); return r.ok && r.danger.level === 'caution'; })());
check('invalid body type rejected', v('x').ok === false && v([]).ok === false);
check('log_get layers level validated', hasErr(v({ message: 'log_get', layers: { PHY: 'verbose' } }), 'layers.PHY'));
check('timeoutForMessage: log_get waits beyond its timeout', timeoutForMessage({ message: 'log_get', timeout: 60 }, 60) >= 90);
check('timeoutForMessage: start_time adds delay', timeoutForMessage({ message: 'stats', start_time: 10 }, 60) === 70);

// ─────────────────────────────────────────────────────────────────────────────
section('4. Screen Monitor translation');
const lines: Array<[ComponentType, string, Record<string, unknown> | null]> = [
  ['ENB', 'cell_gain 1 -10', { message: 'cell_gain', cell_id: 1, gain: -10 }],
  ['ENB', 'cell_ul_disable 1 0', { message: 'cell_ul_disable', cell_id: 1, disabled: false }],
  ['ENB', 'handover 1 2 1575', { message: 'handover', ran_ue_id: 1, pci: 2, dl_earfcn: 1575 }],
  ['ENB', 't g', { message: 'stats' }],
  ['ENB', 't spl', { message: 'stats', samples: true }],
  ['ENB', 'tx_gain 60 0', { message: 'rf', tx_gain: 60, tx_channel_index: 0 }],
  ['ENB', 's1connect', { message: 's1connect' }],
  ['ENB', 'rrc_cnx_release 1', { message: 'rrc_cnx_release', ran_ue_id: 1 }],
  ['ENB', 'erab', { message: 'erab_get' }],
  ['ENB', 'cell_gain 1', null],
  ['MME', 'ue 001010123456789', { message: 'ue_get', imsi: '001010123456789' }],
  ['UE', 'power_off 1', { message: 'power_off', ue_id: 1 }],
  ['LICENSE', 'list', { message: 'list' }],
];
for (const [comp, line, expected] of lines) {
  const hit = resolveMonitorLine(comp, line);
  const built = hit?.cmd.toApi?.(hit.args);
  if (expected === null) {
    check(`monitor ${comp} "${line}" -> usage error`, typeof built === 'string');
  } else {
    check(`monitor ${comp} "${line}" -> ${JSON.stringify(expected)}`, JSON.stringify(built) === JSON.stringify(expected), JSON.stringify(built));
    check(`monitor ${comp} "${line}" validates`, validateRequest(built, { component: comp, serverVersion: V0911 }).ok);
  }
}
check('monitor "t g 2" resolves to t g with period arg', (() => { const h = resolveMonitorLine('ENB', 't g 2'); return h?.cmd.value === 't g' && h.args[0] === '2'; })());
check('monitor pcap is CLI-only', !!resolveMonitorLine('ENB', 'pcap -w x')?.cmd.cliOnly);
for (const comp of COMPONENT_TYPES) {
  for (const sec of getMonitorCommands(comp)) for (const c of sec.items) {
    if (!c.toApi || c.example?.includes('<')) continue;
    const built = c.toApi([]);
    if (typeof built === 'string') continue;
    check(`monitor ${comp} "${c.value}" (no args) validates`, validateRequest(built, { component: comp, serverVersion: V0911 }).ok, JSON.stringify(built));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function protocol() {
  section('3. Protocol against the mock server');
  const mockPath = path.join(__dirname, 'mock-remote-api.mjs');
  const { startMockServers } = await import(mockPath);
  const BASE = Number(process.env.QA_MOCK_BASE_PORT ?? 29100);
  const mock = await startMockServers({ basePort: BASE, version: V0911, maxConnections: { LICENSE: 1 } });
  const clients: WebSocketClient[] = [];
  const open = async (port: number, extra: Record<string, unknown> = {}) => {
    const c = new WebSocketClient({ server: '127.0.0.1', port, timeout: 10, ...extra });
    c.on('error', () => { /* surfaced through promises */ });
    clients.push(c);
    await c.connect();
    return c;
  };
  try {
    // Origin is mandatory.
    const noOrigin = await new Promise<string>((resolve) => {
      const raw = new WS(`ws://127.0.0.1:${mock.ports.ENB}`);
      raw.on('open', () => { resolve('open'); raw.close(); });
      raw.on('unexpected-response', (_req: any, res: any) => resolve(String(res.statusCode)));
      raw.on('error', () => resolve('error'));
    });
    check('handshake without Origin refused (403)', noOrigin === '403', noOrigin);

    const enb = await open(mock.ports.ENB);
    check('ready banner parsed', enb.serverInfo?.via === 'ready' && enb.serverInfo.type === 'ENB' && enb.serverInfo.version === V0911, JSON.stringify(enb.serverInfo));
    check('ready banner carries product/time/utc', typeof enb.serverInfo?.product === 'string' && typeof enb.serverInfo?.utc === 'number');

    const cfg = await enb.sendMessage({ message: 'config_get' });
    check('config_get response echoes message_id', typeof cfg.message_id === 'string' && cfg.message === 'config_get' && cfg.cells?.['1']);

    const unk = await enb.sendMessage({ message: 'bogus' }).then(() => null, (e) => e);
    check('unknown message -> RemoteAPIError with full response', unk instanceof RemoteAPIError && /Unknown message/.test(unk.message) && unk.response?.message === 'bogus');
    const mon = await enb.sendMessage({ message: 'monitor', data: 't g\n' }).then(() => null, (e) => e);
    check('legacy {message:"monitor"} is rejected (old Screen Monitor path was dead)', mon instanceof RemoteAPIError);

    const caller = { message: 'config_get' };
    await enb.sendMessage(caller);
    check('sendMessage does not mutate the caller object', !('message_id' in caller));

    await enb.sendMessage({ message: 'cell_gain', cell_id: 1, gain: -20 });
    check('cell_gain applied', mock.state.enb.cells[1].gain === -20);
    const outOfRange = await enb.sendMessage({ message: 'cell_gain', cell_id: 1, gain: -250 }).then(() => null, (e) => e);
    check('server-side range error surfaces', outOfRange instanceof RemoteAPIError && /between -200 and 0/.test(outOfRange.message));
    await enb.sendMessage({ message: 'cell_gain', cell_id: 1, gain: 0 });

    // Notification before response.
    const progress: any[] = [];
    const t0 = Date.now();
    const dump = await enb.sendMessage({ message: 'trx_iq_dump', duration: 200, rx_filename: '/tmp/rx%d.bin' }, { onProgress: (n) => progress.push({ n, at: Date.now() - t0 }) });
    check('trx_iq_dump notification does not resolve the request', progress.length === 1 && progress[0].n.notification === 'start' && Array.isArray(dump.rf_ports), JSON.stringify(progress));
    check('trx_iq_dump response has rx_files', dump.rf_ports?.[0]?.rx_files?.[0] === '/tmp/rx0.bin');

    // Handover needs ncell_list.
    const hoBefore = await enb.sendMessage({ message: 'handover', ran_ue_id: 1, pci: 2, dl_earfcn: 1575 }).then(() => null, (e) => e);
    check('handover before ncell_list_add fails', hoBefore instanceof RemoteAPIError && /ncell_list/.test(hoBefore.message));
    await enb.sendMessage({ message: 'ncell_list_add', cell_id: 1, ncell: { rat: 'eutra', n_id_cell: 2, dl_earfcn: 1575, cell_id: 0x1a2d002, tac: 1 } });
    await enb.sendMessage({ message: 'handover', enb_ue_id: 1, pci: 2, dl_earfcn: 1575 });
    check('handover (enb_ue_id alias) after ncell_list_add succeeds', mock.state.enb.ues[0].pcell === 2);
    await enb.sendMessage({ message: 'ncell_list_del', cell_id: 1, n_id_cell: 2, dl_arfcn: 1575 });
    check('ncell_list_del restores', mock.state.enb.cells[1].ncell_list.length === 0);

    const sc = await enb.sendMessage({ message: 'scells_act_deact', enb_ue_id: 1, activate: [2] }).then((r) => r, (e) => e);
    check('scells_act_deact returns scells/activated', Array.isArray(sc.activated), JSON.stringify(sc));
    const pageNoImsi = await enb.sendMessage({ message: 'page_ue', type: 'normal', cell_id: [1] }).then(() => null, (e) => e);
    check('page_ue without imsi: server error matches validator', pageNoImsi instanceof RemoteAPIError && /imsi/.test(pageNoImsi.message));

    // Batch frame.
    const batch = await enb.sendBatch([{ message: 'config_get' }, { message: 'nope' }, { message: 's1' }]);
    check('batch: per-message results in order', batch.length === 3 && batch[0].ok && !batch[1].ok && batch[2].ok);

    // Loops and delays.
    const loopProgress: any[] = [];
    const looped = await enb.sendMessage({ message: 's1', loop_count: 3, loop_delay: 0.1 }, { onProgress: (m) => loopProgress.push(m.loop_index) });
    check('loop_count 3: 2 progress frames then final response', loopProgress.join(',') === '0,1' && looped.loop_index === 2, `${loopProgress} final ${looped.loop_index}`);
    const d0 = Date.now();
    await enb.sendMessage({ message: 's1', start_time: 0.3 });
    check('start_time delays the response', Date.now() - d0 >= 280);

    // cancel with group_id
    const delayed = enb.sendMessage({ message: 's1', start_time: 5, group_id: 7 });
    await sleep(50);
    const cancelled = await enb.sendMessage({ message: 'cancel', group_id: 7 });
    const delayedResp = await delayed;
    check('cancel(group_id) answers the pending request with cancel:true', cancelled.cancelled === 1 && delayedResp.cancel === true);

    // log_get per connection.
    await sleep(900);
    const l1 = await enb.sendMessage({ message: 'log_get', min: 1, timeout: 0.2, allow_empty: true });
    const l2 = await enb.sendMessage({ message: 'log_get', min: 1, timeout: 0.2, allow_empty: true });
    const firstIdx = (l: any) => (l.logs?.length ? l.logs[0].idx : -1);
    const lastIdx = (l: any) => (l.logs?.length ? l.logs[l.logs.length - 1].idx : -1);
    check('log_get: second call on same connection only returns newer logs', l1.logs.length > 0 && (l2.logs.length === 0 || firstIdx(l2) > lastIdx(l1)), `${lastIdx(l1)} -> ${firstIdx(l2)}`);
    const enb2 = await open(mock.ports.ENB);
    const l3 = await enb2.sendMessage({ message: 'log_get', min: 1, timeout: 0.2, allow_empty: true });
    check('log_get: a new connection gets the buffered logs again', firstIdx(l3) <= firstIdx(l1));
    const lp0 = Date.now();
    const quiet = await enb2.sendMessage({ message: 'log_get', min: 1000, timeout: 0.3, allow_empty: true });
    check('log_get long-poll: holds until timeout, then answers', Date.now() - lp0 >= 250 && Array.isArray(quiet.logs));

    // Per-connection stats windows.
    const s1a = await enb.sendMessage({ message: 'stats', initial_delay: 0.1 });
    await sleep(300);
    await enb2.sendMessage({ message: 'stats', initial_delay: 0.1 });
    await sleep(200);
    const s2a = await enb.sendMessage({ message: 'stats' });
    check('eNB stats window is per connection', s1a.duration === 0.1 && s2a.duration >= 0.45, `${s1a.duration} / ${s2a.duration}`);

    // Events are not mistaken for responses.
    const events: any[] = [];
    enb.on('ue_measurement_report', (e) => events.push(e));
    await enb.sendMessage({ message: 'register', register: ['ue_measurement_report'] });
    await sleep(250);
    check('registered event delivered as an event', events.length === 1 && events[0].ran_ue_id === 1);

    // MME destructive semantics.
    const mme = await open(mock.ports.MME);
    check('MME banner type', mme.serverInfo?.type === 'MME');
    await mme.sendMessage({ message: 'ue_detach', imsi: '001010123456790' });
    check('ue_detach default cause invalidates the SIM (mock mirrors live finding)', mock.state.mme.ue_db.get('001010123456790').sim_invalid === true);
    await mme.sendMessage({ message: 'ue_del', imsi: '001010123456790' });
    const afterDel = await mme.sendMessage({ message: 'ue_get', imsi: '001010123456790' });
    check('ue_del removes the subscriber from ue_db', afterDel.ue_list.length === 0);
    const lbt = await mme.sendMessage({ message: 'load_balancing_tau', imsi: '001010123456789', imei: '35609204079301' }).then(() => true, () => false);
    check('load_balancing_tau {imsi, imei} ok', lbt);
    const mmeStats1 = await mme.sendMessage({ message: 'stats' });
    check('MME stats response shape', typeof mmeStats1.emm_registered_ue_count === 'number');

    // UE / IMS / MBMS / LICENSE basics.
    const ue = await open(mock.ports.UE);
    await ue.sendMessage({ message: 'power_off', ue_id: 1 });
    check('UE power_off', mock.state.ue.ues[0].power_on === false);
    const ims = await open(mock.ports.IMS);
    check('IMS users_get', Array.isArray((await ims.sendMessage({ message: 'users_get' })).users));
    const mbms = await open(mock.ports.MBMS);
    check('MBMS banner type MBMSGW', mbms.serverInfo?.type === 'MBMSGW');
    const lic = await open(mock.ports.LICENSE);
    check('LICENSE list', Array.isArray((await lic.sendMessage({ message: 'list' })).licenses));
    const tooMany = await open(mock.ports.LICENSE).then(() => null, (e) => e);
    check('server {message:"error"} before ready rejects connect', tooMany instanceof Error && /Too many connections/.test(tooMany.message), String(tooMany?.message));

    // Version-gated server: cancel unknown on 2026-03-13.
    const old = await startMockServers({ basePort: BASE + 100, version: '2026-03-13', components: ['ENB'] });
    try {
      const oldEnb = await open(old.ports.ENB);
      const r = await oldEnb.sendMessage({ message: 'cancel' }).then(() => null, (e) => e);
      check('2026-03-13 mock rejects cancel; validator blocks it for that version', r instanceof RemoteAPIError && !validateRequest({ message: 'cancel' }, { component: 'ENB', serverVersion: oldEnb.serverInfo?.version }).ok);
    } finally {
      await old.close();
    }

    // Authentication.
    const auth = await startMockServers({ basePort: BASE + 200, version: V0612, password: 's3cret', components: ['ENB'] });
    try {
      const bad = await open(auth.ports.ENB, { password: 'wrong' }).then(() => null, (e) => e);
      check('auth: wrong password rejected', bad instanceof Error && /Authentication failed/.test(bad.message), String(bad?.message));
      const none = await open(auth.ports.ENB).then(() => null, (e) => e);
      check('auth: missing password reported', none instanceof Error && /requires a password/.test(none.message));
      const good = await open(auth.ports.ENB, { password: 's3cret' });
      check('auth: HMAC-SHA256 accepted', good.isReady && good.serverInfo?.via === 'authenticate');
      await sleep(150);
      check('auth: version learned from config_get', good.serverInfo?.version === V0612, String(good.serverInfo?.version));

      // Insecure context: no crypto.subtle -> plaintext fallback, refused unless unsecure.
      const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
      let patched = false;
      try {
        Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (a: any) => a }, configurable: true, writable: true });
        patched = true;
      } catch { /* not patchable on this runtime */ }
      if (patched) {
        const plain = await open(auth.ports.ENB, { password: 's3cret' }).then(() => null, (e) => e);
        check('auth without WebCrypto: plaintext fallback refused with an actionable hint', plain instanceof Error && /unsecure/i.test(plain.message), String(plain?.message));
        if (desc) Object.defineProperty(globalThis, 'crypto', desc);
      }
    } finally {
      await auth.close();
    }

    // Monitor translations executed for real.
    for (const line of ['t g', 's1', 'rf_info', 'tx_gain 65 0', 'cell_gain 2 -3', 'erab']) {
      const hit = resolveMonitorLine('ENB', line)!;
      const built = hit.cmd.toApi!(hit.args) as any;
      const ok = await enb.sendMessage(built).then(() => true, () => false);
      check(`monitor line "${line}" executes on the mock`, ok);
    }

    // Server closes -> pending requests rejected.
    const quitter = await open(mock.ports.UE);
    const pending = quitter.sendMessage({ message: 'ue_get' }, { timeoutSec: 5 });
    await quitter.sendMessage({ message: 'quit' });
    await pending;
    const afterQuit = await new Promise<boolean>((resolve) => { quitter.once('disconnected', () => resolve(true)); setTimeout(() => resolve(false), 1000); });
    check('quit: server closes the connection, client notices', afterQuit);
  } finally {
    for (const c of clients) c.disconnect();
    await mock.close();
  }
}

protocol()
  .catch((e) => { fail++; failures.push(`protocol crashed: ${e?.stack ?? e}`); console.log(e); })
  .finally(() => {
    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) console.log(failures.map(f => `  - ${f}`).join('\n'));
    process.exit(fail ? 1 : 0);
  });

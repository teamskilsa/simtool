#!/usr/bin/env node
// Mock Amarisoft callbox remote API for offline Mobility Scenario and
// Pre-conformance tests.
//
//   node scripts/qa/mock-callbox.mjs [--rat lte|nr] [--cells 6] [--enb-port 19001] [--mme-port 19000]
//                                    [--no-ho-config] [--no-ca] [--intra-freq] [--tac-split]
//                                    [--reconnect-ms 1500] [--bar-delay-ms 1000]
//                                    [--ssh-port 19022 [--ssh-user root] [--ssh-pass mock]]
//
// One eNB/gNB (lteenb) and one MME/AMF (ltemme) WebSocket server, one
// simulated UE (IMSI 001010123456789). Mirrors the behaviour proven live on
// the CBX 2026-06-12 callbox, with shorter timings:
//   • Origin header required; greets with {"message":"ready"}; every reply
//     carries time and utc (callbox clock), like lteenb.
//   • --rat lte (default): config_get.cells (n_id_cell, dl_earfcn, ecgi…),
//     ue_get enb_ue_id/mme_ue_id.  --rat nr (SA): config_get.cells is empty and
//     config_get.nr_cells has n_id_nrcell, dl_nr_arfcn, ssb_nr_arfcn, ncgi,
//     connected_mobility.nr_handover_*; ue_get ran_ue_id/amf_ue_id; MME ue_get
//     rat_type NR with pdu_session_id bearers. The NR layout mirrors
//     testDemo-6cell-2x3CC-HO.cfg: two groups of three CA cells (1-3, 4-6),
//     each group in the other's ncell_list.
//   • --intra-freq: the second half of the cells reuses the first half's
//     frequencies (different PCI), so intra-frequency handover is possible.
//     --tac-split: the second half is TAC 2 (a handover there changes TA).
//   • handover {ran_ue_id, pci, dl_earfcn | ssb_nr_arfcn}: error "ARFCN X PCI Y
//     not found in Neighbour Cell List" unless the target is in the PCell
//     ncell_list; else two UE contexts for 300 ms, then one on the new PCell.
//     NR ignores dl_earfcn (like lteenb) and uses the current SSB.
//   • rrc_cnx_release: UE leaves the RAN (MME keeps it registered), comes back
//     after --reconnect-ms with fresh ids (mo-Data) — or earlier by paging when
//     downlink traffic is running (see SSH below).
//   • cell_gain [-200:0]; PCell ≤ -150 dB → RLF, RRC re-establishment on the
//     best other cell after 800 ms (mock_set reestMode "setup" makes the UE do a
//     fresh RRC setup instead). With the HO config, A3 (neighbour ≥ serving +
//     8 dB, neighbour in ncell_list) held 480 ms → Measurement report + handover.
//   • ncell_list_add / ncell_list_del; LTE barring with sib_set
//     cells.<id>.sib1.cell_barred, NR barring with config_set
//     cells.<id>.cell_barred (each rejects the other RAT, as the docs say).
//   • rrc_cnx_reconf eutra_secondary_cell_list (LTE) / nr_secondary_cell_list
//     (NR), a subset of the PCell scell_list; scells_act_deact → {scells, activated}.
//   • page_ue; log_get long-poll with realistic RRC / NAS / S1AP / NGAP entries
//     ({layer, dir, ue_id, timestamp, data:[first line, ASN.1…]}), only for
//     layers at debug level (config_set logs.layers).
//   • MME ue_get, load_balancing_tau (LTE only), ue_detach (only without a
//     cause IE — the mock refuses causes that would lock a SIM).
//   • --ssh-port: a tiny SSH server that understands SimTool's callbox traffic
//     commands (exec -a simtool-traffic-<id> iperf -u -c <ue> …, kill, pkill),
//     so traffic steps and their teardown can be tested end to end. While DL
//     traffic runs and the UE is idle, it is paged and comes back (mt-Access).
// Control messages (not Amarisoft), on the eNB port:
//   {"message":"mock_state"}                       → internal state
//   {"message":"mock_ue","action":"power_off"|"power_on"} → what the operator does to the phone
//   {"message":"mock_set", reestMode?, reconnectMs?} → change behaviour at run time
import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const flag = name => args.includes(`--${name}`);

const RAT = opt('rat', 'lte') === 'nr' ? 'nr' : 'lte';
const NR = RAT === 'nr';
const N_CELLS = Number(opt('cells', 6));
const ENB_PORT = Number(opt('enb-port', 19001));
const MME_PORT = Number(opt('mme-port', 19000));
const HO_CONFIG = !flag('no-ho-config');
const NO_CA = flag('no-ca');
const INTRA = flag('intra-freq');
const TAC_SPLIT = flag('tac-split');
let RECONNECT_MS = Number(opt('reconnect-ms', 1500));
const BAR_DELAY_MS = Number(opt('bar-delay-ms', 1000));
const IMSI = opt('imsi', '001010123456789');
const SSH_PORT = opt('ssh-port', '') ? Number(opt('ssh-port')) : 0;
const SSH_USER = opt('ssh-user', 'root');
const SSH_PASS = opt('ssh-pass', 'mock');
const QUIET = flag('quiet');
let reestMode = 'reestablish';

const log = (...a) => { if (!QUIET) console.log(new Date().toISOString().slice(11, 23), ...a); };
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;

// ── Cells ────────────────────────────────────────────────────────────────────
// LTE: the live 6-cell layout, repeated for 12. NR: testDemo-6cell-2x3CC-HO.
const LTE_LAYOUT = [
  { arfcn: 3350, band: 7 }, { arfcn: 2850, band: 7 },
  { arfcn: 1575, band: 3 }, { arfcn: 1300, band: 3 },
  { arfcn: 500, band: 1 }, { arfcn: 100, band: 1 },
];
const NR_LAYOUT = [622668, 628002, 633336, 638670, 644004, 649338].map(a => ({ arfcn: a, ssb: a - 12, band: 78 }));
const ENB_ID = 0x1a2d0;
const half = Math.ceil(N_CELLS / 2);
const layoutOf = i => {
  // --intra-freq: cell i in the second half sits on cell (i - half)'s frequency.
  const j = INTRA && i > half ? i - half : i;
  const L = NR ? NR_LAYOUT : LTE_LAYOUT;
  const l = L[(j - 1) % L.length];
  const bump = j > L.length ? 10 : 0;
  return { arfcn: l.arfcn + bump, ssb: l.ssb !== undefined ? l.ssb + bump : undefined, band: l.band };
};
const cells = new Map();
for (let i = 1; i <= N_CELLS; i++) {
  const l = layoutOf(i);
  const group = NR ? (i <= half ? 0 : 1) : 0;
  cells.set(i, {
    id: i, pci: NR ? 400 + 100 * i : i, earfcn: l.arfcn, ssb: l.ssb, band: l.band, gain: 0, barred: false, barredEffective: false,
    eci: NR ? (ENB_ID << 12) | i : (ENB_ID << 8) | i, tac: TAC_SPLIT && i > half ? 2 : 1, plmn: '00101',
    ncells: [], scells: [], group,
  });
}
const freqOf = c => (NR ? c.ssb : c.earfcn);
for (const c of cells.values()) {
  let nbrs;
  if (NR) nbrs = [...cells.values()].filter(o => o.group !== c.group).map(o => o.id);              // cross-group, as in the 2x3CC config
  else nbrs = [c.id - 1, c.id + 1].filter(n => n >= 1 && n <= N_CELLS);                            // adjacent ids only
  if (INTRA) { const twin = c.id > half ? c.id - half : c.id + half; if (cells.has(twin) && !nbrs.includes(twin)) nbrs.push(twin); }
  c.ncells = nbrs.map(n => { const o = cells.get(n); return { cell_id: o.id, n_id_cell: o.pci, arfcn: freqOf(o) }; });
  if (!NO_CA) {
    c.scells = NR
      ? [...cells.values()].filter(o => o.group === c.group && o.id !== c.id && Math.abs(o.id - c.id) < 3).map(o => o.id).slice(0, 2)
      : [((c.id) % N_CELLS) + 1, ((c.id + 1) % N_CELLS) + 1].filter(x => x !== c.id);
  }
}
const logLevels = {
  enb: { phy: 'warn', mac: 'warn', rrc: 'warn', s1ap: 'warn', ngap: 'warn', nas: 'warn' },
  mme: { nas: 'warn', s1ap: 'warn', ngap: 'warn', gtpu: 'warn' },
};

// ── Message names, as lteenb/ltemme print them in the first log line ────────
const CH = NR ? { ccch: 'CCCH-NR', dcch: 'DCCH-NR', pcch: 'PCCH-NR' } : { ccch: 'CCCH', dcch: 'DCCH', pcch: 'PCCH' };
const RRC = NR ? {
  setupReq: 'RRC setup request', setup: 'RRC setup', setupCpl: 'RRC setup complete',
  reconf: 'RRC reconfiguration', reconfCpl: 'RRC reconfiguration complete', release: 'RRC release',
  reestReq: 'RRC reestablishment request', reest: 'RRC reestablishment', reestCpl: 'RRC reestablishment complete',
} : {
  setupReq: 'RRC connection request', setup: 'RRC connection setup', setupCpl: 'RRC connection setup complete',
  reconf: 'RRC connection reconfiguration', reconfCpl: 'RRC connection reconfiguration complete', release: 'RRC connection release',
  reestReq: 'RRC connection reestablishment request', reest: 'RRC connection reestablishment', reestCpl: 'RRC connection reestablishment complete',
};
const MM = NR ? '5GMM' : 'EMM';
const SM = NR ? '5GSM' : 'ESM';
const CN_AP = NR ? 'ngap' : 's1ap';

// ── UE ───────────────────────────────────────────────────────────────────────
let nextEnbUeId = 1;
let nextMmeUeId = 100;
const ue = {
  imsi: IMSI, imeisv: '8665300412345601', ip: '192.168.2.2', registered: true, poweredOn: true, m_tmsi: 0x12345678, tac: 1,
  contexts: [], // [{enb_ue_id, mme_ue_id, rnti, pcell, scells, activated}]
  mme_ue_id: undefined,
  ecgiCell: 1,
};
const newContext = (pcell, mmeUeId) => {
  const c = cells.get(pcell);
  return { enb_ue_id: nextEnbUeId++, mme_ue_id: mmeUeId, rnti: 0x46 + nextEnbUeId, pcell, scells: [...c.scells], activated: [...c.scells] };
};
const current = () => ue.contexts[ue.contexts.length - 1];
const bestCell = (exclude = []) => [...cells.values()]
  .filter(c => !c.barredEffective && !exclude.includes(c.id) && c.gain > -150)
  .sort((a, b) => b.gain - a.gain || a.id - b.id)[0];

// ── Logs (per-connection long-poll) ──────────────────────────────────────────
const logSubscribers = new Set();
let logIdx = 0;
/** One Amarisoft log entry: first line + body lines (decoded ASN.1 / NAS). */
function emitLog(target, layer, dir, lines, ueId) {
  const lvl = logLevels[target][layer] ?? 'warn';
  if (lvl !== 'debug') return; // RRC/NAS/S1AP content only at debug level, like lteenb
  const data = Array.isArray(lines) ? lines : [lines];
  const entry = { target, layer: layer.toUpperCase(), level: 'debug', dir, timestamp: Date.now(), data, ue_id: ueId, src: target.toUpperCase(), idx: logIdx++ };
  for (const s of logSubscribers) if (s.target === target) s.push(entry);
}
const rrc = (dir, ch, name, body = [], ueId) => emitLog('enb', 'rrc', dir, [`${ch}: ${name}`, ...(body.length ? ['{', ...body.map(b => `  ${b}`), '}'] : [])], ueId);
const nas = (dir, name, body = []) => emitLog('mme', 'nas', dir, [name, ...body.map(b => `  ${b}`)], ue.mme_ue_id);
const cnap = (dir, name, body = []) => emitLog('mme', CN_AP, dir, [name, ...body.map(b => `  ${b}`)], ue.mme_ue_id);

/** RRC connection set-up on `pcell`, then the NAS that brought the UE there. */
function connect(pcell, cause = 'mo-Data', nasKind = 'service') {
  ue.mme_ue_id = nextMmeUeId++;
  ue.contexts = [newContext(pcell, ue.mme_ue_id)];
  ue.ecgiCell = pcell;
  const id = ue.contexts[0].enb_ue_id;
  // Air-interface timing, roughly as on the live box: Msg3 → Msg4 → Msg5.
  const at = (ms, fn) => (ms ? setTimeout(fn, ms) : fn());
  rrc('UL', CH.ccch, RRC.setupReq, [NR ? `rrcSetupRequest: { ue-Identity randomValue '0'H, establishmentCause ${cause} }` : `rrcConnectionRequest: { ue-Identity randomValue '0'H, establishmentCause ${cause} }`], id);
  at(6, () => rrc('DL', CH.ccch, RRC.setup, [], id));
  at(24 + Math.round(Math.random() * 8), () => {
    rrc('UL', CH.dcch, RRC.setupCpl, [NR ? 'selectedPLMN-Identity 1, dedicatedNAS-Message' : 'selectedPLMN-Identity 1, dedicatedInfoNAS'], id);
    emitLog('enb', CN_AP, 'TO', ['Initial UE message'], id);
    cnap('FROM', 'Initial UE message');
    if (nasKind === 'service') {
      nas('UL', `${MM}: Service request`, [NR ? 'Service type: data' : 'KSI and sequence number']);
      if (NR) nas('DL', `${MM}: Service accept`);
    } else if (nasKind === 'tau') {
      nas('UL', `${MM}: Tracking area update request`, ['EPS update type: TA updating']);
      nas('DL', `${MM}: Tracking area update accept`);
    } else if (nasKind === 'attach') {
      registrationFlow();
    }
    rrc('DL', CH.dcch, 'Security mode command', [], id);
    rrc('UL', CH.dcch, 'Security mode complete', [], id);
    rrc('DL', CH.dcch, RRC.reconf, ['radioBearerConfig / drb-ToAddModList'], id);
    rrc('UL', CH.dcch, RRC.reconfCpl, [], id);
  });
  log(`UE connected on cell ${pcell} (${cause}) enb_ue_id=${id} mme_ue_id=${ue.mme_ue_id}`);
}

function registrationFlow() {
  if (NR) {
    nas('UL', '5GMM: Registration request', ['5GS registration type: initial registration', '5GS mobile identity: SUCI']);
    nas('DL', '5GMM: Authentication request');
    nas('UL', '5GMM: Authentication response');
    nas('DL', '5GMM: Security mode command');
    nas('UL', '5GMM: Security mode complete');
    nas('DL', '5GMM: Registration accept', ['5GS registration result: 3GPP access']);
    nas('UL', '5GMM: Registration complete');
    nas('UL', '5GSM: PDU session establishment request', ['PDU session ID: 1']);
    nas('DL', '5GSM: PDU session establishment accept', [`PDU address: IPv4 ${ue.ip}`]);
  } else {
    nas('UL', 'EMM: Attach request', ['EPS attach type: EPS attach', 'ESM message container: PDN connectivity request']);
    nas('DL', 'EMM: Authentication request');
    nas('UL', 'EMM: Authentication response');
    nas('DL', 'EMM: Security mode command');
    nas('UL', 'EMM: Security mode complete');
    nas('DL', 'EMM: Attach accept', [`ESM message container: Activate default EPS bearer context request, PDN address ${ue.ip}`]);
    nas('UL', 'EMM: Attach complete', ['ESM message container: Activate default EPS bearer context accept']);
  }
  ue.registered = true;
}

let reconnectTimer = null;
const scheduleReconnect = (ms, prefer) => {
  clearTimeout(reconnectTimer);
  if (!ue.poweredOn) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!ue.poweredOn || ue.contexts.length) return;
    const p = prefer && cells.get(prefer) && !cells.get(prefer).barredEffective && cells.get(prefer).gain > -150 ? cells.get(prefer) : bestCell();
    if (!p) { log('no suitable cell to reconnect'); return; }
    connect(p.id, 'mo-Data', 'service');
  }, ms);
};
connect(1);
let lastPcell = 1;

// ── Paging: DL data for an idle UE ──────────────────────────────────────────
const traffic = new Map(); // tag → {pid, ip, bitrate, stop}
let pagingTimer = null;
setInterval(() => {
  if (!traffic.size || !ue.poweredOn || !ue.registered || ue.contexts.length || pagingTimer) return;
  pagingTimer = setTimeout(() => {
    pagingTimer = null;
    if (ue.contexts.length || !traffic.size) return;
    const p = cells.get(lastPcell) && !cells.get(lastPcell).barredEffective && cells.get(lastPcell).gain > -150 ? cells.get(lastPcell) : bestCell();
    if (!p) return;
    cnap('TO', 'Paging', [NR ? 'UE paging identity: 5G-S-TMSI' : 'UE paging identity: S-TMSI']);
    rrc('DL', CH.pcch, 'Paging', [NR ? `pagingRecordList { ue-Identity ng-5G-S-TMSI '${ue.m_tmsi.toString(16)}'H }` : `pagingRecordList { ue-Identity s-TMSI { m-TMSI '${ue.m_tmsi.toString(16)}'H }, cn-Domain ps }`]);
    clearTimeout(reconnectTimer); reconnectTimer = null;
    setTimeout(() => { if (!ue.contexts.length) { connect(p.id, 'mt-Access', 'service'); log('paged → reconnected'); } }, 120);
  }, 250);
}, 100);

// ── Handover / RLF / measurement ─────────────────────────────────────────────
const inNcellList = (src, target) => cells.get(src).ncells.some(n => n.n_id_cell === target.pci && n.arfcn === freqOf(target));
let hoBusy = false;
function mobilityBody(target) {
  return NR
    ? ['message c1: rrcReconfiguration: {', '  nonCriticalExtension masterCellGroup: {', '    spCellConfig {', '      reconfigurationWithSync {',
      `        spCellConfigCommon { physCellId ${target.pci}, downlinkConfigCommon { frequencyInfoDL { absoluteFrequencySSB ${target.ssb} } } },`,
      "        newUE-Identity '4601'H, t304 ms1000", '      }', '    }', '  }', '}']
    : ['message c1: rrcConnectionReconfiguration: {', '  mobilityControlInfo {', `    targetPhysCellId ${target.pci},`,
      `    carrierFreq { dl-CarrierFreq ${target.earfcn} },`, '    t304 ms1000,', "    newUE-Identity '4601'H", '  }', '}'];
}
function doHandover(targetId, cause) {
  const cur = current();
  if (!cur || hoBusy) return;
  hoBusy = true;
  const target = cells.get(targetId);
  const srcTac = cells.get(cur.pcell).tac;
  setTimeout(() => {
    const tgtCtx = newContext(targetId, ue.mme_ue_id);
    ue.contexts = [cur, tgtCtx]; // two contexts briefly
    rrc('DL', CH.dcch, RRC.reconf, mobilityBody(target), cur.enb_ue_id);
    // The UE's complete reaches the target cell ~40 ms later; the source
    // context lingers until the UE context release, as on the live box.
    setTimeout(() => rrc('UL', CH.dcch, RRC.reconfCpl, [], tgtCtx.enb_ue_id), 40);
    setTimeout(() => {
      ue.contexts = [tgtCtx];
      lastPcell = targetId;
      hoBusy = false;
      log(`${cause} handover ${cur.pcell} → ${targetId} (ue id ${cur.enb_ue_id} → ${tgtCtx.enb_ue_id})`);
      if (target.tac !== srcTac) {
        // Entered a TA outside the registration area: registration update / TAU.
        setTimeout(() => {
          if (NR) {
            nas('UL', '5GMM: Registration request', ['5GS registration type: mobility registration updating']);
            nas('DL', '5GMM: Registration accept');
            nas('UL', '5GMM: Registration complete');
          } else {
            nas('UL', 'EMM: Tracking area update request', ['EPS update type: TA updating']);
            nas('DL', 'EMM: Tracking area update accept');
          }
          ue.tac = target.tac;
        }, 150);
      }
    }, 300);
  }, 150);
}

let a3Since = null;
let rlfTimer = null;
setInterval(() => {
  const cur = current();
  if (!cur || hoBusy || ue.contexts.length !== 1) { a3Since = null; return; }
  const serving = cells.get(cur.pcell);
  if (serving.gain <= -150) {
    if (!rlfTimer) {
      rlfTimer = setTimeout(() => {
        rlfTimer = null;
        const c = current();
        if (!c || cells.get(c.pcell).gain > -150) return;
        const target = bestCell([c.pcell]);
        if (!target) { ue.contexts = []; ue.mme_ue_id = undefined; log('RLF with no other cell: UE lost'); return; }
        if (reestMode === 'setup') {
          // The UE gives up on its context and starts over (a legal outcome).
          ue.contexts = [];
          connect(target.id, 'mo-Signalling', 'service');
          lastPcell = target.id;
          log(`RLF on cell ${c.pcell} → fresh RRC setup on ${target.id}`);
          return;
        }
        rrc('UL', CH.ccch, RRC.reestReq, [`reestablishmentCause otherFailure, physCellId ${cells.get(c.pcell).pci}`], c.enb_ue_id);
        const n = newContext(target.id, ue.mme_ue_id);
        ue.contexts = [n];
        lastPcell = target.id;
        rrc('DL', NR ? CH.dcch : CH.ccch, RRC.reest, [], n.enb_ue_id);
        setTimeout(() => rrc('UL', CH.dcch, RRC.reestCpl, [], n.enb_ue_id), 25);
        log(`RLF on cell ${c.pcell} → re-established on ${target.id}`);
      }, 800);
    }
    a3Since = null;
    return;
  }
  if (!HO_CONFIG) return;
  const cand = [...cells.values()]
    .filter(c => c.id !== serving.id && inNcellList(serving.id, c) && c.gain >= serving.gain + 6 + 2)
    .sort((a, b) => b.gain - a.gain)[0];
  if (!cand) { a3Since = null; return; }
  if (a3Since === null) a3Since = { t: Date.now(), cell: cand.id };
  if (a3Since.cell !== cand.id) a3Since = { t: Date.now(), cell: cand.id };
  if (Date.now() - a3Since.t >= 480) {
    rrc('UL', CH.dcch, 'Measurement report', [`measId 3 (eventA3), servingCell pci ${serving.pci} rsrp ${Math.round(serving.gain) + 100}`, `neighbour pci ${cand.pci} rsrp ${Math.round(cand.gain) + 100}`], cur.enb_ue_id);
    a3Since = null;
    doHandover(cand.id, 'measurement');
  }
}, 200);

// ── Power (operator actions simulated by the QA script) ──────────────────────
function powerOff() {
  if (!ue.poweredOn) return;
  clearTimeout(reconnectTimer); reconnectTimer = null;
  const cur = current();
  if (!cur) { // idle: RRC set-up just to send the detach
    const p = bestCell();
    if (p) { ue.mme_ue_id = nextMmeUeId++; ue.contexts = [newContext(p.id, ue.mme_ue_id)]; }
  }
  nas('UL', NR ? '5GMM: Deregistration request (UE originating)' : 'EMM: Detach request', [NR ? 'De-registration type: switch off, 3GPP access' : 'Detach type: switch off, EPS detach']);
  cnap('TO', 'UE context release command', ['cause nas: detach']);
  const id = current()?.enb_ue_id;
  rrc('DL', CH.dcch, RRC.release, [], id);
  ue.contexts = []; ue.mme_ue_id = undefined; ue.registered = false; ue.poweredOn = false;
  log('UE powered off (switch-off detach)');
}
function powerOn() {
  if (ue.poweredOn) return;
  ue.poweredOn = true;
  setTimeout(() => {
    const p = bestCell();
    if (!p) { log('power on: no cell'); return; }
    connect(p.id, 'mo-Signalling', 'attach');
    lastPcell = p.id;
    log('UE powered on → registered');
  }, 300);
}

// ── eNB API ─────────────────────────────────────────────────────────────────
function enbConfig() {
  const out = {};
  for (const c of cells.values()) {
    const common = {
      n_antenna_dl: 2, n_antenna_ul: 1, gain: c.gain, band: c.band, tac: c.tac, cell_barred: c.barred,
      scell_list: c.scells.map(id => ({ cell_id: id, ul_allowed: false, cross_carrier_scheduling: false })),
    };
    out[String(c.id)] = NR ? {
      ...common, n_id_nrcell: c.pci, dl_nr_arfcn: c.earfcn, ul_nr_arfcn: c.earfcn, ssb_nr_arfcn: c.ssb, dl_mu: 1, ul_mu: 1, ssb_mu: 1, mode: 'TDD', n_rb_dl: 273,
      ncgi: { plmn: c.plmn, nci: c.eci },
      ...(HO_CONFIG ? { connected_mobility: { scell_config_a4_a2: false, scell_config_a6: false, nr_handover_intra: true, nr_handover_inter: true, nr_handover_location_based: false, nr_conditional_handover: false, eutra_handover: false, eutra_cell_redirect: false } } : {}),
      ncell_list: c.ncells.map(n => ({ rat: 'nr', cell_id: n.cell_id, n_id_nrcell: n.n_id_cell, ssb_nr_arfcn: n.arfcn, handover_target: true })),
    } : {
      ...common, n_id_cell: c.pci, dl_earfcn: c.earfcn, mode: 'FDD', n_rb_dl: 50,
      ecgi: { plmn: c.plmn, eci: c.eci },
      ...(HO_CONFIG ? { connected_mobility: { scell_config_a4_a2: false, scell_config_a6: false, eutra_handover_intra: true, eutra_handover_inter: true, eutra_cell_redirect_intra: false, eutra_cell_redirect_inter: false, nr_handover: false, nr_cell_redirect: false, en_dc_setup: false } } : {}),
      ncell_list: c.ncells.map(n => ({ rat: 'eutra', dl_earfcn: n.arfcn, n_id_cell: n.n_id_cell, handover_target: true, cell_redirect_target: false })),
    };
  }
  return {
    type: 'ENB', name: 'MOCK-ENB',
    logs: { layers: Object.fromEntries(Object.entries(logLevels.enb).map(([k, v]) => [k, { level: v, max_size: 0 }])), count: logIdx },
    cells: NR ? {} : out, nr_cells: NR ? out : {},
  };
}

const need = (m, ...fields) => { for (const f of fields) if (m[f] === undefined) throw new Error(`Missing field: ${f}`); };
const findUe = id => ue.contexts.find(c => c.enb_ue_id === Number(id));
const ueIdKey = NR ? 'ran_ue_id' : 'enb_ue_id';
const cnIdKey = NR ? 'amf_ue_id' : 'mme_ue_id';

function handleEnb(m) {
  switch (m.message) {
    case 'config_get': return enbConfig();
    case 'config_set': {
      for (const [layer, cfg] of Object.entries(m.logs?.layers ?? {})) {
        if (layer === 'all') { for (const k of Object.keys(logLevels.enb)) logLevels.enb[k] = cfg.level; continue; }
        if (!(layer in logLevels.enb)) throw new Error(`Unknown log layer: ${layer}`);
        if (cfg.level) logLevels.enb[layer] = cfg.level;
      }
      for (const [id, cfg] of Object.entries(m.cells ?? {})) {
        const c = cells.get(Number(id));
        if (!c) throw new Error(`Unknown cell_id: ${id}`);
        if ('cell_barred' in cfg) {
          if (!NR) throw new Error('cell_barred: only applicable to NR cells (use sib_set)');
          const v = cfg.cell_barred;
          if (![true, false, 'auto'].includes(v)) throw new Error('cell_barred: invalid value');
          c.barred = v;
          setTimeout(() => { c.barredEffective = v === true; }, v === true ? BAR_DELAY_MS : 0);
          log(`NR cell ${id} barred=${v}`);
        }
      }
      return {};
    }
    case 'ue_get':
      return { ue_list: ue.contexts.map(c => ({ [ueIdKey]: c.enb_ue_id, ...(c.mme_ue_id !== undefined ? { [cnIdKey]: c.mme_ue_id } : {}), rnti: c.rnti, cells: [c.pcell, ...c.scells].map(cell_id => ({ cell_id })) })) };
    case 'handover': {
      need(m, 'ran_ue_id', 'pci');
      const cur = findUe(m.ran_ue_id);
      if (!cur) throw new Error(`Unknown UE id: ${m.ran_ue_id}`);
      const src = cells.get(cur.pcell);
      const f = NR ? (m.ssb_nr_arfcn ?? src.ssb) : (m.dl_earfcn ?? src.earfcn);
      const target = [...cells.values()].find(c => c.pci === Number(m.pci) && freqOf(c) === Number(f));
      if (!target || !inNcellList(src.id, target)) throw new Error(`ARFCN ${f} PCI ${m.pci} not found in Neighbour Cell List`);
      if (hoBusy || ue.contexts.length > 1) throw new Error('Handover already in progress');
      doHandover(target.id, 'API');
      return {};
    }
    case 'rrc_cnx_release': {
      need(m, 'ran_ue_id');
      const cur = findUe(m.ran_ue_id);
      if (!cur) throw new Error(`Unknown UE id: ${m.ran_ue_id}`);
      const prev = cur.pcell;
      lastPcell = prev;
      rrc('DL', CH.dcch, RRC.release, [NR ? 'rrcRelease: { suspendConfig absent }' : 'rrcConnectionRelease: { releaseCause other }'], cur.enb_ue_id);
      emitLog('enb', CN_AP, 'TO', ['UE context release request'], cur.enb_ue_id);
      setTimeout(() => { ue.contexts = []; ue.mme_ue_id = undefined; log('RRC released'); scheduleReconnect(RECONNECT_MS, prev); }, 50);
      return {};
    }
    case 'cell_gain': {
      need(m, 'cell_id', 'gain');
      const c = cells.get(Number(m.cell_id));
      if (!c) throw new Error(`Unknown cell_id: ${m.cell_id}`);
      const g = Number(m.gain);
      if (!(g >= -200 && g <= 0)) throw new Error('gain: range is [-200:0]');
      c.gain = g;
      return {};
    }
    case 'ncell_list_add': {
      need(m, 'cell_id', 'ncell');
      const c = cells.get(Number(m.cell_id));
      if (!c) throw new Error(`Unknown cell_id: ${m.cell_id}`);
      let entry;
      if (NR || m.ncell.rat === 'nr') {
        const o = m.ncell.cell_id !== undefined ? cells.get(Number(m.ncell.cell_id)) : [...cells.values()].find(x => x.pci === m.ncell.n_id_cell);
        if (!o) throw new Error('ncell: unknown NR cell');
        entry = { cell_id: o.id, n_id_cell: o.pci, arfcn: freqOf(o) };
      } else {
        if (m.ncell.n_id_cell === undefined) throw new Error('Missing field: ncell.n_id_cell');
        const dl = m.ncell.dl_earfcn ?? c.earfcn;
        const o = [...cells.values()].find(x => x.pci === m.ncell.n_id_cell && x.earfcn === dl);
        entry = { cell_id: o?.id, n_id_cell: m.ncell.n_id_cell, arfcn: dl };
      }
      if (c.ncells.some(n => n.n_id_cell === entry.n_id_cell && n.arfcn === entry.arfcn)) throw new Error('Neighbour cell already present');
      c.ncells.push(entry);
      log(`ncell_list_add cell ${c.id} += PCI ${entry.n_id_cell}/${entry.arfcn}`);
      return {};
    }
    case 'ncell_list_del': {
      need(m, 'cell_id', 'n_id_cell');
      const c = cells.get(Number(m.cell_id));
      if (!c) throw new Error(`Unknown cell_id: ${m.cell_id}`);
      const dl = m.dl_arfcn ?? freqOf(c);
      const before = c.ncells.length;
      c.ncells = c.ncells.filter(n => !(n.n_id_cell === m.n_id_cell && n.arfcn === dl));
      if (c.ncells.length === before) throw new Error('Neighbour cell not found');
      log(`ncell_list_del cell ${c.id} -= PCI ${m.n_id_cell}/${dl}`);
      return {};
    }
    case 'sib_set': {
      need(m, 'cells');
      for (const [id, cfg] of Object.entries(m.cells)) {
        const c = cells.get(Number(id));
        if (!c) throw new Error(`Unknown cell_id: ${id}`);
        if (cfg.sib1 && 'cell_barred' in cfg.sib1) {
          if (NR) throw new Error('cell_barred: only applicable to LTE or NB-IoT cells (use config_set for NR)');
          const v = cfg.sib1.cell_barred;
          if (![true, false, 'auto'].includes(v)) throw new Error('cell_barred: invalid value');
          c.barred = v;
          setTimeout(() => { c.barredEffective = v === true; }, v === true ? BAR_DELAY_MS : 0);
          log(`cell ${id} barred=${v}`);
        }
      }
      return {};
    }
    case 'rrc_cnx_reconf': {
      need(m, 'enb_ue_id');
      const cur = findUe(m.enb_ue_id);
      if (!cur) throw new Error(`Unknown UE id: ${m.enb_ue_id}`);
      if (m.eutra_secondary_cell_list && m.nr_secondary_cell_list) throw new Error('eutra_secondary_cell_list and nr_secondary_cell_list are exclusive');
      const list = NR ? m.nr_secondary_cell_list : m.eutra_secondary_cell_list;
      if ((NR && m.eutra_secondary_cell_list) || (!NR && m.nr_secondary_cell_list)) throw new Error(`${NR ? 'eutra' : 'nr'}_secondary_cell_list: UE PCell is not ${NR ? 'LTE' : 'NR'}`);
      if (list) {
        const allowed = cells.get(cur.pcell).scells;
        const ids = list.map(s => Number(s.cell_id));
        for (const id of ids) if (!allowed.includes(id)) throw new Error(`cell_id ${id} is not in PCell scell_list`);
        const removed = cur.scells.filter(x => !ids.includes(x));
        const added = ids.filter(x => !cur.scells.includes(x));
        setTimeout(() => { cur.scells = ids; cur.activated = cur.activated.filter(x => ids.includes(x)).concat(ids.filter(x => !cur.activated.includes(x))); }, 120);
        const body = [];
        if (removed.length) body.push(`sCellToReleaseList { ${removed.map(x => `sCellIndex ${cur.scells.indexOf(x) + 1}`).join(', ')} }`);
        if (added.length) body.push(`sCellToAddModList { ${added.map(x => `{ sCellIndex ${ids.indexOf(x) + 1}, physCellId ${cells.get(x).pci} }`).join(', ')} }`);
        rrc('DL', CH.dcch, RRC.reconf, body.length ? body : ['no change'], cur.enb_ue_id);
        setTimeout(() => rrc('UL', CH.dcch, RRC.reconfCpl, [], cur.enb_ue_id), 30);
      }
      return {};
    }
    case 'scells_act_deact': {
      need(m, 'enb_ue_id');
      const cur = findUe(m.enb_ue_id);
      if (!cur) throw new Error(`Unknown UE id: ${m.enb_ue_id}`);
      for (const id of m.deactivate ?? []) cur.activated = cur.activated.filter(x => x !== Number(id));
      for (const id of m.activate ?? []) if (cur.scells.includes(Number(id)) && !cur.activated.includes(Number(id))) cur.activated.push(Number(id));
      return { scells: [...cur.scells], activated: [...cur.activated] };
    }
    case 'page_ue': {
      need(m, 'type', 'cell_id');
      if (m.type === 'normal') need(m, 'cn_domain', 'imsi');
      if (!Array.isArray(m.cell_id)) throw new Error('cell_id must be an array');
      return {};
    }
    case 'log_get': return null; // handled by the connection (long-poll)
    case 'ue_del': case 'ue_detach': throw new Error(`Unknown message: ${m.message}`);
    case 'mock_state': return { rat: RAT, cells: [...cells.values()], ue, logLevels, traffic: [...traffic.keys()], reestMode, reconnectMs: RECONNECT_MS };
    case 'mock_ue':
      if (m.action === 'power_off') powerOff();
      else if (m.action === 'power_on') powerOn();
      else throw new Error('action must be power_off or power_on');
      return { poweredOn: ue.poweredOn };
    case 'mock_set':
      if (m.reestMode !== undefined) reestMode = m.reestMode === 'setup' ? 'setup' : 'reestablish';
      if (m.reconnectMs !== undefined) RECONNECT_MS = Number(m.reconnectMs);
      return { reestMode, reconnectMs: RECONNECT_MS };
    default: throw new Error(`Unknown message: ${m.message}`);
  }
}

function handleMme(m) {
  switch (m.message) {
    case 'config_get': return { type: 'MME', name: 'MOCK-MME', logs: { layers: Object.fromEntries(Object.entries(logLevels.mme).map(([k, v]) => [k, { level: v }])) } };
    case 'config_set': {
      for (const [layer, cfg] of Object.entries(m.logs?.layers ?? {})) {
        if (!(layer in logLevels.mme)) throw new Error(`Unknown log layer: ${layer}`);
        if (cfg.level) logLevels.mme[layer] = cfg.level;
      }
      return {};
    }
    case 'ue_get': {
      const cur = current();
      const entry = {
        rat_type: NR ? 'NR' : 'LTE', imsi: ue.imsi, imeisv: ue.imeisv, tac: ue.tac, tac_plmn: '00101', registered: ue.registered,
        ...(NR ? { '5g_tmsi': ue.m_tmsi } : { m_tmsi: ue.m_tmsi }),
        ...(cur && ue.mme_ue_id !== undefined ? { [ueIdKey]: ue.contexts[0].enb_ue_id, [cnIdKey]: ue.mme_ue_id } : {}),
        // stale after an intra-node HO, like the live MME
        ...(NR ? { ncgi: { plmn: '00101', cell_id: cells.get(ue.ecgiCell)?.eci } } : { ecgi: { plmn: '00101', cell_id: (ENB_ID << 8) | ue.ecgiCell } }),
        bearers: ue.registered
          ? [NR ? { pdu_session_id: 1, sst: 1, qos_flow_id: 1, ip: ue.ip, apn: 'internet', dl_total_bytes: 0, ul_total_bytes: 0 }
            : { erab_id: 5, ip: ue.ip, apn: 'internet', dl_total_bytes: 0, ul_total_bytes: 0 }]
          : [],
      };
      const list = !m.imsi || m.imsi === ue.imsi ? [entry] : [];
      return { ue_list: list };
    }
    case 'load_balancing_tau': {
      need(m, 'imsi');
      if (NR) throw new Error('load_balancing_tau: UE is not connected to EPC');
      if (m.imsi !== ue.imsi) throw new Error('UE not found');
      if (m.imei !== undefined && !/^\d{14,15}$/.test(String(m.imei))) throw new Error('imei: must be 14 or 15 digits');
      const prev = current()?.pcell;
      emitLog('mme', 's1ap', 'TO', ['UE context release command', '  cause nas: load-balancing-tau-required']);
      setTimeout(() => {
        ue.contexts = []; ue.mme_ue_id = undefined;
        setTimeout(() => {
          const p = prev && !cells.get(prev).barredEffective ? prev : bestCell()?.id;
          connect(p, 'mo-Signalling', 'tau');
        }, 600);
      }, 100);
      return {};
    }
    case 'ue_detach': {
      if (m.imsi !== ue.imsi) throw new Error('UE not found');
      if (Number(m.cause ?? 3) !== -1) throw new Error('Refused by mock: a detach cause can invalidate a test SIM — send cause -1');
      if (m.local) throw new Error('Refused by mock: local detach');
      const reattach = NR ? (Number(m.type ?? 1) & 4) !== 0 : Number(m.type ?? 2) === 1;
      if (!ue.registered) throw new Error('UE not registered');
      const wasIdle = !ue.contexts.length;
      if (wasIdle) { const p = bestCell(); if (p) { rrc('DL', CH.pcch, 'Paging', ['pagingRecordList']); ue.mme_ue_id = nextMmeUeId++; ue.contexts = [newContext(p.id, ue.mme_ue_id)]; } }
      nas('DL', NR ? '5GMM: Deregistration request (UE terminated)' : 'EMM: Detach request', [NR ? `De-registration type: ${reattach ? 're-registration required' : 're-registration not required'}, 3GPP access` : `Detach type: ${reattach ? 're-attach required' : 're-attach not required'}`, 'no cause IE']);
      setTimeout(() => {
        nas('UL', NR ? '5GMM: Deregistration accept (UE terminated)' : 'EMM: Detach accept');
        const id = current()?.enb_ue_id;
        rrc('DL', CH.dcch, RRC.release, [], id);
        ue.contexts = []; ue.mme_ue_id = undefined; ue.registered = false;
        if (reattach) setTimeout(() => { const p = bestCell(); if (p) { connect(p.id, 'mo-Signalling', 'attach'); lastPcell = p.id; } }, 800);
      }, 150);
      return {};
    }
    case 'log_get': return null;
    case 'ue_del': throw new Error(`Refused by mock: ${m.message}`);
    default: throw new Error(`Unknown message: ${m.message}`);
  }
}

function serve(port, target, handler) {
  const wss = new WebSocketServer({ port, host: '127.0.0.1' });
  wss.on('connection', (ws, req) => {
    if (!req.headers.origin) { ws.close(1008, 'Origin header required'); return; }
    ws.send(JSON.stringify({ message: 'ready', type: target.toUpperCase(), name: `MOCK-${target.toUpperCase()}`, version: '2026-09-11-mock' }));
    const queue = [];
    let pendingLog = null;
    const sub = { target, push: e => { queue.push(e); flush(false); } };
    logSubscribers.add(sub);
    function flush(force) {
      if (!pendingLog) return;
      if (!queue.length && !force) return;
      const { m, timer } = pendingLog;
      clearTimeout(timer);
      pendingLog = null;
      const logs = queue.splice(0, m.max ?? 4096).filter(e => !m.layers || Object.keys(m.layers).some(l => l.toUpperCase() === e.layer));
      ws.send(JSON.stringify({ message: 'log_get', message_id: m.message_id, time: now(), utc: Date.now() / 1000, logs }));
    }
    ws.on('message', raw => {
      let msgs;
      try { msgs = JSON.parse(String(raw)); } catch { ws.send(JSON.stringify({ message: 'error', error: 'Invalid JSON' })); return; }
      for (const m of Array.isArray(msgs) ? msgs : [msgs]) {
        if (m.message === 'log_get') {
          if (pendingLog) flush(true);
          pendingLog = { m, timer: setTimeout(() => flush(true), 1000 * (m.timeout ?? 1)) };
          flush(false);
          continue;
        }
        let reply;
        try {
          const r = handler(m, ws);
          reply = { message: m.message, message_id: m.message_id, time: now(), utc: Date.now() / 1000, ...r };
        } catch (e) {
          reply = { message: m.message, message_id: m.message_id, time: now(), utc: Date.now() / 1000, error: e.message };
          log(`${target} ${m.message} → error: ${e.message}`);
        }
        ws.send(JSON.stringify(reply));
      }
    });
    ws.on('close', () => { logSubscribers.delete(sub); if (pendingLog) clearTimeout(pendingLog.timer); });
  });
  return wss;
}

// ── SSH: callbox traffic commands ────────────────────────────────────────────
function startSsh() {
  const { Server } = require('ssh2');
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'pkcs1', format: 'pem' } });
  let nextPid = 40000;
  const srv = new Server({ hostKeys: [privateKey] }, client => {
    client.on('authentication', ctx => {
      if (ctx.method === 'password' && ctx.username === SSH_USER && ctx.password === SSH_PASS) ctx.accept();
      else ctx.reject(['password']);
    });
    client.on('ready', () => {
      client.on('session', accept => {
        const session = accept();
        session.on('exec', (acc, _rej, info) => {
          const stream = acc();
          const cmd = String(info.command);
          const iperf = /exec -a (simtool-traffic-[0-9a-f]+) iperf -u -c (\d+\.\d+\.\d+\.\d+) -b (\S+) -t (\d+)/.exec(cmd);
          if (iperf) {
            const [, tag, ip, rate, dur] = iperf;
            const pid = nextPid++;
            stream.write(`PID ${pid}\n`);
            stream.write(`Client connecting to ${ip}, UDP port 5001\nSending 1400 byte datagrams\n`);
            let sec = 0;
            const tick = setInterval(() => { sec++; stream.write(`[  3] ${sec - 1}.0-${sec}.0 sec  ${rate} bits/sec\n`); }, 1000);
            const end = (code) => {
              if (!traffic.has(tag)) return;
              traffic.delete(tag);
              clearInterval(tick); clearTimeout(timer);
              try { stream.exit(code); stream.end(); } catch { /* closed */ }
              log(`traffic ${tag} ended`);
            };
            const timer = setTimeout(() => end(0), Number(dur) * 1000);
            traffic.set(tag, { pid, ip, rate, end });
            log(`traffic ${tag}: DL UDP ${rate} → ${ip} for ${dur} s`);
            stream.on('close', () => end(0));
            return;
          }
          const kill = /^kill (\d+)/.exec(cmd);
          if (kill) { for (const t of traffic.values()) if (t.pid === Number(kill[1])) t.end(143); stream.exit(0); stream.end(); return; }
          if (/pkill -f/.test(cmd)) {
            for (const [tag, t] of traffic) if (cmd.includes(tag) || /pkill -f simtool-traffic-/.test(cmd) || /pkill -f "iperf/.test(cmd)) t.end(143);
            if (/pgrep -fc/.test(cmd)) stream.write(`${traffic.size}\n`);
            stream.exit(0); stream.end(); return;
          }
          stream.exit(0); stream.end();
        });
      });
    });
    client.on('error', () => {});
  });
  srv.listen(SSH_PORT, '127.0.0.1', () => log(`mock SSH on 127.0.0.1:${SSH_PORT} (${SSH_USER}/${SSH_PASS})`));
}

serve(ENB_PORT, 'enb', handleEnb);
serve(MME_PORT, 'mme', handleMme);
if (SSH_PORT) startSsh();
log(`mock callbox (${RAT.toUpperCase()}): eNB ws://127.0.0.1:${ENB_PORT}  MME ws://127.0.0.1:${MME_PORT}  cells=${N_CELLS} hoConfig=${HO_CONFIG} intraFreq=${INTRA} tacSplit=${TAC_SPLIT} imsi=${IMSI}`);

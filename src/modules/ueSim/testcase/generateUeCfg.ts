// modules/ueSim/testcase/generateUeCfg.ts
//
// UeTestCase → ue.cfg text for the Simnovus lteue build.
//
// Two layers of output:
//   1. A header comment with the test case embedded as JSON (`@uesim-testcase:`)
//      plus a human-readable summary. The wizard reopens a saved .cfg from
//      this block, exactly like the eNB builder's `@builder:` marker.
//   2. The body, written the way Simnovator's own compiler writes it (checked
//      against the live ue.cfg on the UE-sim box and 299 compiled test cases
//      in the Simnovator database): global_traffic profiles referenced by
//      per-UE `traffic` entries, `ecc_params` for SUCI, NAS algorithm
//      bitmaps, `cell_index`, `imeisv`, `attach_pdn_type`, `ue_move` events
//      for mobility, `power_on`/`power_off` with loop_count for cycling.
//
// The few wizard fields with no lteue counterpart on this build (BLER
// override, access classes, UAC identities, external SIM, Doppler) are
// recorded in the header only; FIELD_MAP says so and the Settings step
// shows it.

import type {
  CellConfig, DataType, SubscriberGroup, UeTestCase, UserPlaneProfile,
} from './types';
import {
  attachTime, bitrateToMbps, cycleLength, expandUes, flowLength, formatBitrate,
  formatSeconds, imeisvFor, testLength, totalUes, trafficFor, userPlanesFor,
  type DerivedUe,
} from './derive';
import { LTE_BANDS, NR_BANDS, logOptionsFor, normalizeTestCase } from './defaults';

export const TESTCASE_MARKER = '@uesim-testcase:';

// ── Field map (documentation + the "where did it go" panel) ───────────────

export interface FieldMapping {
  step: string;
  field: string;
  target: string;
  /** 'cfg' = emitted as a config key, 'events' = drives sim_events / traffic,
   *  'header' = preserved in the header comment only. */
  kind: 'cfg' | 'events' | 'header';
}

export const FIELD_MAP: FieldMapping[] = [
  { step: 'Cell', field: 'RAT Type', target: 'cell_groups[].group_type', kind: 'cfg' },
  { step: 'Cell', field: 'Band / DL & SSB ARFCN', target: 'cells[].band, dl_nr_arfcn, ul_nr_arfcn, ssb_nr_arfcn (dl_earfcn / ul_earfcn on 4G)', kind: 'cfg' },
  { step: 'Cell', field: 'Bandwidth, SCS', target: 'cells[].bandwidth, subcarrier_spacing', kind: 'cfg' },
  { step: 'Cell', field: 'DL / UL antennas', target: 'cells[].n_antenna_dl, n_antenna_ul', kind: 'cfg' },
  { step: 'Cell', field: 'RF Card', target: 'cells[].rf_port, sync_id + rf_driver.args', kind: 'cfg' },
  { step: 'Cell', field: 'Tx / Rx gain', target: 'tx_gain[], rx_gain[]', kind: 'cfg' },
  { step: 'Cell', field: 'Mobility', target: 'channel_sim + Mobility step', kind: 'cfg' },
  { step: 'Cell', field: 'Duplex, NTN, CA', target: 'header (the UE follows what the cell broadcasts)', kind: 'header' },
  { step: 'Subscriber', field: 'UE Count, Starting SUPI, Next SUPI', target: 'one ue_list[] entry per UE: ue_id, imsi', kind: 'cfg' },
  { step: 'Subscriber', field: 'Serving Cell', target: 'ue_list[].cell_index', kind: 'cfg' },
  { step: 'Subscriber', field: 'MNC Digits', target: 'ue_list[].mnc_nb_digits', kind: 'cfg' },
  { step: 'Subscriber', field: 'Protection scheme, Public key ID, Routing indicator', target: 'ue_list[].ecc_params', kind: 'cfg' },
  { step: 'Subscriber', field: 'Algorithm, Shared Key, OP/OPc, SQN', target: 'ue_list[].sim_algo, K, op/opc, sqn', kind: 'cfg' },
  { step: 'Subscriber', field: 'RES Len', target: 'ue_list[].res_len', kind: 'cfg' },
  { step: 'Subscriber', field: 'Integrity / Cipher algorithms', target: 'ue_list[].integ_algo_bitmap, cipher_algo_bitmap', kind: 'cfg' },
  { step: 'Subscriber', field: 'AS Release, UE Category', target: 'ue_list[].as_release, ue_category', kind: 'cfg' },
  { step: 'Subscriber', field: 'Attach PDN Type', target: 'ue_list[].emergency_attach', kind: 'cfg' },
  { step: 'Subscriber', field: 'PDN Type, Default APN', target: 'ue_list[].attach_pdn_type, apn', kind: 'cfg' },
  { step: 'Subscriber', field: 'Voice capability', target: 'ue_list[].nr_voice_support', kind: 'cfg' },
  { step: 'Subscriber', field: 'Network Slicing', target: 'ue_list[].default_nssai, default_pdu_session_snssai', kind: 'cfg' },
  { step: 'Subscriber', field: 'RRC Inactive', target: 'ue_list[].rrc_inactive_support', kind: 'cfg' },
  { step: 'Subscriber', field: 'CQI / RI / PMI', target: 'ue_list[].forced_cqi, forced_ri, forced_pmi', kind: 'cfg' },
  { step: 'Subscriber', field: 'IMEISV (advanced)', target: 'ue_list[].imeisv', kind: 'cfg' },
  { step: 'Subscriber', field: 'External SIM, Access class, UAC identities, BLER override', target: 'header', kind: 'header' },
  { step: 'User Plane', field: 'Data type, destination, port, protocol, bitrates, MTU, payload', target: 'global_traffic.iperf / ping / http profile', kind: 'events' },
  { step: 'User Plane', field: 'Start delay, duration, loop', target: 'ue_list[].traffic[] start_time, session_duration, data_loop_count', kind: 'events' },
  { step: 'User Plane', field: 'APN, PDN type', target: 'sim_events pdn_connect / pdn_disconnect', kind: 'events' },
  { step: 'Traffic', field: 'Attach rate, delay', target: 'sim_events power_on start_time per UE', kind: 'events' },
  { step: 'Traffic', field: 'Power ON duration, loop profile', target: 'sim_events power_off, loop_count, loop_delay', kind: 'events' },
  { step: 'Traffic', field: 'Attach type', target: 'header (Simnovator compiles both types to the same 1/rate spacing)', kind: 'header' },
  { step: 'Mobility', field: 'Channel model, powers, noise', target: 'channel_sim, cells[].ref_signal_power / ul_power_attenuation, ue_list[].channel / noise_spd', kind: 'cfg' },
  { step: 'Mobility', field: 'Positions, speed, direction, trip', target: 'cells[].position, ue_list[].position, sim_events ue_move', kind: 'events' },
  { step: 'Mobility', field: 'Doppler', target: 'header', kind: 'header' },
  { step: 'Settings', field: 'Log settings', target: 'log_options, log_filename', kind: 'cfg' },
  { step: 'Settings', field: 'Remote API port, RF driver', target: 'com_addr, rf_driver', kind: 'cfg' },
  { step: 'Settings', field: 'Test case name, description, success settings', target: 'header', kind: 'header' },
];

// ── Tiny pretty-printer ──────────────────────────────────────────────────
// lteue reads JSON with comments and bare keys; hex literals need RawToken.

class RawToken {
  constructor(public text: string) {}
}
const raw = (text: string) => new RawToken(text);

type Node = Record<string, unknown>;

function pad(level: number): string {
  return '  '.repeat(level);
}

function printValue(v: unknown, level: number): string {
  if (v instanceof RawToken) return v.text;
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return printArray(v, level);
  if (typeof v === 'object') return printObject(v as Node, level);
  return JSON.stringify(v);
}

function printArray(a: unknown[], level: number): string {
  if (a.length === 0) return '[]';
  const scalar = a.every(x => x === null || x instanceof RawToken || ['string', 'number', 'boolean'].includes(typeof x));
  if (scalar) return '[' + a.map(x => printValue(x, level)).join(', ') + ']';
  return '[\n' + a.map(x => pad(level + 1) + printValue(x, level + 1)).join(',\n') + '\n' + pad(level) + ']';
}

function printObject(o: Node, level: number): string {
  const entries = Object.entries(o).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '{}';
  // A key starting with "//" is a comment line: no value, no trailing comma.
  const lastValueIdx = entries.reduce((last, [k], i) => (k.startsWith('//') ? last : i), -1);
  const lines = entries.map(([k, v], i) => {
    if (k.startsWith('//')) return pad(level + 1) + `// ${String(v)}`;
    const comma = i < lastValueIdx ? ',' : '';
    return pad(level + 1) + `${k}: ${printValue(v, level + 1)}${comma}`;
  });
  return '{\n' + lines.join('\n') + '\n' + pad(level) + '}';
}

// ── Cell ─────────────────────────────────────────────────────────────────

/** An SDR device carries two antennas, so a cell occupies one device per
 *  two DL antennas starting at its RF card index — the rule Simnovator's
 *  compiler follows (card 0 with 4 DL antennas → /dev/sdr0 and /dev/sdr1,
 *  so the next cell starts at card 2). */
export function cellDevices(c: CellConfig): number[] {
  const start = parseInt(c.rfCard, 10);
  const base = Number.isFinite(start) ? start : 0;
  const count = Math.max(1, Math.ceil(c.dlAntennas / 2));
  return Array.from({ length: count }, (_, i) => base + i);
}

function bandNumber(band: string): number {
  const n = parseInt(band.replace(/^n/i, ''), 10);
  return Number.isFinite(n) ? n : 78;
}

/** Every SDR device the test uses, in cell order. Position in this list is
 *  the devN index in rf_driver.args. */
export function allDevices(tc: UeTestCase): number[] {
  const out: number[] = [];
  for (const c of tc.cell.cells) {
    for (const d of cellDevices(c)) if (!out.includes(d)) out.push(d);
  }
  return out.length ? out : [0];
}

export function rfDriverArgs(tc: UeTestCase): string {
  if (tc.settings.rfDriverArgs.trim()) return tc.settings.rfDriverArgs.trim();
  return allDevices(tc).map((p, i) => `dev${i}=/dev/sdr${p}`).join(',');
}

/** rf_port is the cell's sequential RF port, not its device index: a cell
 *  spanning two devices still counts as one port (cards 0 and 2 → ports 0
 *  and 1 over dev0..dev3). */
function rfPortOf(tc: UeTestCase, c: CellConfig): number {
  const idx = tc.cell.cells.findIndex(x => x.id === c.id);
  return idx >= 0 ? idx : 0;
}

function mobilityOn(tc: UeTestCase): boolean {
  return tc.cell.mobility && tc.mobility.channelModel !== 'None';
}

function cellRecord(tc: UeTestCase, c: CellConfig, index: number): Node {
  const out: Node = {};
  out.rf_port = rfPortOf(tc, c);
  out.sync_id = index;
  if (tc.cell.ratType === '5G:SA') {
    const info = NR_BANDS.find(b => b.band === c.band);
    const ulOffset = c.duplexMode === 'TDD' ? 0 : (info?.ulOffset ?? 0);
    out.band = bandNumber(c.band);
    out.bandwidth = c.bandwidth;
    out.dl_nr_arfcn = c.dlNrArfcn;
    out.ul_nr_arfcn = c.dlNrArfcn - ulOffset;
    out.ssb_nr_arfcn = c.ssbNrArfcn;
    out.subcarrier_spacing = c.scs;
  } else {
    const info = LTE_BANDS.find(b => b.band === c.band);
    const ulOffset = c.duplexMode === 'TDD' ? 0 : (info?.ulOffset ?? 18000);
    out.bandwidth = c.bandwidth;
    out.dl_earfcn = c.dlEarfcn;
    out.ul_earfcn = c.dlEarfcn + ulOffset;
  }
  out.n_antenna_dl = c.dlAntennas;
  out.n_antenna_ul = c.ulAntennas;
  out.prach_delay = 0;
  out.global_timing_advance = -1;

  if (mobilityOn(tc)) {
    const pos = tc.mobility.cellPositions.find(p => p.cellId === c.id);
    out.antenna = { type: 'isotropic' };
    out.position = [pos?.x ?? 0, pos?.y ?? 0];
    out.ref_signal_power = tc.mobility.refSignalPower;
    out.ul_power_attenuation = tc.mobility.ulPowerAttenuation;
  }
  return out;
}

/** One entry per antenna in RF-port order: what lteue expects, and what
 *  Simnovator writes even when every value is the same. */
function gainArray(tc: UeTestCase, which: 'txGain' | 'rxGain'): number[] {
  const out: number[] = [];
  for (const c of tc.cell.cells) out.push(...(c[which] ?? []));
  return out.length ? out : (which === 'txGain' ? [80] : [10]);
}

// ── Subscriber ───────────────────────────────────────────────────────────

function simAlgo(a: SubscriberGroup['algorithm']): string {
  return a === 'XOR' ? 'xor' : a === 'TUAK' ? 'tuak' : 'milenage';
}

function ueCategoryValue(tc: UeTestCase, g: SubscriberGroup): string | number {
  if (tc.cell.ratType === '5G:SA' || g.ueCategory.toUpperCase() === 'NR') return 'nr';
  const n = parseInt(g.ueCategory, 10);
  return Number.isFinite(n) ? n : 4;
}

/** NAS capability bitmap per 3GPP 24.301 §9.9.3.34: MSB = algorithm 0. */
export function algoBitmap(flags: [boolean, boolean, boolean, boolean]): number {
  return (flags[0] ? 0x80 : 0) | (flags[1] ? 0x40 : 0) | (flags[2] ? 0x20 : 0) | (flags[3] ? 0x10 : 0);
}

function pdnTypeValue(t: SubscriberGroup['pdnType']): string {
  return t.toLowerCase();
}

function snssai(sst: number, sd: string): Node {
  const n: Node = { sst };
  const t = sd.trim();
  if (t) n.sd = /^0x[0-9a-f]+$/i.test(t) ? raw(t.toLowerCase()) : (Number.isFinite(Number(t)) ? Number(t) : t);
  return n;
}

// ── Traffic profiles (global_traffic) ────────────────────────────────────

type ProfileKind = 'iperf' | 'ping' | 'http';

function profileKind(t: DataType): ProfileKind | null {
  return t === 'IPERF' ? 'iperf' : t === 'PING' ? 'ping' : t === 'HTTP' ? 'http' : null;
}

/** Simnovator names profiles by kind and position: iperf0, ping0, http0 … */
function profileIds(tc: UeTestCase): Map<number, string> {
  const counters: Record<ProfileKind, number> = { iperf: 0, ping: 0, http: 0 };
  const ids = new Map<number, string>();
  for (const p of tc.userPlane.profiles) {
    const kind = profileKind(p.dataType);
    if (!kind) continue;
    ids.set(p.id, `${kind}${counters[kind]}`);
    counters[kind] += 1;
  }
  return ids;
}

function profileBody(p: UserPlaneProfile): Node {
  const apn = p.apnName.trim();
  switch (p.dataType) {
    case 'IPERF': {
      const n: Node = { type: p.transportProtocol.toLowerCase(), dest_ip: p.destinationIp.trim(), port_range: p.startingPort };
      if (p.fileTransferAction !== 'UL') n.bitrate_dl = bitrateToMbps(p.dlBitrate);
      if (p.fileTransferAction !== 'DL') n.bitrate_ul = bitrateToMbps(p.ulBitrate);
      if (p.transportProtocol === 'UDP' && p.payloadLength > 0) n.payload = Math.round(p.payloadLength);
      n.mtu = Math.round(p.mtuSize);
      if (apn) n.apn = apn;
      return n;
    }
    case 'PING': {
      const n: Node = {
        dest_ip: p.destinationIp.trim(),
        interval: Math.max(0.2, p.pingInterval || 1),
        packet_size: Math.max(8, Math.round(p.payloadLength || 56)),
        packet_count: Math.max(1, Math.round(p.pingCount || 1)),
      };
      if (apn) n.apn = apn;
      return n;
    }
    case 'HTTP': {
      const n: Node = { dest_url: p.destinationUrl.trim() || `http://${p.destinationIp.trim()}/` };
      if (apn) n.apn = apn;
      return n;
    }
    default:
      return {};
  }
}

function globalTraffic(tc: UeTestCase, ids: Map<number, string>): Node | null {
  const byKind: Record<ProfileKind, Node[]> = { iperf: [], ping: [], http: [] };
  for (const p of tc.userPlane.profiles) {
    const kind = profileKind(p.dataType);
    const id = ids.get(p.id);
    if (!kind || !id) continue;
    byKind[kind].push({ [id]: profileBody(p) });
  }
  const out: Node = {};
  for (const kind of ['iperf', 'ping', 'http'] as ProfileKind[]) {
    if (byKind[kind].length) out[kind] = byKind[kind];
  }
  if (Object.keys(out).length === 0) return null;
  out.log_level = 'none';
  return out;
}

// ── Per-UE entry ─────────────────────────────────────────────────────────

function ueTraffic(tc: UeTestCase, ue: DerivedUe, powerOn: number, ids: Map<number, string>): Node[] | null {
  const byKind: Record<ProfileKind, Node[]> = { iperf: [], ping: [], http: [] };
  for (const p of userPlanesFor(tc, ue.group.id)) {
    const kind = profileKind(p.dataType);
    const id = ids.get(p.id);
    if (!kind || !id) continue;
    const loops = p.loop && p.loopCount >= 2 ? p.loopCount - 1 : 0;
    byKind[kind].push({
      profile_id: id,
      start_time: powerOn + Math.max(0, p.startDelay),
      session_duration: Math.max(1, Math.round(p.duration)),
      loop_count: 0,
      loop_delay: 0,
      data_loop_count: loops,
      inter_data_loop_delay: loops ? Math.max(0, Math.round(p.loopGap)) : 0,
    });
  }
  const out: Node[] = [];
  for (const kind of ['iperf', 'ping', 'http'] as ProfileKind[]) {
    if (byKind[kind].length) out.push({ [kind]: byKind[kind] });
  }
  return out.length ? out : null;
}

/** ue_move events for a group, mirroring Simnovator's round-trip compile:
 *  a leg out, a leg back (both looping), then a stop. Speed is km/h. */
function moveEvents(tc: UeTestCase, groupId: number, powerOn: number): Node[] {
  const m = tc.mobility.groups.find(x => x.groupId === groupId);
  if (!m || m.tripType === 'stationary' || m.speedKmh <= 0) return [];
  const start = powerOn + Math.max(0, m.startDelay);
  const speedMs = m.speedKmh / 3.6;
  const leg = Math.max(1, Math.round((Math.max(1, m.distance) / speedMs) * 1000) / 1000);
  const duration = Math.max(leg, m.duration);
  const back = (m.direction + 180) % 360;
  const dx = Math.cos((m.direction * Math.PI) / 180) * m.distance;
  const dy = Math.sin((m.direction * Math.PI) / 180) * m.distance;
  const far: [number, number] = [round2(m.x + dx), round2(m.y + dy)];
  const events: Node[] = [];
  if (m.tripType === 'oneWay') {
    events.push({ event: 'ue_move', start_time: start, speed: m.speedKmh, position: [m.x, m.y], direction: m.direction });
    events.push({ event: 'ue_move', start_time: round2(start + leg), speed: 0, position: far, direction: m.direction });
    return events;
  }
  // roundTrip: how many full there-and-back cycles fit in the duration.
  const cycles = Math.max(1, Math.floor(duration / (2 * leg)));
  const loop = cycles > 1 ? { loop_count: cycles - 1, loop_delay: round2(2 * leg) } : {};
  events.push({ event: 'ue_move', start_time: start, speed: m.speedKmh, position: [m.x, m.y], direction: m.direction, ...loop });
  events.push({ event: 'ue_move', start_time: round2(start + leg), speed: m.speedKmh, position: far, direction: back, ...loop });
  events.push({ event: 'ue_move', start_time: round2(start + duration), speed: 0, position: [m.x, m.y], direction: m.direction });
  return events;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function ueRecord(tc: UeTestCase, ue: DerivedUe, ids: Map<number, string>): Node {
  const g = ue.group;
  const isNr = tc.cell.ratType === '5G:SA';
  const out: Node = {};
  out['//'] = `UE ${ue.index + 1} — group ${g.id}, #${ue.indexInGroup + 1} of ${g.ueCount}`;
  out.ue_id = ue.index + 1;
  out.imsi = ue.imsi;
  out.K = ue.K.toUpperCase();
  if (g.algorithm === 'Milenage') {
    if (g.opType === 'OPc') out.opc = g.opValue.toUpperCase();
    else out.op = g.opValue.toUpperCase();
  } else if (g.algorithm === 'TUAK') {
    if (g.opType === 'OPc') out.topc = g.opValue.toUpperCase();
    else out.top = g.opValue.toUpperCase();
  }
  out.sim_algo = simAlgo(g.algorithm);
  if (g.sqn.trim()) out.sqn = g.sqn.trim();
  out.imeisv = imeisvFor(g.imeisv, ue.index + 1);
  out.res_len = g.resLen;
  out.as_release = g.asRelease;
  out.ue_category = ueCategoryValue(tc, g);
  out.cell_index = g.servingCell;
  if (isNr) {
    out.mnc_nb_digits = g.mncDigits;
    const ecc: Node = {
      scheme: g.protectionScheme === 'Profile A' ? 'A' : g.protectionScheme === 'Profile B' ? 'B' : 'null',
      routing_indicator: g.routingIndicator || '0',
      home_nw_public_key_id: g.publicKeyId,
    };
    if (g.protectionScheme !== 'Null' && g.homeNetworkPublicKey.trim()) ecc.home_nw_public_key = g.homeNetworkPublicKey.trim();
    out.ecc_params = ecc;
    out.nr_voice_support = g.vonrSupport;
    out.rrc_inactive_support = g.rrcInactive;
  }
  out.attach_pdn_type = pdnTypeValue(g.pdnType);
  if (g.attachPdnType === 'Emergency') out.emergency_attach = true;
  if (g.defaultApn.trim()) out.apn = g.defaultApn.trim();
  if (isNr && g.networkSlicing === 'Enable' && g.nssai.length > 0) {
    out.default_nssai = g.nssai.map(s => snssai(s.sst, s.sd));
    out.default_pdu_session_snssai = snssai(g.nssai[0].sst, g.nssai[0].sd);
  }
  out.integ_algo_bitmap = algoBitmap([g.integrity.nia0, g.integrity.nia1, g.integrity.nia2, g.integrity.nia3]);
  out.cipher_algo_bitmap = algoBitmap([g.cipher.nea0, g.cipher.nea1, g.cipher.nea2, g.cipher.nea3]);
  if (g.cqi !== 'Auto') out.forced_cqi = g.cqi;
  if (g.ri !== 'Auto') out.forced_ri = g.ri;
  if (g.pmi !== 'Auto') out.forced_pmi = g.pmi;
  out.use_security_context_for_registration = true;
  out.power_control_enabled = false;
  out.rrc_initial_selection = false;
  out.rrc_sel_resel = mobilityOn(tc) && tc.cell.cells.length > 1;

  const flows = userPlanesFor(tc, g.id);
  if (flows.length > 0) out.tun_setup_script = 'ue-ifup';

  // Mobility
  if (mobilityOn(tc)) {
    const m = tc.mobility.groups.find(x => x.groupId === g.id);
    out.channel_sim = true;
    out.channel = { type: 'awgn' };
    out.position = [m?.x ?? 0, m?.y ?? 0];
    out.noise_spd = tc.mobility.noiseSpd;
  }

  // Events
  const tp = trafficFor(tc, g.id);
  const on = attachTime(tp, ue.indexInGroup);
  const events: Node[] = [];
  const loop = tp && tp.loopProfile === 'Enable' && tp.loopCount >= 2 && tp.powerOnDuration > 0
    ? { loop_count: tp.loopCount - 1, loop_delay: tp.powerOnDuration + Math.max(0, tp.powerOffDuration) }
    : {};
  events.push({ event: 'power_on', start_time: on, ...loop });
  for (const p of flows) {
    const apn = p.apnName.trim();
    if (!apn || apn === g.defaultApn.trim()) continue;
    const start = on + Math.max(0, p.startDelay);
    events.push({ event: 'pdn_connect', start_time: start, apn, pdn_type: p.pdnType.toLowerCase() });
    events.push({ event: 'pdn_disconnect', start_time: round2(start + flowLength(p)), apn, pdn_type: p.pdnType.toLowerCase() });
  }
  events.push(...moveEvents(tc, g.id, on));
  if (tp && tp.powerOnDuration > 0) events.push({ event: 'power_off', start_time: on + tp.powerOnDuration, ...loop });
  events.sort((a, b) => (a.start_time as number) - (b.start_time as number));
  out.sim_events = events;

  const traffic = ueTraffic(tc, ue, on, ids);
  if (traffic) out.traffic = traffic;
  return out;
}

// ── Header ───────────────────────────────────────────────────────────────

function summaryLines(tc: UeTestCase): string[] {
  const ues = totalUes(tc);
  const cells = tc.cell.cells.map(c =>
    tc.cell.ratType === '5G:SA'
      ? `${c.band} ${c.bandwidth} MHz ${c.duplexMode} SCS${c.scs} ${c.dlAntennas}x${c.ulAntennas}`
      : `B${c.band} ${c.bandwidth} MHz ${c.duplexMode} ${c.dlAntennas}x${c.ulAntennas}`,
  );
  const lines = [
    `Test case : ${tc.settings.testCaseName}`,
    `RAT       : ${tc.cell.ratType}   Cells: ${tc.cell.cells.length} (${cells.join('; ')})`,
    `UEs       : ${ues} in ${tc.subscriber.groups.length} group(s)`,
  ];
  for (const g of tc.subscriber.groups) {
    const first = expandUes(tc).find(u => u.group.id === g.id);
    lines.push(`  group ${g.id}: ${g.ueCount} UE, SUPI from ${first?.imsi ?? '-'}, ${g.algorithm}, cell ${g.servingCell}`);
  }
  for (const p of tc.userPlane.profiles) {
    if (p.dataType === 'None') continue;
    const dirs = p.dataType === 'IPERF'
      ? [p.fileTransferAction !== 'UL' ? `DL ${formatBitrate(p.dlBitrate)}` : '', p.fileTransferAction !== 'DL' ? `UL ${formatBitrate(p.ulBitrate)}` : ''].filter(Boolean).join(' / ')
      : '';
    const target = p.dataType === 'HTTP' ? (p.destinationUrl || p.destinationIp) : `${p.destinationIp}${p.dataType === 'IPERF' ? `:${p.startingPort}+` : ''}`;
    lines.push(`Traffic   : ${p.dataType} ${p.dataType === 'IPERF' ? p.transportProtocol + ' ' : ''}→ ${target} ${dirs} for ${formatSeconds(p.duration)} after ${p.startDelay}s${p.loop ? ` ×${p.loopCount}` : ''}`);
  }
  for (const t of tc.traffic.profiles) {
    lines.push(`Attach    : ${t.attachType}, ${t.attachRate} UE/s after ${t.attachDelay}s, power on for ${formatSeconds(t.powerOnDuration)}${t.loopProfile === 'Enable' ? ` ×${t.loopCount}` : ''}`);
  }
  if (mobilityOn(tc)) lines.push(`Mobility  : ${tc.mobility.channelModel} channel, ref power ${tc.mobility.refSignalPower} dBm`);
  lines.push(`Duration  : ${formatSeconds(testLength(tc))}   Success: ${tc.settings.successSettings}   Log: ${tc.settings.logSettings}`);
  if (tc.settings.description.trim()) lines.push(`Note      : ${tc.settings.description.trim()}`);
  return lines.flatMap(l => l.split(/\r?\n/)).map(l => l.replace(/\*\//g, '* /'));
}

export function buildHeader(tc: UeTestCase): string {
  const meta = JSON.stringify(tc).replace(/\*\//g, '*\\/');
  const summary = summaryLines(tc).map(l => ` * ${l}`).join('\n');
  return [
    `/* ${TESTCASE_MARKER}${meta} */`,
    '/* simtool — UE-SIM test case (generated ' + new Date().toISOString() + ')',
    summary,
    ' */',
  ].join('\n') + '\n';
}

/** Reopen a test case from a .cfg that carries the marker. */
export function extractTestCase(cfgText: string): UeTestCase | null {
  const idx = cfgText.indexOf(TESTCASE_MARKER);
  if (idx < 0) return null;
  const start = idx + TESTCASE_MARKER.length;
  const end = cfgText.indexOf('*/', start);
  if (end < 0) return null;
  try {
    const json = cfgText.slice(start, end).trim().replace(/\*\\\//g, '*/');
    return normalizeTestCase(JSON.parse(json));
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Omit the header block (preview panes that only want the body). */
  bodyOnly?: boolean;
}

export function logFilenameFor(tc: UeTestCase): string {
  if (tc.settings.logFilename.trim()) return tc.settings.logFilename.trim();
  const name = (tc.settings.testCaseName || 'ue').trim().replace(/[^\w.-]+/g, '_');
  return `/tmp/${name}.log`;
}

export function generateUeCfg(tc: UeTestCase, options: GenerateOptions = {}): string {
  const isNr = tc.cell.ratType === '5G:SA';
  const top: Node = {};

  top.log_options = logOptionsFor(tc.settings.logSettings, tc.cell.cells.some(c => c.ntn));
  top.log_filename = logFilenameFor(tc);
  top.com_addr = `0.0.0.0:${tc.settings.comPort || 9002}`;

  const rfd: Node = { name: tc.settings.rfDriverName || 'sdr', args: rfDriverArgs(tc) };
  if (isNr) rfd.rx_antenna = 'rx';
  top.rf_driver = rfd;
  top.tx_gain = gainArray(tc, 'txGain');
  top.rx_gain = gainArray(tc, 'rxGain');

  const group: Node = {
    group_type: isNr ? 'nr' : 'lte',
    multi_ue: true,
    channel_sim: mobilityOn(tc),
    pdcch_decode_opt: false,
  };
  if (isNr) group.ldpc_max_its = 5; else group.pdsch_max_its = 6;
  group.cells = tc.cell.cells.map((c, i) => cellRecord(tc, c, i));
  top.cell_groups = [group];

  const ids = profileIds(tc);
  const gt = globalTraffic(tc, ids);
  if (gt) top.global_traffic = gt;

  top.ue_list = expandUes(tc).map(ue => ueRecord(tc, ue, ids));

  const body = printObject(top, 0) + '\n';
  return options.bodyOnly ? body : buildHeader(tc) + body;
}

/** Validation the wizard runs before Save. Returns human messages. */
export function validateTestCase(tc: UeTestCase): string[] {
  const issues: string[] = [];
  if (!tc.settings.testCaseName.trim()) issues.push('Settings: test case name is required');
  if (tc.cell.cells.length === 0) issues.push('Cell: at least one cell is required');
  tc.cell.cells.forEach((c, i) => {
    if (!(c.bandwidth > 0)) issues.push(`Cell ${i}: bandwidth must be positive`);
    if (tc.cell.ratType === '5G:SA' && !(c.dlNrArfcn > 0)) issues.push(`Cell ${i}: DL NR-ARFCN is required`);
    if (tc.cell.ratType === '5G:SA' && !(c.ssbNrArfcn > 0)) issues.push(`Cell ${i}: SSB NR-ARFCN is required`);
    if (tc.cell.ratType === '4G' && !(c.dlEarfcn >= 0)) issues.push(`Cell ${i}: DL EARFCN is required`);
    if (c.txGain.length !== c.ulAntennas) issues.push(`Cell ${i}: one Tx gain per UL antenna`);
    if (c.rxGain.length !== c.dlAntennas) issues.push(`Cell ${i}: one Rx gain per DL antenna`);
  });
  const used = new Map<number, number>();
  tc.cell.cells.forEach((c, i) => {
    for (const d of cellDevices(c)) {
      const owner = used.get(d);
      if (owner !== undefined && owner !== i) {
        issues.push(`Cell ${i}: RF card ${c.rfCard} overlaps cell ${owner} on /dev/sdr${d} (a cell with ${c.dlAntennas} DL antennas uses ${Math.ceil(c.dlAntennas / 2)} SDR device${c.dlAntennas > 2 ? 's' : ''})`);
        break;
      }
      used.set(d, i);
    }
  });

  const groupIds = new Set(tc.subscriber.groups.map(g => g.id));
  if (tc.subscriber.groups.length === 0) issues.push('Subscriber: at least one UE group is required');
  const seenImsi = new Set<string>();
  tc.subscriber.groups.forEach(g => {
    if (!(g.ueCount >= 1)) issues.push(`UE Group ${g.id}: UE count must be at least 1`);
    if (!/^\d{5,15}$/.test(String(g.startingSupi).trim())) issues.push(`UE Group ${g.id}: starting SUPI must be 5–15 digits`);
    if (!/^[0-9a-fA-F]{32}$/.test(g.sharedKey.trim())) issues.push(`UE Group ${g.id}: shared key must be 32 hex characters`);
    if (g.algorithm === 'Milenage' && !/^[0-9a-fA-F]{32}$/.test(g.opValue.trim())) issues.push(`UE Group ${g.id}: ${g.opType} must be 32 hex characters`);
    if (g.algorithm === 'TUAK' && !/^[0-9a-fA-F]{64}$/.test(g.opValue.trim())) issues.push(`UE Group ${g.id}: TUAK ${g.opType === 'OPc' ? 'TOPc' : 'TOP'} must be 64 hex characters`);
    if (g.sqn.trim() && !/^[0-9a-fA-F]{12}$/.test(g.sqn.trim())) issues.push(`UE Group ${g.id}: SQN must be 12 hex characters`);
    if (!tc.cell.cells.some(c => c.id === g.servingCell)) issues.push(`UE Group ${g.id}: serving cell ${g.servingCell} does not exist`);
    if (tc.cell.ratType === '5G:SA' && g.asRelease < 15) issues.push(`UE Group ${g.id}: a 5G UE needs AS release 15 or later`);
    if (tc.cell.ratType === '5G:SA' && g.protectionScheme !== 'Null') {
      const len = g.homeNetworkPublicKey.trim().length / 2;
      const want = g.protectionScheme === 'Profile A' ? 32 : 33;
      if (len !== want) issues.push(`UE Group ${g.id}: ${g.protectionScheme} needs a ${want}-byte home network public key (advanced)`);
      if (g.publicKeyId < 1 || g.publicKeyId > 3) issues.push(`UE Group ${g.id}: public key ID must be 1–3 for ${g.protectionScheme}`);
    }
    if (!/^\d{1,4}$/.test(g.routingIndicator)) issues.push(`UE Group ${g.id}: routing indicator must be 1–4 digits`);
    if (!g.integrity.nia0 && !g.integrity.nia1 && !g.integrity.nia2 && !g.integrity.nia3) issues.push(`UE Group ${g.id}: pick at least one integrity algorithm`);
    if (!g.cipher.nea0 && !g.cipher.nea1 && !g.cipher.nea2 && !g.cipher.nea3) issues.push(`UE Group ${g.id}: pick at least one cipher algorithm`);
    for (const ue of expandUes(tc).filter(u => u.group.id === g.id)) {
      if (seenImsi.has(ue.imsi)) { issues.push(`UE Group ${g.id}: IMSI ${ue.imsi} is also used by another group`); break; }
      seenImsi.add(ue.imsi);
    }
  });

  tc.userPlane.profiles.forEach(p => {
    if (p.dataType === 'None') return;
    if (p.subscriberGroup !== 'all' && !groupIds.has(p.subscriberGroup)) issues.push(`UserPlane ${p.id}: subscriber group ${p.subscriberGroup} does not exist`);
    if (p.dataType === 'HTTP') {
      if (!/^https?:\/\/\S+$/i.test(p.destinationUrl.trim()) && !p.destinationIp.trim()) issues.push(`UserPlane ${p.id}: HTTP needs a destination URL`);
    } else if (!/^\d{1,3}(\.\d{1,3}){3}$|^[0-9a-fA-F:]+$/.test(p.destinationIp.trim())) {
      issues.push(`UserPlane ${p.id}: destination IP address is invalid`);
    }
    if (p.dataType === 'IPERF' && !(p.startingPort >= 1 && p.startingPort <= 65535)) issues.push(`UserPlane ${p.id}: starting port must be 1–65535`);
    if (!(p.duration > 0)) issues.push(`UserPlane ${p.id}: duration must be positive`);
    if (p.loop && !(p.loopCount >= 2)) issues.push(`UserPlane ${p.id}: loop count must be at least 2`);
  });

  tc.traffic.profiles.forEach(t => {
    if (t.subscriberGroups !== 'all' && !groupIds.has(t.subscriberGroups)) issues.push(`Traffic ${t.id}: subscriber group ${t.subscriberGroups} does not exist`);
    if (!(t.attachRate > 0)) issues.push(`Traffic ${t.id}: attach rate must be positive`);
    if (t.loopProfile === 'Enable' && !(t.loopCount >= 2)) issues.push(`Traffic ${t.id}: loop count must be at least 2`);
    if (t.loopProfile === 'Enable' && !(t.powerOnDuration > 0)) issues.push(`Traffic ${t.id}: looping needs a power-on duration`);
  });

  // A flow that outlives its UE never finishes.
  for (const g of tc.subscriber.groups) {
    const tp = trafficFor(tc, g.id);
    if (!tp || tp.powerOnDuration <= 0) continue;
    for (const p of userPlanesFor(tc, g.id)) {
      if (p.startDelay + flowLength(p) > tp.powerOnDuration) {
        issues.push(`UE Group ${g.id}: traffic runs until ${p.startDelay + flowLength(p)}s but the UE powers off at ${tp.powerOnDuration}s`);
      }
    }
  }

  // iperf port ranges: the app server takes two ports per UE from port_range.
  const iperf = tc.userPlane.profiles.filter(p => p.dataType === 'IPERF');
  for (const p of iperf) {
    const ues = tc.subscriber.groups.filter(g => p.subscriberGroup === 'all' || p.subscriberGroup === g.id).reduce((s, g) => s + Math.max(0, g.ueCount), 0);
    if (p.startingPort + 2 * ues - 1 > 65535) issues.push(`UserPlane ${p.id}: ${ues} UEs need ${2 * ues} ports from ${p.startingPort}, past 65535`);
  }

  void cycleLength;
  return issues;
}

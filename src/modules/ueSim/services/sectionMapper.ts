// modules/ueSim/services/sectionMapper.ts
//
// Bidirectional mapping between a parsed ue.cfg object and the six tab data
// shapes (MaterializedProfile). The split is documented at length in the
// design doc (§3.3); here is the gist:
//
//   Cell        ← cell_groups[], bands[]
//   Subscriber  ← ue_list[].{imsi, K, opc, amf, sqn, sim_algo, ue_category, as_release, ext_sim, sim_reader_index, default_nssai}
//   Traffic     ← ue_list[].sim_events[]  +  default_address  +  ltesim_server config (we infer from sim_events)
//   UserPlane   ← ue_list[].tun_setup_script, tun_interface_name, rue_addr  +  multi_ue (per group)  +  pdn_list
//   Channel     ← channel_sim, delay_sim, per-cell channel_dl/channel_ul, ue_list[].position/speed/direction
//   Settings    ← log_options, log_filename, com_addr, com_auth, com_password, tx_gain, rx_gain, rf_driver, cpu_core_list
//
// On merge-back, ue_list entries are reassembled by ue_id index from
// Subscriber/Traffic/UserPlane/Channel slices.

import {
  CellSectionData,
  CellGroupSpec,
  CellSpec,
  CustomBandSpec,
  SubscriberSectionData,
  SubscriberEntry,
  SubscriberDefaults,
  SimAlgorithm,
  TrafficSectionData,
  TrafficTemplate,
  TrafficServerConfig,
  UeAssignment,
  SimEvent,
  SimEventType,
  UserPlaneSectionData,
  UserPlaneMode,
  PdnEntry,
  ChannelSectionData,
  PerCellChannel,
  UeMobility,
  ChannelType,
  SettingsSectionData,
  LayerLogConfig,
  LogLayer,
  LogLevel,
  RfDriverConfig,
  ParsedUeCfg,
  MaterializedProfile,
} from '../types';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const arr = (v: unknown): unknown[] | null => Array.isArray(v) ? v : null;

const num = (v: unknown, dflt = 0): number =>
  typeof v === 'number' ? v : (typeof v === 'string' && v !== '' ? Number(v) : dflt);

const str = (v: unknown, dflt = ''): string =>
  typeof v === 'string' ? v : (v == null ? dflt : String(v));

const bool = (v: unknown, dflt = false): boolean =>
  typeof v === 'boolean' ? v : dflt;

/** Pull keys we care about, leave the rest as _extra. */
function splitKnown<T extends Record<string, unknown>>(
  source: Record<string, unknown>,
  knownKeys: string[],
): { known: Record<string, unknown>; extra: Record<string, unknown> } {
  const known: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  for (const k of Object.keys(source)) {
    if (knownKeys.includes(k)) known[k] = source[k];
    else extra[k] = source[k];
  }
  return { known, extra };
}

// ────────────────────────────────────────────────────────────────────────────
// Cell section
// ────────────────────────────────────────────────────────────────────────────

const KNOWN_CELL_KEYS = [
  'rf_port', 'bandwidth', 'dl_earfcn', 'dl_nr_arfcn', 'ul_earfcn',
  'ul_carrier_freq_offset', 'n_antenna_dl', 'n_antenna_ul', 'scs',
  'ssb_pos_bitmap', 'tdd_config',
  // these are channel keys but Amarisoft puts them per-cell — strip them out
  // here so they don't become "extra"
  'channel_dl', 'channel_ul',
  // owned by the Channel section (PerCellChannel); if left in _extra they
  // resurface as stale duplicates when the channel section changes
  'antenna', 'ref_signal_power', 'ul_power_attenuation',
];

const KNOWN_CELLGROUP_KEYS = [
  'group_type', 'multi_ue', 'multi_ue_type', 'cpu_core_list', 'rel13_5',
  'pdcch_decode_opt', 'pdcch_decode_opt_threshold', 'cells',
];

function extractCellSpec(c: Record<string, unknown>): CellSpec {
  const { extra } = splitKnown(c, KNOWN_CELL_KEYS);
  const result: CellSpec = {
    rf_port: num(c.rf_port, 0),
    bandwidth: num(c.bandwidth, 5),
    n_antenna_dl: num(c.n_antenna_dl, 1),
    n_antenna_ul: num(c.n_antenna_ul, 1),
  };
  if (c.dl_earfcn != null) result.dl_earfcn = num(c.dl_earfcn);
  if (c.dl_nr_arfcn != null) result.dl_nr_arfcn = num(c.dl_nr_arfcn);
  if (c.ul_earfcn != null) result.ul_earfcn = num(c.ul_earfcn);
  if (c.ul_carrier_freq_offset != null) result.ul_carrier_freq_offset = num(c.ul_carrier_freq_offset);
  if (c.scs != null) result.scs = num(c.scs);
  if (c.ssb_pos_bitmap != null) result.ssb_pos_bitmap = str(c.ssb_pos_bitmap);
  if (c.tdd_config != null) result.tdd_config = num(c.tdd_config);
  if (Object.keys(extra).length > 0) result._extra = extra;
  return result;
}

function extractCellGroup(g: Record<string, unknown>): CellGroupSpec {
  const { extra } = splitKnown(g, KNOWN_CELLGROUP_KEYS);
  const cells = (arr(g.cells) ?? [])
    .map(c => obj(c))
    .filter((c): c is Record<string, unknown> => c !== null)
    .map(extractCellSpec);

  const gt = str(g.group_type, 'lte');
  const groupType = (['lte', 'nr', 'catm', 'nbiot'] as const).includes(gt as never)
    ? (gt as CellGroupSpec['group_type'])
    : 'lte';

  const result: CellGroupSpec = {
    group_type: groupType,
    multi_ue: bool(g.multi_ue, true),
    cells,
  };
  if (g.multi_ue_type != null) result.multi_ue_type = str(g.multi_ue_type);
  if (Array.isArray(g.cpu_core_list)) result.cpu_core_list = (g.cpu_core_list as unknown[]).map(v => num(v));
  if (g.rel13_5 != null) result.rel13_5 = bool(g.rel13_5);
  if (g.pdcch_decode_opt != null) result.pdcch_decode_opt = bool(g.pdcch_decode_opt);
  if (g.pdcch_decode_opt_threshold != null) result.pdcch_decode_opt_threshold = num(g.pdcch_decode_opt_threshold);
  if (Object.keys(extra).length > 0) result._extra = extra;
  return result;
}

function extractCellSection(parsed: Record<string, unknown>): CellSectionData {
  const groups = (arr(parsed.cell_groups) ?? [])
    .map(g => obj(g))
    .filter((g): g is Record<string, unknown> => g !== null)
    .map(extractCellGroup);

  const bands = (arr(parsed.bands) ?? [])
    .map(b => obj(b))
    .filter((b): b is Record<string, unknown> => b !== null)
    .map<CustomBandSpec>(b => ({
      band: num(b.band),
      dl_low: num(b.dl_low),
      dl_high: num(b.dl_high),
      ul_low: num(b.ul_low),
      ul_high: num(b.ul_high),
      dl_offset: b.dl_offset != null ? num(b.dl_offset) : undefined,
      ul_offset: b.ul_offset != null ? num(b.ul_offset) : undefined,
    }));

  const result: CellSectionData = { cell_groups: groups };
  if (bands.length > 0) result.bands = bands;
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Subscriber section
// ────────────────────────────────────────────────────────────────────────────

const SUBSCRIBER_KEYS = [
  'imsi', 'K', 'opc', 'amf', 'sqn', 'sim_algo', 'ue_category', 'as_release',
  'ext_sim', 'sim_reader_index', 'default_nssai',
];

const TRAFFIC_KEYS = ['sim_events'];
const USER_PLANE_KEYS = ['tun_setup_script', 'tun_interface_name', 'rue_addr', 'rue_protocol'];
const CHANNEL_UE_KEYS = ['position', 'speed', 'direction', 'antenna', 'waypoints'];

function extractSubscriberEntry(u: Record<string, unknown>, idx: number): SubscriberEntry {
  // Fields not in any of our buckets become _extra
  const allKnown = new Set<string>([
    ...SUBSCRIBER_KEYS,
    ...TRAFFIC_KEYS,
    ...USER_PLANE_KEYS,
    ...CHANNEL_UE_KEYS,
  ]);
  const extra: Record<string, unknown> = {};
  for (const k of Object.keys(u)) {
    if (!allKnown.has(k)) extra[k] = u[k];
  }

  const algo = str(u.sim_algo, 'milenage') as SimAlgorithm;
  const result: SubscriberEntry = {
    ue_id: idx,
    imsi: str(u.imsi),
    K: str(u.K),
    sim_algo: algo,
    ue_category: num(u.ue_category, 4),
    as_release: num(u.as_release, 8),
  };
  if (u.opc != null) result.opc = str(u.opc);
  if (u.amf != null) result.amf = typeof u.amf === 'number' ? `0x${(u.amf as number).toString(16).padStart(4, '0')}` : str(u.amf);
  if (u.sqn != null) result.sqn = str(u.sqn);
  if (u.ext_sim != null) result.ext_sim = bool(u.ext_sim);
  if (u.sim_reader_index != null) result.sim_reader_index = num(u.sim_reader_index);
  if (Array.isArray(u.default_nssai)) {
    result.default_nssai = (u.default_nssai as unknown[])
      .map(s => obj(s))
      .filter((s): s is Record<string, unknown> => s !== null)
      .map(s => ({
        sst: num(s.sst),
        sd: s.sd != null ? str(s.sd) : undefined,
      }));
  }
  if (Object.keys(extra).length > 0) result._extra = extra;
  return result;
}

function extractSubscriberSection(parsed: Record<string, unknown>): SubscriberSectionData {
  const ueList = (arr(parsed.ue_list) ?? [])
    .map(u => obj(u))
    .filter((u): u is Record<string, unknown> => u !== null);

  const ues = ueList.map((u, i) => extractSubscriberEntry(u, i));

  // Defaults — pulled from first UE's settings as a heuristic
  const first = ues[0];
  const defaults: SubscriberDefaults = {
    sim_algo: first?.sim_algo ?? 'milenage',
    ue_category: first?.ue_category ?? 4,
    as_release: first?.as_release ?? 17,
  };

  return { ues, defaults };
}

// ────────────────────────────────────────────────────────────────────────────
// Traffic section
// ────────────────────────────────────────────────────────────────────────────

function extractSimEvent(e: Record<string, unknown>): SimEvent | null {
  const evt = str(e.event) as SimEventType;
  if (!evt) return null;
  const startTime = num(e.start_time, 0);

  const base = {
    event: evt,
    start_time: startTime,
    duration: e.duration != null ? num(e.duration) : undefined,
    loop_count: e.loop_count != null ? num(e.loop_count) : undefined,
    loop_delay: e.loop_delay != null ? num(e.loop_delay) : undefined,
  };

  // Fold extras
  const known = new Set([
    'event', 'start_time', 'duration', 'loop_count', 'loop_delay',
    // event-specific
    'apn', 'pdn_type', 'prog', 'args', 'tag', 'direction', 'bitrate',
    'packet_size', 'url', 'method', 'codec', 'destination', 'count',
    'interval', 'target_cell_id',
  ]);
  const extra: Record<string, unknown> = {};
  for (const k of Object.keys(e)) if (!known.has(k)) extra[k] = e[k];
  const withExtra = Object.keys(extra).length > 0 ? { _extra: extra } : {};

  switch (evt) {
    case 'power_on':
    case 'power_off':
      return { ...base, event: evt, ...withExtra };
    case 'pdn_connect':
    case 'pdn_disconnect':
      return {
        ...base,
        event: evt,
        apn: e.apn != null ? str(e.apn) : undefined,
        pdn_type: e.pdn_type != null ? (str(e.pdn_type) as 'ipv4' | 'ipv6' | 'ipv4v6') : undefined,
        ...withExtra,
      };
    case 'ext_app':
      return {
        ...base,
        event: 'ext_app',
        prog: str(e.prog),
        args: Array.isArray(e.args) ? (e.args as unknown[]).map(a => str(a)) : undefined,
        tag: e.tag != null ? str(e.tag) : undefined,
        ...withExtra,
      };
    case 'flood':
      return {
        ...base,
        event: 'flood',
        direction: (str(e.direction, 'dl') as 'dl' | 'ul' | 'both'),
        bitrate: str(e.bitrate, '10M'),
        packet_size: e.packet_size != null ? num(e.packet_size) : undefined,
        ...withExtra,
      };
    case 'http':
      return {
        ...base,
        event: 'http',
        url: str(e.url),
        method: e.method != null ? (str(e.method) as 'GET' | 'POST') : undefined,
        ...withExtra,
      };
    case 'voice':
      return { ...base, event: 'voice', codec: e.codec != null ? str(e.codec) : undefined, ...withExtra };
    case 'ping':
      return {
        ...base,
        event: 'ping',
        destination: str(e.destination),
        count: e.count != null ? num(e.count) : undefined,
        interval: e.interval != null ? num(e.interval) : undefined,
        ...withExtra,
      };
    case 'handover':
      return {
        ...base,
        event: 'handover',
        target_cell_id: num(e.target_cell_id),
        ...withExtra,
      };
    default:
      return null;
  }
}

function extractTrafficSection(parsed: Record<string, unknown>): TrafficSectionData {
  const ueList = (arr(parsed.ue_list) ?? [])
    .map(u => obj(u))
    .filter((u): u is Record<string, unknown> => u !== null);

  // Each UE's events become an inline template named "UE <i> events".
  // The user can later refactor by saving as named templates, but on first
  // load we preserve the per-UE granularity.
  const templates: TrafficTemplate[] = [];
  const assignments: UeAssignment[] = [];

  ueList.forEach((u, i) => {
    const events = (arr(u.sim_events) ?? [])
      .map(e => obj(e))
      .filter((e): e is Record<string, unknown> => e !== null)
      .map(e => extractSimEvent(e))
      .filter((e): e is SimEvent => e !== null);

    if (events.length > 0) {
      const id = `imported-ue-${i}`;
      templates.push({
        id,
        name: `UE ${i} events`,
        events,
      });
      assignments.push({ ue_id: i, template_id: id, start_offset: 0 });
    }
  });

  // Default address — Amarisoft top-level default_address
  const defaultAddr = parsed.default_address != null ? str(parsed.default_address) : undefined;

  // Try to infer ltesim_server from any ext_app calling iperf
  let serverIp = '192.168.3.1';
  let serverPort = 5001;
  let serverKind: TrafficServerConfig['kind'] = 'ltesim_server';
  for (const tpl of templates) {
    for (const ev of tpl.events) {
      if (ev.event === 'ext_app' && ev.args) {
        const cIdx = ev.args.indexOf('-c');
        if (cIdx >= 0 && cIdx + 1 < ev.args.length) {
          serverIp = ev.args[cIdx + 1];
          serverKind = 'iperf';
        }
      }
    }
  }

  return {
    templates,
    assignments,
    server: { ip: serverIp, port: serverPort, kind: serverKind },
    default_address: defaultAddr,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// User Plane section
// ────────────────────────────────────────────────────────────────────────────

function extractUserPlaneSection(parsed: Record<string, unknown>): UserPlaneSectionData {
  const ueList = (arr(parsed.ue_list) ?? [])
    .map(u => obj(u))
    .filter((u): u is Record<string, unknown> => u !== null);

  // Look at the first UE for plumbing settings — Amarisoft typically uses
  // the same setup for all UEs in a config.
  const first = ueList[0] ?? {};

  let mode: UserPlaneMode = 'sim';
  if (first.tun_setup_script != null) mode = 'tun';
  if (first.rue_addr != null) mode = 'remote';

  const result: UserPlaneSectionData = {
    mode,
    pdn_list: [],
  };
  if (first.tun_setup_script != null) result.tun_setup_script = str(first.tun_setup_script);
  if (first.tun_interface_name != null) result.tun_interface_name = str(first.tun_interface_name);
  if (first.rue_addr != null) result.rue_addr = str(first.rue_addr);
  if (first.rue_protocol != null) {
    const p = str(first.rue_protocol);
    if (p === 'sctp' || p === 'tcp') result.rue_protocol = p;
  }

  // pdn_list (if present at top level — sometimes lifted from MME-side config)
  if (Array.isArray(parsed.pdn_list)) {
    result.pdn_list = (parsed.pdn_list as unknown[])
      .map(p => obj(p))
      .filter((p): p is Record<string, unknown> => p !== null)
      .map<PdnEntry>(p => ({
        apn: str(p.access_point_name ?? p.apn),
        pdn_type: (str(p.pdn_type, 'ipv4') as PdnEntry['pdn_type']),
        default: bool(p.default),
      }));
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Channel section
// ────────────────────────────────────────────────────────────────────────────

const KNOWN_CHANNEL_TYPES: ChannelType[] =
  ['awgn', 'rayleigh', 'epa', 'eva', 'etu', 'tdl_a', 'tdl_b', 'tdl_c', 'custom'];

function asChannelType(v: unknown): ChannelType {
  const s = str(v, 'awgn').toLowerCase().replace('-', '_');
  return (KNOWN_CHANNEL_TYPES.includes(s as ChannelType) ? s : 'awgn') as ChannelType;
}

function extractChannelSection(parsed: Record<string, unknown>): ChannelSectionData {
  const channelSim = bool(parsed.channel_sim, false);
  const delaySim = bool(parsed.delay_sim, true);

  const perCell: PerCellChannel[] = [];
  const cellGroups = arr(parsed.cell_groups) ?? [];
  let cellIdx = 0;
  for (const g of cellGroups) {
    const grp = obj(g);
    if (!grp) continue;
    const cells = arr(grp.cells) ?? [];
    for (const c of cells) {
      const cell = obj(c);
      if (!cell) continue;
      const dlRaw = cell.channel_dl;
      const ulRaw = cell.channel_ul;
      const antRaw = cell.antenna;
      // Skip cells with no channel/antenna info — round-trip stability
      // requires we don't conjure defaults that weren't in the source.
      const hasInfo = (dlRaw !== undefined && dlRaw !== null)
        || (ulRaw !== undefined && ulRaw !== null)
        || (antRaw !== undefined && antRaw !== null)
        || cell.ref_signal_power !== undefined
        || cell.ul_power_attenuation !== undefined;
      if (!hasInfo) {
        cellIdx++;
        continue;
      }
      const dl = obj(dlRaw) ?? {};
      const ul = obj(ulRaw) ?? {};
      const antenna = obj(antRaw) ?? {};
      const entry: PerCellChannel = {
        cell_index: cellIdx,
        dl_type: asChannelType(dl.type),
        ul_type: asChannelType(ul.type),
        doppler_hz: dl.doppler_hz != null ? num(dl.doppler_hz) : (dl.doppler != null ? num(dl.doppler) : undefined),
        noise_floor_dbm_hz: dl.noise_floor != null ? num(dl.noise_floor) : undefined,
        ref_signal_power_dbm: cell.ref_signal_power != null ? num(cell.ref_signal_power) : undefined,
        ul_power_attenuation_db: cell.ul_power_attenuation != null ? num(cell.ul_power_attenuation) : undefined,
      };
      if (antenna.x != null) entry.antenna_x = num(antenna.x);
      if (antenna.y != null) entry.antenna_y = num(antenna.y);
      if (antenna.type != null) entry.antenna_type = str(antenna.type) as PerCellChannel['antenna_type'];
      perCell.push(entry);
      cellIdx++;
    }
  }

  const ueList = (arr(parsed.ue_list) ?? [])
    .map(u => obj(u))
    .filter((u): u is Record<string, unknown> => u !== null);

  const mobility: UeMobility[] = [];
  ueList.forEach((u, i) => {
    const hasPos = Array.isArray(u.position);
    const hasSpeed = u.speed !== undefined;
    const hasDir = u.direction !== undefined;
    const hasAnt = obj(u.antenna) !== null && obj(u.antenna) !== undefined;
    const hasWaypoints = Array.isArray(u.waypoints);
    if (!hasPos && !hasSpeed && !hasDir && !hasAnt && !hasWaypoints) return;

    const pos = hasPos ? (u.position as unknown[]) : [0, 0, 0];
    const m: UeMobility = {
      ue_id: i,
      position: [num(pos[0], 0), num(pos[1], 0), num(pos[2], 0)],
      speed: num(u.speed, 0),
      direction: num(u.direction, 0),
    };
    const ant = obj(u.antenna);
    if (ant?.type != null) {
      const t = str(ant.type);
      if (t === 'isotropic' || t === 'dipole') m.antenna_type = t;
    }
    if (hasWaypoints) {
      m.waypoints = (u.waypoints as unknown[])
        .filter(w => Array.isArray(w))
        .map(w => {
          const ww = w as unknown[];
          return [num(ww[0]), num(ww[1]), num(ww[2])] as [number, number, number];
        });
    }
    mobility.push(m);
  });

  return {
    channel_sim: channelSim,
    delay_sim: delaySim,
    map_extent_m: 1000,
    per_cell: perCell,
    mobility,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Settings section
// ────────────────────────────────────────────────────────────────────────────

const ALL_LAYERS: LogLayer[] = ['phy', 'mac', 'rlc', 'pdcp', 'rrc', 'nas', 'gtpu', 'ip', 'all'];
const VALID_LEVELS: LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];

/**
 * Parse Amarisoft's log_options string:
 *   "all.level=error,all.max_size=0,nas.level=debug,nas.max_size=1"
 * into a structured LayerLogConfig[] keyed by layer. Tokens the structured
 * editor doesn't model (other layers like ngap/s1ap, global flags, unknown
 * fields) are collected into `extra` so they survive a round-trip.
 */
function parseLogOptions(s: string): { layers: LayerLogConfig[]; extra: string[] } {
  const map = new Map<LogLayer, { level: LogLevel; max_size: number }>();
  const extra: string[] = [];
  // Default for every layer = error/0 if 'all' is set
  const tokens = s.split(',').map(t => t.trim()).filter(Boolean);
  for (const tok of tokens) {
    const mm = tok.match(/^([a-z]+)\.([a-z_]+)\s*=\s*(.+)$/i);
    if (!mm) { extra.push(tok); continue; }
    const layer = mm[1].toLowerCase() as LogLayer;
    if (!ALL_LAYERS.includes(layer)) { extra.push(tok); continue; }
    const field = mm[2];
    const value = mm[3];
    const cur = map.get(layer) ?? { level: 'error', max_size: 0 };
    if (field === 'level') {
      const lv = value as LogLevel;
      if (VALID_LEVELS.includes(lv)) cur.level = lv;
      else { extra.push(tok); continue; }
    } else if (field === 'max_size') {
      cur.max_size = num(value, 0);
    } else {
      extra.push(tok);
      continue;
    }
    map.set(layer, cur);
  }
  const out: LayerLogConfig[] = [];
  for (const [layer, { level, max_size }] of map) {
    out.push({ layer, level, max_size });
  }
  // Ensure standard layers always appear (inheriting from 'all' when set).
  const allEntry = out.find(x => x.layer === 'all');
  if (allEntry) {
    for (const l of ['phy', 'mac', 'rlc', 'pdcp', 'rrc', 'nas'] as LogLayer[]) {
      if (!out.find(x => x.layer === l)) {
        out.push({ layer: l, level: allEntry.level, max_size: allEntry.max_size });
      }
    }
  }
  // Sort consistently with emitter: 'all' first, then alphabetical
  out.sort((a, b) => {
    if (a.layer === 'all') return -1;
    if (b.layer === 'all') return 1;
    return a.layer < b.layer ? -1 : 1;
  });
  return { layers: out, extra };
}

function extractSettingsSection(parsed: Record<string, unknown>): SettingsSectionData {
  const logOptStr = str(parsed.log_options, 'all.level=error');
  const { layers: log_layers, extra: logExtra } = parseLogOptions(logOptStr);
  const log_filename = str(parsed.log_filename, '/tmp/ue0.log');
  const com_addr = str(parsed.com_addr, '[::]:9002');

  const rfRaw = obj(parsed.rf_driver) ?? {};
  const rf_driver: RfDriverConfig = {
    name: str(rfRaw.name, 'sdr'),
    args: rfRaw.args != null ? str(rfRaw.args) : undefined,
    sync: rfRaw.sync != null
      ? (str(rfRaw.sync) as RfDriverConfig['sync'])
      : undefined,
    rx_antenna: rfRaw.rx_antenna != null
      ? (str(rfRaw.rx_antenna) as RfDriverConfig['rx_antenna'])
      : undefined,
    fifo_tx_time: rfRaw.fifo_tx_time != null ? num(rfRaw.fifo_tx_time) : undefined,
    rx_latency: rfRaw.rx_latency != null ? num(rfRaw.rx_latency) : undefined,
  };

  const result: SettingsSectionData = {
    log_layers,
    ...(logExtra.length > 0 ? { log_options_extra: logExtra.join(',') } : {}),
    log_filename,
    com_addr,
    tx_gain: num(parsed.tx_gain, 90),
    rx_gain: num(parsed.rx_gain, 60),
    rf_driver,
  };
  if (parsed.com_auth != null) result.com_auth = bool(parsed.com_auth);
  if (parsed.com_password != null) result.com_password = str(parsed.com_password);
  if (Array.isArray(parsed.cpu_core_list)) {
    result.cpu_core_list = (parsed.cpu_core_list as unknown[]).map(v => num(v));
  }
  if (parsed.pdcch_decode_opt != null) result.pdcch_decode_opt = bool(parsed.pdcch_decode_opt);
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Split a parsed ue.cfg into the six section data shapes.
 * The same ue_list is referenced by multiple sections — Subscriber owns
 * identity, Traffic owns sim_events, UserPlane owns TUN plumbing, Channel
 * owns mobility. They are reassembled on emit.
 */
export function mapToSections(parsed: ParsedUeCfg): MaterializedProfile {
  const r = parsed.raw;
  return {
    cell: extractCellSection(r),
    subscriber: extractSubscriberSection(r),
    traffic: extractTrafficSection(r),
    userPlane: extractUserPlaneSection(r),
    channel: extractChannelSection(r),
    settings: extractSettingsSection(r),
  };
}

/**
 * Convenience alias that takes a raw parsed record (not the ParsedUeCfg
 * envelope). Used by tests and code paths that already have a record on hand.
 */
export function splitCfgIntoSections(raw: Record<string, unknown>): MaterializedProfile {
  return mapToSections({ raw, warnings: [] });
}

// ────────────────────────────────────────────────────────────────────────────
// NOTE: the old reverse mapper (mergeSectionsIntoCfg) was removed — it was
// unused and contradicted cfgEmitter (channel keys nested instead of
// cell-level, UI-only `duration` written verbatim into sim_events, antennas
// dropped). The one true profile→cfg path is cfgEmitter.emitUeCfg.
// ────────────────────────────────────────────────────────────────────────────

// Re-emit lives in cfgEmitter.ts. We export the helpers so the emitter
// can reuse the parsing direction logic if needed.
export const _testing = {
  parseLogOptions,
  asChannelType,
};

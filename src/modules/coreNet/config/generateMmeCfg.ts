// modules/coreNet/config/generateMmeCfg.ts
//
// CoreConfig → Amarisoft ltemme configuration (mme.cfg).
//
// Written to match the live mme.cfg on the lab callbox (192.168.1.106,
// version 2022-12-16) key for key: plmn / mme_group_id / mme_code, the
// pdn_list with its erabs and optional 5G slices, ims_list and the
// ims_vops_* flags, the Rx interface, emergency_number_list, the NAS
// algorithm preference arrays, and a ue_db that can either sit inline or be
// pulled in with `include`, the way the bench keeps 1000 subscribers out of
// the main file.
//
// Like the UE-SIM wizard, the whole form is embedded as JSON in a header
// comment so the config reopens exactly.

import type { CoreConfig, Erab, PdnEntry, SubscriberRange } from './types';
import {
  addressList, expandSubscribers, imsDomainFor, plmnString, poolCapacity,
  totalSubscribers, underCapacityPdns, ipv4ToInt,
} from './derive';
import { LOG_PRESETS, normalizeCoreConfig } from './defaults';

export const CORE_MARKER = '@corenet-config:';

// ── Field map (the "where each parameter goes" panel) ────────────────────

export interface FieldMapping {
  step: string;
  field: string;
  target: string;
  kind: 'cfg' | 'db' | 'header';
}

export const FIELD_MAP: FieldMapping[] = [
  { step: 'Network', field: 'MCC / MNC', target: 'plmn', kind: 'cfg' },
  { step: 'Network', field: 'MME group ID, MME code', target: 'mme_group_id, mme_code', kind: 'cfg' },
  { step: 'Network', field: 'GTP-U address', target: 'gtp_addr (also the default S1AP/NGAP bind)', kind: 'cfg' },
  { step: 'Network', field: 'Network name / short name', target: 'network_name, network_short_name', kind: 'cfg' },
  { step: 'Network', field: 'DCNR, CP-CIoT, 15 bearers', target: 'dcnr_support, cp_ciot_opt, fifteen_bearers', kind: 'cfg' },
  { step: 'Network', field: 'EPS ↔ 5GS interworking', target: 'eps_5gs_interworking', kind: 'cfg' },
  { step: 'Network', field: 'eDRX', target: 'edrx, edrx_cycle_forced', kind: 'cfg' },
  { step: 'Network', field: 'Slices (5GC)', target: 'nssai[]', kind: 'cfg' },
  { step: 'Network', field: 'TAC', target: 'header (the cell broadcasts the TAC, not the core)', kind: 'header' },
  { step: 'PDN', field: 'APN, PDN type, pool, DNS, gateway', target: 'pdn_list[].access_point_name, pdn_type, first_ip_addr, last_ip_addr, dns_addr, gateway', kind: 'cfg' },
  { step: 'PDN', field: 'Address spacing', target: 'pdn_list[].ip_addr_shift (spacing = 2^shift)', kind: 'cfg' },
  { step: 'PDN', field: 'IPv6 prefixes', target: 'pdn_list[].first_ipv6_prefix, last_ipv6_prefix', kind: 'cfg' },
  { step: 'PDN', field: 'P-CSCF, emergency flag', target: 'pdn_list[].p_cscf_addr, emergency', kind: 'cfg' },
  { step: 'PDN', field: 'Bearer QoS', target: 'pdn_list[].erabs[]', kind: 'cfg' },
  { step: 'PDN', field: 'Slice QoS flows', target: 'pdn_list[].slices[].snssai, qos_flows[]', kind: 'cfg' },
  { step: 'PDN', field: 'TUN setup script', target: 'tun_setup_script', kind: 'cfg' },
  { step: 'Subscribers', field: 'Count, starting IMSI', target: 'one ue_db[] entry per subscriber', kind: 'db' },
  { step: 'Subscribers', field: 'Algorithm, K, OP/OPc, AMF, SQN', target: 'ue_db[].sim_algo, K, op/opc, amf, sqn', kind: 'db' },
  { step: 'Subscribers', field: 'IMS identities', target: 'ue_db[].impi, impu[], domain, pwd', kind: 'db' },
  { step: 'Subscribers', field: 'Separate database file', target: 'include "<file>" instead of an inline ue_db', kind: 'cfg' },
  { step: 'IMS & Voice', field: 'IMS server / bind address', target: 'ims_list[]', kind: 'cfg' },
  { step: 'IMS & Voice', field: 'VoPS flags', target: 'ims_vops_eps, ims_vops_5gs_3gpp, ims_vops_5gs_n3gpp', kind: 'cfg' },
  { step: 'IMS & Voice', field: 'Rx interface', target: 'rx.bind_addr, rx.qci.audio / video', kind: 'cfg' },
  { step: 'IMS & Voice', field: 'Emergency numbers', target: 'emergency_number_list[]', kind: 'cfg' },
  { step: 'Settings', field: 'Log settings', target: 'log_options, log_filename', kind: 'cfg' },
  { step: 'Settings', field: 'Remote API port', target: 'com_addr', kind: 'cfg' },
  { step: 'Settings', field: 'Licence server and tag', target: 'license_server', kind: 'cfg' },
  { step: 'Settings', field: 'NAS algorithm preference', target: 'nas_cipher_algo_pref, nas_integ_algo_pref', kind: 'cfg' },
  { step: 'Settings', field: 'Config name, description', target: 'header', kind: 'header' },
];

// ── Pretty printer ───────────────────────────────────────────────────────
// ltemme reads JSON with comments and bare keys; hex literals and the bare
// `include` directive need to pass through verbatim.

class RawToken {
  constructor(public text: string) {}
}
const raw = (text: string) => new RawToken(text);
const hex = (n: number) => raw('0x' + n.toString(16));

type Node = Record<string, unknown>;

const pad = (level: number) => '  '.repeat(level);
const BARE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
  const isComment = (k: string) => k.startsWith('//');
  const lastValueIdx = entries.reduce((last, [k], i) => (isComment(k) ? last : i), -1);
  const lines = entries.map(([k, v], i) => {
    if (isComment(k)) return pad(level + 1) + `/* ${String(v)} */`;
    const comma = i < lastValueIdx ? ',' : '';
    // A "#raw" key emits its value as a bare directive, e.g. include "x.cfg".
    if (k.startsWith('#raw')) return pad(level + 1) + String(v) + comma;
    const key = BARE_KEY.test(k) ? k : JSON.stringify(k);
    return pad(level + 1) + `${key}: ${printValue(v, level + 1)}${comma}`;
  });
  return '{\n' + lines.join('\n') + '\n' + pad(level) + '}';
}

// ── Sections ─────────────────────────────────────────────────────────────

function erabNode(e: Erab, fiveG: boolean): Node {
  const n: Node = {};
  if (fiveG) n['5qi'] = e.qci; else n.qci = e.qci;
  n.priority_level = e.priorityLevel;
  n.pre_emption_capability = e.preemptionCapability;
  n.pre_emption_vulnerability = e.preemptionVulnerability;
  return n;
}

function pdnNode(p: PdnEntry): Node {
  const n: Node = {};
  n.access_point_name = p.apn;
  n.pdn_type = p.pdnType;
  if (p.emergency) n.emergency = true;
  if (p.gateway.trim()) n.gateway = p.gateway.trim();
  if (p.pdnType !== 'non-ip') {
    if (p.pdnType !== 'ipv6') {
      n.first_ip_addr = p.firstIpAddr;
      n.last_ip_addr = p.lastIpAddr;
      n.ip_addr_shift = p.ipAddrShift;
    }
    if (p.pdnType === 'ipv6' || p.pdnType === 'ipv4v6') {
      if (p.firstIpv6Prefix.trim()) n.first_ipv6_prefix = p.firstIpv6Prefix.trim();
      if (p.lastIpv6Prefix.trim()) n.last_ipv6_prefix = p.lastIpv6Prefix.trim();
    }
  }
  const pcscf = addressList(p.pCscfAddr);
  if (pcscf.length) n.p_cscf_addr = pcscf;
  const dns = addressList(p.dnsAddr);
  if (dns.length === 1) n.dns_addr = dns[0];
  else if (dns.length > 1) n.dns_addr = dns;
  if (p.erabs.length) n.erabs = p.erabs.map(e => erabNode(e, false));
  if (p.slices.length) {
    n.slices = p.slices.map(s => {
      const snssai: Node = { sst: s.sst };
      if (s.sd.trim()) snssai.sd = /^0x/i.test(s.sd.trim()) ? raw(s.sd.trim()) : Number(s.sd) || s.sd.trim();
      return { snssai, qos_flows: s.qosFlows.map(q => erabNode(q, true)) };
    });
  }
  return n;
}

function amfValue(s: string): unknown {
  const t = s.trim();
  if (!t) return undefined;
  if (/^0x[0-9a-f]+$/i.test(t)) return raw(t.toLowerCase());
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

function subscriberNode(sub: ReturnType<typeof expandSubscribers>[number], r: SubscriberRange): Node {
  const n: Node = {};
  n.sim_algo = r.simAlgo;
  n.imsi = sub.imsi;
  const amf = amfValue(r.amf);
  if (amf !== undefined) n.amf = amf;
  if (r.sqn.trim()) n.sqn = r.sqn.trim();
  n.K = sub.K;
  if (r.simAlgo !== 'xor' && r.opType !== 'none' && r.opValue.trim()) {
    if (r.opType === 'OPc') n.opc = r.opValue.trim();
    else n.op = r.opValue.trim();
  }
  if (r.imsEnabled) {
    n.impi = sub.impi;
    n.impu = sub.impu;
    n.domain = sub.domain;
    if (r.imsPassword.trim()) n.pwd = r.imsPassword.trim();
  }
  return n;
}

function ueDbArray(cfg: CoreConfig): Node[] {
  return expandSubscribers(cfg).map(s => subscriberNode(s, s.range));
}

// ── Header ───────────────────────────────────────────────────────────────

function summaryLines(cfg: CoreConfig): string[] {
  const n = cfg.network;
  const subs = totalSubscribers(cfg);
  const lines = [
    `Config    : ${cfg.settings.configName}`,
    `Core      : ${n.coreType}   PLMN ${plmnString(n.mcc, n.mnc)} (MCC ${n.mcc} / MNC ${n.mnc})   TAC ${n.tac}`,
    `Identity  : mme_group_id ${n.mmeGroupId}, mme_code ${n.mmeCode}, GTP-U ${n.gtpAddr}`,
    `Subscribers: ${subs} in ${cfg.subscriber.ranges.length} range(s)${cfg.subscriber.separateFile ? ` (ue_db in ${cfg.subscriber.includeFilename})` : ''}`,
  ];
  for (const r of cfg.subscriber.ranges) {
    lines.push(`  range ${r.id}: ${r.count} × ${r.simAlgo}, IMSI from ${r.startingImsi}${r.imsEnabled ? ', IMS identities' : ''}`);
  }
  for (const p of cfg.pdn.pdns) {
    const cap = poolCapacity(p);
    lines.push(`APN       : ${p.apn} (${p.pdnType})${p.emergency ? ' emergency' : ''} ${p.firstIpAddr}–${p.lastIpAddr}${cap != null ? ` = ${cap} addresses` : ''}`);
  }
  if (cfg.ims.enabled) lines.push(`IMS       : ${cfg.ims.imsAddr} (bind ${cfg.ims.bindAddr})${cfg.ims.rxEnabled ? `, Rx on ${cfg.ims.rxBindAddr}` : ''}`);
  lines.push(`Log       : ${cfg.settings.logSettings}   Remote API 0.0.0.0:${cfg.settings.comPort}`);
  if (cfg.settings.description.trim()) lines.push(`Note      : ${cfg.settings.description.trim()}`);
  return lines.flatMap(l => l.split(/\r?\n/)).map(l => l.replace(/\*\//g, '* /'));
}

export function buildHeader(cfg: CoreConfig): string {
  const meta = JSON.stringify(cfg).replace(/\*\//g, '*\\/');
  const summary = summaryLines(cfg).map(l => ` * ${l}`).join('\n');
  return [
    `/* ${CORE_MARKER}${meta} */`,
    '/* simtool — Core network configuration (generated ' + new Date().toISOString() + ')',
    summary,
    ' */',
  ].join('\n') + '\n';
}

export function extractCoreConfig(text: string): CoreConfig | null {
  const idx = text.indexOf(CORE_MARKER);
  if (idx < 0) return null;
  const start = idx + CORE_MARKER.length;
  const end = text.indexOf('*/', start);
  if (end < 0) return null;
  try {
    const json = text.slice(start, end).trim().replace(/\*\\\//g, '*/');
    return normalizeCoreConfig(JSON.parse(json));
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export function logFilenameFor(cfg: CoreConfig): string {
  if (cfg.settings.logFilename.trim()) return cfg.settings.logFilename.trim();
  const name = (cfg.settings.configName || 'mme').trim().replace(/[^\w.-]+/g, '_');
  return `/tmp/${name}.log`;
}

export interface GenerateOptions {
  bodyOnly?: boolean;
}

export function generateMmeCfg(cfg: CoreConfig, options: GenerateOptions = {}): string {
  const n = cfg.network;
  const five = n.coreType !== 'EPC';
  const eps = n.coreType !== '5GC';
  const top: Node = {};

  top.log_options = LOG_PRESETS[cfg.settings.logSettings]?.logOptions ?? LOG_PRESETS.nas_s1ap_debug.logOptions;
  top.log_filename = logFilenameFor(cfg);
  if (cfg.settings.licenseServerAddr.trim() && cfg.settings.licenseTag.trim()) {
    top.license_server = { server_addr: cfg.settings.licenseServerAddr.trim(), tag: cfg.settings.licenseTag.trim() };
  }
  top.com_addr = `0.0.0.0:${cfg.settings.comPort || 9000}`;
  top.gtp_addr = n.gtpAddr;

  top.plmn = plmnString(n.mcc, n.mnc);
  top.mme_group_id = n.mmeGroupId;
  top.mme_code = n.mmeCode;
  top.network_name = n.networkName;
  top.network_short_name = n.networkShortName;

  if (n.edrx) {
    top.edrx = true;
    top.edrx_cycle_forced = n.edrxCycleForced;
  }
  if (n.cpCiotOpt) top.cp_ciot_opt = true;
  if (n.dcnrSupport) top.dcnr_support = true;
  top.fifteen_bearers = n.fifteenBearers;
  if (five && eps && n.epsInterworking !== 'none') top.eps_5gs_interworking = n.epsInterworking;
  if (five && n.nssai.length) {
    top.nssai = n.nssai.map(s => {
      const node: Node = { sst: s.sst };
      if (s.sd.trim()) node.sd = /^0x/i.test(s.sd.trim()) ? raw(s.sd.trim()) : Number(s.sd) || s.sd.trim();
      return node;
    });
  }

  if (cfg.ims.enabled) {
    if (eps) top.ims_vops_eps = cfg.ims.vopsEps;
    if (five) {
      top.ims_vops_5gs_3gpp = cfg.ims.vops5gs;
      top.ims_vops_5gs_n3gpp = cfg.ims.vops5gsN3gpp;
    }
    if (cfg.ims.emergencyNumbers.length) {
      top.emergency_number_list = cfg.ims.emergencyNumbers.map(e => ({ category: hex(e.category), digits: e.digits }));
    }
    if (cfg.ims.rxEnabled) {
      top.rx = { bind_addr: cfg.ims.rxBindAddr, qci: { audio: cfg.ims.rxQciAudio, video: cfg.ims.rxQciVideo } };
    }
    top.ims_list = [{ ims_addr: cfg.ims.imsAddr, bind_addr: cfg.ims.bindAddr }];
  }

  top['//pdn'] = 'Public Data Networks. The first one is the default.';
  top.pdn_list = cfg.pdn.pdns.map(pdnNode);
  if (cfg.pdn.tunSetupScript.trim()) top.tun_setup_script = cfg.pdn.tunSetupScript.trim();

  top.nas_cipher_algo_pref = cfg.settings.nasCipherPref;
  top.nas_integ_algo_pref = cfg.settings.nasIntegPref;

  top['//db'] = 'user data base';
  if (cfg.subscriber.separateFile) {
    top['#raw_include'] = `include "${cfg.subscriber.includeFilename}"`;
  } else {
    top.ue_db = ueDbArray(cfg);
  }

  const body = printObject(top, 0) + '\n';
  return options.bodyOnly ? body : buildHeader(cfg) + body;
}

/** The separate subscriber database, when the config uses `include`. */
export function generateUeDbFile(cfg: CoreConfig): string {
  const header = `/* simtool — subscriber database for ${cfg.settings.configName}\n * ${totalSubscribers(cfg)} subscribers, generated ${new Date().toISOString()}\n */\n`;
  return header + printObject({ ue_db: ueDbArray(cfg) }, 0).replace(/^\{\n|\n\}$/g, '') .replace(/^ {2}/gm, '') + '\n';
}

// ── Validation ───────────────────────────────────────────────────────────

export function validateCoreConfig(cfg: CoreConfig): string[] {
  const issues: string[] = [];
  const n = cfg.network;
  if (!cfg.settings.configName.trim()) issues.push('Settings: configuration name is required');
  if (!/^\d{3}$/.test(n.mcc)) issues.push('Network: MCC must be 3 digits');
  if (!/^\d{2,3}$/.test(n.mnc)) issues.push('Network: MNC must be 2 or 3 digits');
  if (!(n.mmeGroupId >= 0 && n.mmeGroupId <= 65535)) issues.push('Network: MME group ID must be 0–65535');
  if (!(n.mmeCode >= 0 && n.mmeCode <= 255)) issues.push('Network: MME code must be 0–255');
  if (!n.gtpAddr.trim()) issues.push('Network: GTP-U address is required');

  if (cfg.pdn.pdns.length === 0) issues.push('PDN: at least one APN is required');
  const apns = new Set<string>();
  cfg.pdn.pdns.forEach(p => {
    if (!p.apn.trim()) issues.push(`PDN ${p.id}: APN name is required`);
    if (apns.has(p.apn.trim())) issues.push(`PDN ${p.id}: APN "${p.apn}" is used twice`);
    apns.add(p.apn.trim());
    if (p.pdnType !== 'non-ip' && p.pdnType !== 'ipv6') {
      const first = ipv4ToInt(p.firstIpAddr);
      const last = ipv4ToInt(p.lastIpAddr);
      if (first == null) issues.push(`PDN ${p.id}: first IP address is invalid`);
      if (last == null) issues.push(`PDN ${p.id}: last IP address is invalid`);
      if (first != null && last != null && last < first) issues.push(`PDN ${p.id}: last IP address is below the first`);
    }
    if ((p.pdnType === 'ipv6' || p.pdnType === 'ipv4v6') && !p.firstIpv6Prefix.trim()) {
      issues.push(`PDN ${p.id}: ${p.pdnType} needs an IPv6 prefix range`);
    }
    if (p.erabs.length === 0) issues.push(`PDN ${p.id}: at least one bearer QoS entry is required`);
    p.erabs.forEach(e => {
      if (!(e.qci >= 1 && e.qci <= 254)) issues.push(`PDN ${p.id}: QCI must be 1–254`);
      if (!(e.priorityLevel >= 1 && e.priorityLevel <= 15)) issues.push(`PDN ${p.id}: priority level must be 1–15`);
    });
  });

  if (cfg.subscriber.ranges.length === 0) issues.push('Subscribers: at least one range is required');
  const seen = new Set<string>();
  cfg.subscriber.ranges.forEach(r => {
    if (!(r.count >= 1)) issues.push(`Subscriber range ${r.id}: count must be at least 1`);
    if (!/^\d{15}$/.test(r.startingImsi.trim())) issues.push(`Subscriber range ${r.id}: starting IMSI must be 15 digits`);
    if (!/^[0-9a-fA-F]{32}$/.test(r.K.trim())) issues.push(`Subscriber range ${r.id}: K must be 32 hex characters`);
    if (r.simAlgo === 'milenage' && r.opType === 'none') issues.push(`Subscriber range ${r.id}: Milenage needs an OP or OPc`);
    if (r.simAlgo !== 'xor' && r.opType !== 'none' && !/^[0-9a-fA-F]{32}$/.test(r.opValue.trim())) {
      issues.push(`Subscriber range ${r.id}: ${r.opType} must be 32 hex characters`);
    }
    if (r.sqn.trim() && !/^[0-9a-fA-F]{12}$/.test(r.sqn.trim())) issues.push(`Subscriber range ${r.id}: SQN must be 12 hex characters`);
    const plmn = plmnString(n.mcc, n.mnc);
    if (!r.startingImsi.startsWith(plmn)) {
      issues.push(`Subscriber range ${r.id}: IMSI ${r.startingImsi} does not start with the PLMN ${plmn}, so these subscribers will not be found`);
    }
  });
  for (const s of expandSubscribers(cfg, 5000)) {
    if (seen.has(s.imsi)) { issues.push(`Subscribers: IMSI ${s.imsi} appears in more than one range`); break; }
    seen.add(s.imsi);
  }

  for (const u of underCapacityPdns(cfg)) {
    issues.push(`PDN ${u.pdn.id}: "${u.pdn.apn}" has ${u.capacity} addresses for ${u.needed} subscribers`);
  }

  if (cfg.ims.enabled) {
    if (!cfg.ims.imsAddr.trim()) issues.push('IMS: server address is required when IMS is on');
    if (!cfg.ims.bindAddr.trim()) issues.push('IMS: bind address is required when IMS is on');
    if (cfg.ims.rxEnabled && !cfg.ims.rxBindAddr.trim()) issues.push('IMS: the Rx interface needs a bind address');
    const hasIms = cfg.pdn.pdns.some(p => p.apn.trim().toLowerCase() === 'ims' || addressList(p.pCscfAddr).length > 0);
    if (!hasIms) issues.push('IMS is on but no APN carries a P-CSCF address, so the UE cannot reach it');
  }
  if (cfg.subscriber.separateFile && !cfg.subscriber.includeFilename.trim()) {
    issues.push('Subscribers: a filename is required when the database is a separate file');
  }
  void imsDomainFor;
  return issues;
}

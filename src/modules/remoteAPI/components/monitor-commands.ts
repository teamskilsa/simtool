// Monitor-style commands for the Screen Monitor terminal.
//
// The Amarisoft remote API (docs 2026-09-11) has NO message that runs
// lteenb/ltemme console commands: the old terminal sent
// {message:"monitor", data:"t g\n"}, which is not documented for any
// component. Each console command below is instead TRANSLATED to the
// documented remote API message with the same effect (cell_gain <id> <gain>
// -> {"message":"cell_gain", ...}). Commands with no remote API equivalent
// (pcap, hwcaps ...) are listed as CLI-only: run them in the component's
// `screen` session on the box.

import type { ComponentType, RemoteAPIMessage } from '../types';

export type MonitorCommandType = {
  /** Console command, possibly two words ("t g"). */
  value: string;
  label: string;
  description: string;
  /** Console syntax. */
  example?: string;
  /** Build the request from the arguments after `value`; a string is a usage error. */
  toApi?: (args: string[]) => RemoteAPIMessage | string;
  /** Repeat every `period` seconds until Enter (like the console `t` traces). */
  periodic?: boolean;
  /** Stream log_get until Enter. */
  stream?: boolean;
  /** Why this command cannot run over the remote API. */
  cliOnly?: string;
  /** Short text rendering of the response; JSON otherwise. */
  format?: (resp: any) => string;
};

export type MonitorCommandSection = {
  category: string;
  description?: string;
  items: MonitorCommandType[];
};

// ── Arg helpers ─────────────────────────────────────────────────────────────

const toInt = (s: string | undefined) => (s !== undefined && /^-?\d+$/.test(s) ? Number(s) : undefined);
const toNum = (s: string | undefined) => (s !== undefined && s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : undefined);

/** `key=value` options and positional args. */
function splitArgs(args: string[]) {
  const pos: string[] = [];
  const opts: Record<string, string> = {};
  for (const a of args) {
    const m = /^([a-z_]+)=(.*)$/i.exec(a);
    if (m) opts[m[1]] = m[2];
    else pos.push(a);
  }
  return { pos, opts };
}

const pad = (v: unknown, n: number) => String(v ?? '-').padEnd(n).slice(0, Math.max(n, String(v ?? '-').length));
const rate = (bps: unknown) => (typeof bps === 'number' ? `${(bps / 1e6).toFixed(2)}M` : '-');

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtStats(r: any): string {
  const lines: string[] = [];
  const cpu = r.cpu ? Object.entries(r.cpu).map(([k, v]) => `${k}=${Math.round(Number(v))}%`).join(' ') : '';
  lines.push(`dur=${r.duration ?? '-'}s ${cpu}`);
  for (const [id, c] of Object.entries<any>(r.cells ?? {})) {
    lines.push(`  cell ${pad(id, 3)} dl ${pad(rate(c.dl_bitrate), 8)} ul ${pad(rate(c.ul_bitrate), 8)} ue ${c.ue_count_avg ?? '-'} dl_tx ${c.dl_tx ?? '-'} dl_retx ${c.dl_retx ?? '-'} ul_tx ${c.ul_tx ?? '-'} ul_retx ${c.ul_retx ?? '-'}`);
  }
  if (r.samples) {
    (r.samples.tx ?? []).forEach((s: any, i: number) => lines.push(`  tx${i} rms ${s.rms?.toFixed?.(1) ?? '-'} dBFS max ${s.max?.toFixed?.(1) ?? '-'} sat ${s.sat ?? '-'}`));
    (r.samples.rx ?? []).forEach((s: any, i: number) => lines.push(`  rx${i} rms ${s.rms?.toFixed?.(1) ?? '-'} dBFS max ${s.max?.toFixed?.(1) ?? '-'} sat ${s.sat ?? '-'}`));
  }
  if (r.emm_registered_ue_count !== undefined) lines.push(`  registered UEs ${r.emm_registered_ue_count}`);
  return lines.join('\r\n');
}

function fmtEnbUes(r: any): string {
  const list: any[] = r.ue_list ?? [];
  if (!list.length) return '(no UE)';
  const head = 'enb_ue_id ran_ue_id rnti   cells        cqi ri dl_bitrate ul_bitrate dl_mcs ul_mcs';
  const rows = list.map(u => {
    const c = u.cells?.[0] ?? {};
    return `${pad(u.enb_ue_id, 9)} ${pad(u.ran_ue_id, 9)} ${pad(typeof u.rnti === 'number' ? u.rnti.toString(16) : u.rnti, 6)} ${pad((u.cells ?? []).map((x: any) => x.cell_id).join(','), 12)} ${pad(c.cqi, 3)} ${pad(c.ri, 2)} ${pad(rate(c.dl_bitrate), 10)} ${pad(rate(c.ul_bitrate), 10)} ${pad(c.dl_mcs?.toFixed?.(1), 6)} ${pad(c.ul_mcs?.toFixed?.(1), 6)}`;
  });
  return [head, ...rows].join('\r\n');
}

function fmtCells(r: any): string {
  const cells = r.cells ?? {};
  const ids = Object.keys(cells);
  if (!ids.length) return '(no LTE/NR cell in config_get)';
  const head = 'cell pci  dl_earfcn/arfcn  n_rb_dl gain   ul_disabled label';
  return [head, ...ids.map(id => {
    const c = cells[id];
    return `${pad(id, 4)} ${pad(c.n_id_cell, 4)} ${pad(c.dl_earfcn ?? c.ssb_nr_arfcn ?? c.dl_nr_arfcn, 16)} ${pad(c.n_rb_dl, 7)} ${pad(c.gain, 6)} ${pad(c.ul_disabled, 11)} ${c.label ?? ''}`;
  })].join('\r\n');
}

function fmtLinks(listKey: string) {
  return (r: any) => {
    const list: any[] = r[listKey] ?? [];
    if (!list.length) return `(no ${listKey})`;
    return list.map(l => `${pad(l.state, 12)} ${pad(l.address ?? l.addr, 24)} ${l.name ?? ''} ${l.PLMN ?? ''}`).join('\r\n');
  };
}

function fmtRf(r: any): string {
  return [`tx_gain ${JSON.stringify(r.tx_gain)}`, `rx_gain ${JSON.stringify(r.rx_gain)}`, r.rf_info ? String(r.rf_info).replace(/\n/g, '\r\n') : ''].join('\r\n');
}

// ── Command builders ────────────────────────────────────────────────────────

const simple = (value: string, message: string, label: string, description: string, format?: (r: any) => string): MonitorCommandType => ({
  value, label, description, toApi: () => ({ message }), format,
});

const tStats = (value: string, label: string, description: string, extra: Record<string, unknown> = {}): MonitorCommandType => ({
  value, label, description, example: `${value} [period]`, periodic: true, format: fmtStats,
  toApi: () => ({ message: 'stats', ...extra }),
});

const helpCmd: MonitorCommandType = {
  value: 'help', label: 'Help', description: 'List terminal commands, then the messages the server accepts.',
  toApi: () => ({ message: 'help' }),
  format: (r) => `server messages: ${(r.messages ?? []).join(' ')}${r.events?.length ? `\r\nserver events: ${r.events.join(' ')}` : ''}`,
};
const logsCmd: MonitorCommandType = {
  value: 'logs', label: 'Stream logs', description: 'Stream log_get until Enter. Optional layer=level filters, e.g. logs RRC=debug S1AP=info.',
  example: 'logs [LAYER=level ...]', stream: true,
  toApi: (args) => {
    const { opts } = splitArgs(args);
    const layers = Object.fromEntries(Object.entries(opts).map(([k, v]) => [k.toUpperCase(), v]));
    return { message: 'log_get', min: 1, max: 200, timeout: 1, allow_empty: true, ...(Object.keys(layers).length ? { layers } : {}) };
  },
};
const licenseCmd = simple('license', 'license', 'License', 'License file information.', (r) => `products ${r.products ?? '-'}\r\nuser ${r.user ?? '-'}\r\nvalidity ${r.validity ?? '-'}\r\nid ${r.id ?? '-'} (${r.id_type ?? '-'})`);
const logCfgCmd: MonitorCommandType = { value: 'log', label: 'Log config', description: 'Show the log configuration (config_get.logs).', toApi: () => ({ message: 'config_get' }), format: (r) => JSON.stringify(r.logs ?? {}, null, 2).replace(/\n/g, '\r\n') };
const cli = (value: string, label: string, why: string): MonitorCommandType => ({ value, label, description: why, cliOnly: why });

const ueIdArg = (args: string[], usage: string): number | string => {
  const id = toInt(args[0]);
  return id === undefined ? `usage: ${usage}` : id;
};

export const ENB_MONITOR_COMMANDS: MonitorCommandSection[] = [
  {
    category: 'Basic Commands',
    description: 'Essential monitoring commands',
    items: [helpCmd, licenseCmd, logCfgCmd, logsCmd],
  },
  {
    category: 'Trace Commands',
    description: 'Periodic traces (Enter stops)',
    items: [
      tStats('t', 'Global stats (t g)', 'Periodic stats; same as t g.'),
      tStats('t g', 'Global stats', 'Periodic eNB statistics per cell.'),
      tStats('t cpu', 'CPU / TRX latency', 'stats with rf: true.', { rf: true }),
      tStats('t spl', 'Sample stats', 'stats with samples: true (TX/RX RMS, saturation).', { samples: true }),
      { value: 't ue', label: 'UE trace', description: 'Periodic ue_get with stats.', example: 't ue [period]', periodic: true, toApi: () => ({ message: 'ue_get', stats: true }), format: fmtEnbUes },
    ],
  },
  {
    category: 'Cell Management',
    description: 'Cell configuration and control commands',
    items: [
      simple('cell', 'config_get', 'Cell info', 'Cells from config_get: PCI, ARFCN, gain, UL state.', fmtCells),
      { value: 'cell_gain', label: 'Cell gain', description: 'Set the DL gain of a cell, -200..0 dB.', example: 'cell_gain <cell_id> <gain>', toApi: (a) => (toInt(a[0]) === undefined || toNum(a[1]) === undefined ? 'usage: cell_gain <cell_id> <gain>' : { message: 'cell_gain', cell_id: toInt(a[0])!, gain: toNum(a[1])! }) },
      { value: 'cell_ul_disable', label: 'Disable UL', description: 'Disable (1) or enable (0) the uplink of a cell.', example: 'cell_ul_disable <cell_id> <0|1>', toApi: (a) => (toInt(a[0]) === undefined || !['0', '1'].includes(a[1] ?? '') ? 'usage: cell_ul_disable <cell_id> <0|1>' : { message: 'cell_ul_disable', cell_id: toInt(a[0])!, disabled: a[1] === '1' }) },
      { value: 'noise_level', label: 'Noise level', description: 'Channel simulator noise level.', example: 'noise_level <level> [channel]', toApi: (a) => (toNum(a[0]) === undefined ? 'usage: noise_level <level> [channel]' : { message: 'noise_level', noise_level: toNum(a[0])!, ...(toInt(a[1]) !== undefined ? { channel: toInt(a[1]) } : {}) }) },
    ],
  },
  {
    category: 'UE Management',
    description: 'UE related operations',
    items: [
      { value: 'ue', label: 'List UEs', description: 'Connected UEs (ue_get stats).', toApi: () => ({ message: 'ue_get', stats: true }), format: fmtEnbUes },
      {
        value: 'handover', label: 'Handover', description: 'Handover to PCI on EARFCN (LTE) or ssb=<SSB NR-ARFCN> (NR). Target must be in ncell_list.',
        example: 'handover <RAN_UE_ID> <pci> [earfcn] [ssb=<arfcn>] [type=auto|intra|s1|x2|xn|ng]',
        toApi: (args) => {
          const { pos, opts } = splitArgs(args);
          const id = toInt(pos[0]); const pci = toInt(pos[1]);
          if (id === undefined || pci === undefined) return 'usage: handover <RAN_UE_ID> <pci> [earfcn] [ssb=<arfcn>]';
          return { message: 'handover', ran_ue_id: id, pci, ...(toInt(pos[2]) !== undefined ? { dl_earfcn: toInt(pos[2]) } : {}), ...(toInt(opts.ssb) !== undefined ? { ssb_nr_arfcn: toInt(opts.ssb) } : {}), ...(opts.type ? { type: opts.type } : {}) };
        },
      },
      { value: 'rrc_ue_info_req', label: 'RRC UE info', description: 'Send RRC UE Information Request.', example: 'rrc_ue_info_req <UE_ID> <req_mask>', toApi: (a) => (toInt(a[0]) === undefined || toInt(a[1]) === undefined ? 'usage: rrc_ue_info_req <UE_ID> <req_mask>' : { message: 'rrc_ue_info_req', enb_ue_id: toInt(a[0])!, req_mask: toInt(a[1])! }) },
      { value: 'rrc_cnx_release', label: 'RRC release', description: 'Force RRC connection release.', example: 'rrc_cnx_release <UE_ID> [redirect]', toApi: (a) => { const id = ueIdArg(a, 'rrc_cnx_release <UE_ID> [redirect]'); return typeof id === 'string' ? id : { message: 'rrc_cnx_release', ran_ue_id: id, ...(toInt(a[1]) !== undefined ? { redirect: toInt(a[1]) } : {}) }; } },
      { value: 'pdcch_order_prach', label: 'PDCCH order', description: 'PDCCH order for PRACH.', example: 'pdcch_order_prach <UE_ID>', toApi: (a) => { const id = ueIdArg(a, 'pdcch_order_prach <UE_ID>'); return typeof id === 'string' ? id : { message: 'pdcch_order_prach', enb_ue_id: id }; } },
    ],
  },
  {
    category: 'Network Interfaces',
    description: 'S1, NG, X2, Xn, M2',
    items: [
      simple('s1', 's1', 'S1 status', 'MME links.', fmtLinks('s1_list')),
      { value: 's1connect', label: 'S1 connect', description: 'Force S1 connection.', example: 's1connect [mme_addr]', toApi: (a) => ({ message: 's1connect', ...(a[0] ? { address: a[0] } : {}) }) },
      { value: 's1disconnect', label: 'S1 disconnect', description: 'Force S1 disconnection.', example: 's1disconnect [mme_addr]', toApi: (a) => ({ message: 's1disconnect', ...(a[0] ? { address: a[0] } : {}) }) },
      simple('ng', 'ng', 'NG status', 'AMF links.', fmtLinks('ng_list')),
      { value: 'ngconnect', label: 'NG connect', description: 'Force NG connection.', example: 'ngconnect [amf_addr]', toApi: (a) => ({ message: 'ngconnect', ...(a[0] ? { address: a[0] } : {}) }) },
      { value: 'ngdisconnect', label: 'NG disconnect', description: 'Force NG disconnection.', example: 'ngdisconnect [amf_addr]', toApi: (a) => ({ message: 'ngdisconnect', ...(a[0] ? { address: a[0] } : {}) }) },
      simple('x2', 'x2', 'X2 status', 'X2 peers.', fmtLinks('peers')),
      { value: 'x2connect', label: 'X2 connect', description: 'Force X2 connection.', example: 'x2connect <peer_addr>', toApi: (a) => (a[0] ? { message: 'x2connect', addr: a[0] } : 'usage: x2connect <peer_addr>') },
      { value: 'x2disconnect', label: 'X2 disconnect', description: 'Force X2 disconnection.', example: 'x2disconnect <peer_addr>', toApi: (a) => (a[0] ? { message: 'x2disconnect', addr: a[0] } : 'usage: x2disconnect <peer_addr>') },
      simple('xn', 'xn', 'Xn status', 'Xn peers.', fmtLinks('peers')),
      simple('m2', 'm2', 'M2 status', 'MBMSGW link.'),
    ],
  },
  {
    category: 'Radio Configuration',
    description: 'RF gains',
    items: [
      simple('rf_info', 'rf', 'RF info', 'Current TX/RX gains and RF driver info.', fmtRf),
      { value: 'tx_gain', label: 'TX gain', description: 'Set TX gain (dB).', example: 'tx_gain <gain> [channel]', toApi: (a) => (toNum(a[0]) === undefined ? 'usage: tx_gain <gain> [channel]' : { message: 'rf', tx_gain: toNum(a[0])!, ...(toInt(a[1]) !== undefined ? { tx_channel_index: toInt(a[1]) } : {}) }), format: fmtRf },
      { value: 'rx_gain', label: 'RX gain', description: 'Set RX gain (dB).', example: 'rx_gain <gain> [channel]', toApi: (a) => (toNum(a[0]) === undefined ? 'usage: rx_gain <gain> [channel]' : { message: 'rf', rx_gain: toNum(a[0])!, ...(toInt(a[1]) !== undefined ? { rx_channel_index: toInt(a[1]) } : {}) }), format: fmtRf },
    ],
  },
  {
    category: 'Bearer Management',
    description: 'Radio bearers',
    items: [
      simple('erab', 'erab_get', 'List ERABs', 'EPS radio bearers (all; the console -a flag has no API equivalent).'),
      simple('qos_flow', 'qos_flow_get', 'QoS flows', '5GS QoS flows.'),
      { value: 'rlc_drop_rate', label: 'RLC drop rate', description: 'Drop a percentage of UL RLC PDUs.', example: 'rlc_drop_rate <UE_ID> <rb_id> <rate> [is_srb]', toApi: (a) => (toInt(a[0]) === undefined || toInt(a[1]) === undefined || toInt(a[2]) === undefined ? 'usage: rlc_drop_rate <UE_ID> <rb_id> <rate> [is_srb]' : { message: 'rlc_drop_rate', ran_ue_id: toInt(a[0])!, rb_id: toInt(a[1])!, percentage: toInt(a[2])!, srb: a[3] === '1' || a[3] === 'true' }) },
    ],
  },
  {
    category: 'CLI only',
    description: 'No remote API equivalent: use the lteenb screen session on the box',
    items: [
      cli('pcap', 'Start PCAP', 'pcap has no remote API message. On the box: screen -x lte, then pcap -w /tmp/enb.pcap.'),
      cli('pcap_stop', 'Stop PCAP', 'No remote API message; run pcap_stop in the lteenb screen.'),
      cli('hwcaps', 'CPU capabilities', 'No remote API message; run hwcaps in the lteenb screen.'),
      cli('mbms', 'MBMS status', 'No eNB remote API message; run mbms in the lteenb screen.'),
    ],
  },
];

export const MME_MONITOR_COMMANDS: MonitorCommandSection[] = [
  { category: 'Basic Commands', description: 'Essential MME monitoring commands', items: [helpCmd, licenseCmd, logCfgCmd, logsCmd, tStats('t', 'Stats', 'Periodic MME stats (resets the server counters each call).')] },
  {
    category: 'Subscribers', description: 'UE contexts and links',
    items: [
      { value: 'ue', label: 'UE list', description: 'ue_get, optionally for one IMSI.', example: 'ue [imsi]', toApi: (a) => ({ message: 'ue_get', ...(a[0] ? { imsi: a[0] } : {}) }), format: (r) => ((r.ue_list ?? []).map((u: any) => `${pad(u.imsi ?? u.nai, 16)} ${pad(u.rat_type, 5)} registered=${u.registered} tac=${u.tac ?? '-'} ${(u.bearers ?? u.pdu_sessions ?? []).map((b: any) => b.ip ?? '').join(' ')}`).join('\r\n') || '(no UE)') },
      simple('enb', 'enb', 'eNB links', 'Connected eNBs.', (r) => (r.enb_list ?? []).map((e: any) => `${pad(e.eNB_ID, 8)} ${pad(e.name, 16)} ${pad(e.address, 24)} ue_ctx=${e.ue_ctx ?? '-'}`).join('\r\n') || '(no eNB)'),
      simple('ng_ran', 'ng_ran', 'NG-RAN links', 'Connected gNBs / ng-eNBs.'),
      simple('s6', 's6', 'S6a', 'HSS link.'),
      simple('sgs', 'sgs', 'SGs', 'MSC/VLR link.'),
    ],
  },
];

export const UE_MONITOR_COMMANDS: MonitorCommandSection[] = [
  { category: 'Basic Commands', description: 'Essential UE monitoring commands', items: [helpCmd, licenseCmd, logCfgCmd, logsCmd, tStats('t', 'Stats', 'Periodic UE simulator stats.')] },
  {
    category: 'UEs', description: 'Simulated UEs',
    items: [
      { value: 'ue', label: 'UE list', description: 'ue_get (optionally one ue_id).', example: 'ue [ue_id]', toApi: (a) => ({ message: 'ue_get', ...(toInt(a[0]) !== undefined ? { ue_id: toInt(a[0]) } : {}) }), format: (r) => ((r.ue_list ?? []).map((u: any) => `${pad(u.ue_id, 5)} ${pad(u.imsi, 16)} rrc=${pad(u.rrc_state, 10)} emm=${pad(u.emm_state, 16)} dl ${rate(u.dl_bitrate)} ul ${rate(u.ul_bitrate)}`).join('\r\n') || '(no UE)') },
      { value: 'power_on', label: 'Power on', description: 'Switch a UE on.', example: 'power_on <ue_id>', toApi: (a) => { const id = ueIdArg(a, 'power_on <ue_id>'); return typeof id === 'string' ? id : { message: 'power_on', ue_id: id }; } },
      { value: 'power_off', label: 'Power off', description: 'Switch a UE off.', example: 'power_off <ue_id>', toApi: (a) => { const id = ueIdArg(a, 'power_off <ue_id>'); return typeof id === 'string' ? id : { message: 'power_off', ue_id: id }; } },
      simple('rf_info', 'rf', 'RF info', 'Current gains and RF driver info.', fmtRf),
    ],
  },
];

export const IMS_MONITOR_COMMANDS: MonitorCommandSection[] = [
  { category: 'Basic Commands', description: 'Essential IMS commands', items: [helpCmd, licenseCmd, logCfgCmd, logsCmd, tStats('t', 'Stats', 'IMS stats (resets counters).')] },
  { category: 'Users', description: 'IMS users and dialogs', items: [simple('users', 'users_get', 'Users', 'IMS users and bindings.'), simple('dialogs', 'dialog_get', 'Dialogs', 'Current dialogs.')] },
];

export const MBMS_MONITOR_COMMANDS: MonitorCommandSection[] = [
  { category: 'Basic Commands', description: 'MBMSGW commands', items: [helpCmd, licenseCmd, logCfgCmd, logsCmd, tStats('t', 'Stats', 'MBMSGW stats.')] },
];

export const LICENSE_MONITOR_COMMANDS: MonitorCommandSection[] = [
  { category: 'Basic Commands', description: 'License server commands', items: [helpCmd, licenseCmd, logsCmd, simple('list', 'list', 'License list', 'Licenses and their connections.', (r) => (r.licenses ?? []).map((l: any) => `${pad(l.uid, 20)} ${pad(l.products, 24)} ${(l.connections ?? []).length}/${l.max ?? '-'} conn`).join('\r\n') || '(no license)')] },
];

export const getMonitorCommands = (componentType: ComponentType | string): MonitorCommandSection[] => {
  switch (componentType) {
    case 'ENB': return ENB_MONITOR_COMMANDS;
    case 'MME': return MME_MONITOR_COMMANDS;
    case 'UE': return UE_MONITOR_COMMANDS;
    case 'IMS': return IMS_MONITOR_COMMANDS;
    case 'MBMS': return MBMS_MONITOR_COMMANDS;
    case 'LICENSE': return LICENSE_MONITOR_COMMANDS;
    default: return [];
  }
};

/** Find the command for a typed line: longest matching word prefix wins ("t g" over "t"). */
export function resolveMonitorLine(componentType: ComponentType | string, line: string): { cmd: MonitorCommandType; args: string[] } | null {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  let best: { cmd: MonitorCommandType; args: string[]; n: number } | null = null;
  for (const section of getMonitorCommands(componentType)) {
    for (const cmd of section.items) {
      const cw = cmd.value.split(' ');
      if (cw.length > words.length) continue;
      if (cw.every((w, i) => w === words[i]) && (!best || cw.length > best.n)) {
        best = { cmd, args: words.slice(cw.length), n: cw.length };
      }
    }
  }
  return best ? { cmd: best.cmd, args: best.args } : null;
}

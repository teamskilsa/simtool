// eNB / gNB (lteenb) remote API catalogue.
// Source: lteenb.html 2026-09-11, chapter 10 "Remote API", sections 10.5-10.10.
import type { ApiCommand, ValidationIssue } from '../common/types';
import { any, arr, bool, int, num, obj, req, str, union, IMSI_PATTERN } from '../common/helpers';

const LTE = 'lteenb 10.6 LTE messages';
const doc = (m: string) => `${LTE} / ${m}`;

const isCellKey = (k: string) => /^\d+$/.test(k);

/** Shared check for `cells: { "<cell_id>": {...} }` bodies. */
function checkCellsObject(m: Record<string, any>, required: boolean): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (m.cells === undefined) {
    if (required) issues.push({ level: 'error', path: 'cells', text: 'cells object is required' });
    return issues;
  }
  if (!m.cells || typeof m.cells !== 'object' || Array.isArray(m.cells)) {
    issues.push({ level: 'error', path: 'cells', text: 'cells must be an object keyed by cell_id ("1": {...})' });
    return issues;
  }
  for (const [k, v] of Object.entries(m.cells)) {
    if (!isCellKey(k)) issues.push({ level: 'error', path: `cells.${k}`, text: 'cell key must be the numeric cell_id as a string' });
    if (!v || typeof v !== 'object' || Array.isArray(v)) issues.push({ level: 'error', path: `cells.${k}`, text: 'each cell entry must be an object' });
  }
  return issues;
}

// Numeric ranges for the config_set.cells fields SimTool presets use.
const CELL_RANGES: Record<string, { min: number; max: number; arrayOk?: boolean; int?: boolean }> = {
  pdsch_mcs: { min: -1, max: 28, arrayOk: true, int: true },
  pusch_mcs: { min: -1, max: 28, arrayOk: true, int: true },
  pusch_max_mcs: { min: 0, max: 28, int: true },
  pusch_max_its: { min: 1, max: 20, int: true },
  forced_ri: { min: 0, max: 8, int: true },
  forced_cqi: { min: -1, max: 15, int: true },
  forced_pmi: { min: -1, max: 15, int: true },
  pusch_fer: { min: 0, max: 1 },
  pdsch_fer: { min: 0, max: 1 },
  npusch_fer: { min: 0, max: 1 },
  npdsch_fer: { min: 0, max: 1 },
  rrc_cnx_reject_waitTime: { min: 1, max: 16, int: true },
  rrc_cnx_reject_extWaitTime: { min: 0, max: 1800, int: true },
  rrc_cnx_release_extWaitTime: { min: 0, max: 1800, int: true },
  rrc_reject_waitTime: { min: 1, max: 16, int: true },
  rrc_release_waitTime: { min: 1, max: 16, int: true },
  inactivity_timer: { min: 0, max: Number.MAX_SAFE_INTEGER, int: true },
};

function checkCellRanges(m: Record<string, any>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!m.cells || typeof m.cells !== 'object') return issues;
  for (const [cid, cell] of Object.entries<any>(m.cells)) {
    if (!cell || typeof cell !== 'object') continue;
    for (const [key, r] of Object.entries(CELL_RANGES)) {
      if (!(key in cell)) continue;
      const vals = Array.isArray(cell[key]) && r.arrayOk ? cell[key] : [cell[key]];
      for (const v of vals) {
        if (typeof v !== 'number' || !Number.isFinite(v) || (r.int && !Number.isInteger(v)) || v < r.min || v > r.max) {
          issues.push({ level: 'error', path: `cells.${cid}.${key}`, text: `${key} must be ${r.int ? 'an integer' : 'a number'} in [${r.min}:${r.max}]${r.arrayOk ? ' (or an array of them)' : ''}` });
          break;
        }
      }
    }
    const filt = cell.rrc_procedure_filter;
    if (filt && typeof filt === 'object') {
      for (const [proc, f] of Object.entries<any>(filt)) {
        if (!f || !['treat', 'ignore', 'reject'].includes(f.action)) {
          issues.push({ level: 'error', path: `cells.${cid}.rrc_procedure_filter.${proc}.action`, text: 'action must be treat, ignore or reject' });
        }
      }
    }
  }
  return issues;
}

export const enbCommands: ApiCommand[] = [
  // ── Monitoring ────────────────────────────────────────────────────────────
  {
    message: 'ue_get',
    components: ['ENB'],
    category: 'Monitoring',
    label: 'Connected UEs',
    description: 'UE contexts: enb_ue_id/ran_ue_id, rnti, cells. With stats: per-cell CQI, MCS, bitrates, SNR, retx.',
    params: {
      ue_id: int('Filter on UE_ID.'),
      stats: bool('Include per-cell radio statistics.', { default: false }),
    },
    example: { message: 'ue_get', stats: true },
    danger: 'safe',
    readOnly: true,
    docRef: doc('ue_get'),
    notes: 'Live-tested 2026-06-12: dl_bitrate/ul_bitrate in ue_get are computed from a window SHARED by all connections, unlike `stats` which is per connection. Two pollers halve each other\'s window.',
  },
  { message: 'erab_get', components: ['ENB'], category: 'Monitoring', label: 'E-RAB list', description: 'EPS radio bearers (LTE): enb_ue_id, erab_id, qci, GBR/MBR, byte counters.', example: { message: 'erab_get' }, danger: 'safe', readOnly: true, docRef: doc('erab_get') },
  { message: 'qos_flow_get', components: ['ENB'], category: 'Monitoring', label: 'QoS flow list', description: '5GS bearers (NR): ran_ue_id, pdu_session_id, sst/sd, qfi_list, byte counters.', example: { message: 'qos_flow_get' }, danger: 'safe', readOnly: true, docRef: doc('qos_flow_get') },
  { message: 's1', components: ['ENB'], category: 'Monitoring', label: 'S1 (MME) links', description: 's1_list: state (disconnected/connecting/connected/inactive/setup_done), address, name, PLMN.', example: { message: 's1' }, danger: 'safe', readOnly: true, docRef: doc('s1') },
  { message: 'ng', components: ['ENB'], category: 'Monitoring', label: 'NG (AMF) links', description: 'ng_list: state, address, name, PLMN.', example: { message: 'ng' }, danger: 'safe', readOnly: true, docRef: doc('ng') },
  { message: 'x2', components: ['ENB'], category: 'Monitoring', label: 'X2 peers', description: 'peers: state, addr, cells (cell_id, tac, dl_earfcn, pci).', example: { message: 'x2' }, danger: 'safe', readOnly: true, docRef: doc('x2') },
  { message: 'xn', components: ['ENB'], category: 'Monitoring', label: 'Xn peers', description: 'peers: ng_enb, state, addr, cells (cell_id, tac, ssb_nr_arfcn, pci).', example: { message: 'xn' }, danger: 'safe', readOnly: true, docRef: doc('xn') },
  { message: 'm2', components: ['ENB'], category: 'Monitoring', label: 'M2 (MBMSGW) link', description: 'state (disconnected/waiting/connecting/connected) and address.', example: { message: 'm2' }, danger: 'safe', readOnly: true, docRef: doc('m2') },
  { message: 'mbs_session_info', components: ['ENB'], category: 'Monitoring', label: 'MBS sessions', description: 'Per-cell MBS broadcast sessions. g_rnti, mcs, dl_tx, dl_rbs, dl_bytes added in 2026-06-12.', example: { message: 'mbs_session_info' }, danger: 'safe', readOnly: true, docRef: doc('mbs_session_info') },

  // ── Radio ─────────────────────────────────────────────────────────────────
  {
    message: 'cell_gain',
    components: ['ENB'],
    category: 'Radio',
    label: 'Cell DL gain',
    description: 'Set the downlink gain of ONE cell (dB, relative). Other cells are not changed.',
    params: {
      cell_id: req(int('Cell ID (the cell_id from config_get.cells).', { min: 0 })),
      gain: req(num('Gain in dB. Must be between -200 and 0 (included).', { min: -200, max: 0 })),
    },
    example: { message: 'cell_gain', cell_id: 1, gain: -20 },
    presets: [{ label: 'Restore 0 dB', body: { message: 'cell_gain', cell_id: 1, gain: 0 } }],
    danger: 'caution',
    dangerNote: 'Changes cell coverage for every UE on the cell. Restore with gain 0 (or the previous config_get.cells.<id>.gain).',
    readOnly: false,
    docRef: doc('cell_gain'),
    notes: 'Range [-200:0] confirmed on the live 2026-06-12 callbox.',
    assess: (m) => (typeof m.gain === 'number' && m.gain <= -100
      ? { level: 'destructive', reasons: [`gain ${m.gain} dB effectively switches cell ${m.cell_id} off; attached UEs will drop.`] }
      : null),
  },
  {
    message: 'cell_ul_disable',
    components: ['ENB'],
    category: 'Radio',
    label: 'Disable cell uplink',
    description: 'Enable/disable UL reception on a cell.',
    params: {
      cell_id: req(int('Cell ID.', { min: 0 })),
      disabled: req(bool('true disables UL, false re-enables it.')),
    },
    example: { message: 'cell_ul_disable', cell_id: 1, disabled: false },
    danger: 'caution',
    dangerNote: 'With UL disabled UEs will hit RLF. Restore with disabled: false.',
    readOnly: false,
    docRef: doc('cell_ul_disable'),
    assess: (m) => (m.disabled === true ? { level: 'destructive', reasons: [`UL of cell ${m.cell_id} is disabled; UEs on it will fail.`] } : null),
  },
  {
    message: 'rf',
    components: ['ENB'],
    category: 'Radio',
    label: 'RF gains (get/set)',
    description: 'Without gains: returns tx_gain/rx_gain per channel and rf_info. With tx_gain/rx_gain: sets the radio front-end gain (dB, device dependent).',
    params: {
      tx_gain: union(['number', 'array'], 'TX gain in dB, or one per channel.', { items: 'number' }),
      tx_channel_index: int('Apply tx_gain to this channel only.', { min: 0 }),
      rx_gain: union(['number', 'array'], 'RX gain in dB, or one per channel.', { items: 'number' }),
      rx_channel_index: int('Apply rx_gain to this channel only.', { min: 0 }),
    },
    example: { message: 'rf' },
    presets: [{ label: 'Set TX gain on channel 0', body: { message: 'rf', tx_gain: 70, tx_channel_index: 0 } }],
    danger: 'safe',
    readOnly: true,
    docRef: doc('rf'),
    notes: 'Read the current gains first (plain {"message":"rf"}) so you can restore them.',
    check: (m) => {
      const out: ValidationIssue[] = [];
      if (m.tx_channel_index !== undefined && m.tx_gain === undefined) out.push({ level: 'warning', path: 'tx_channel_index', text: 'tx_channel_index has no effect without tx_gain' });
      if (m.rx_channel_index !== undefined && m.rx_gain === undefined) out.push({ level: 'warning', path: 'rx_channel_index', text: 'rx_channel_index has no effect without rx_gain' });
      return out;
    },
    assess: (m) => (m.tx_gain !== undefined || m.rx_gain !== undefined
      ? { level: 'caution', reasons: ['Changes the RF front-end gain for live cells. Note the current gains (rf with no params) to restore.'] }
      : null),
  },
  {
    message: 'noise_level',
    components: ['ENB'],
    category: 'Radio',
    label: 'Channel simulator noise',
    description: 'Noise level relative to the CRS level. Only when the channel simulator is enabled.',
    params: {
      noise_level: req(num('Noise level in dB.')),
      channel: int('TX channel; all channels when absent.', { min: 0 }),
    },
    example: { message: 'noise_level', noise_level: -30 },
    danger: 'caution',
    readOnly: false,
    docRef: doc('noise_level'),
  },
  {
    message: 'trx_iq_dump',
    components: ['ENB'],
    category: 'Radio',
    label: 'IQ dump',
    description: 'Dump baseband IQ samples (float32 LE, interleaved I/Q) to files ON THE BOX. A notification arrives when the dump actually starts, then the response with dump_utc and rf_ports.',
    params: {
      duration: num('Dump duration in ms (default 1000, max 30000).', { min: 1, max: 30000, default: 1000 }),
      rf_port: union(['integer', 'array'], 'Only these RF ports.', { items: 'integer' }),
      rx_filename: str('RX output file on the box; may contain %d for the antenna stream. No RX dump when absent.'),
      tx_filename: str('TX output file on the box; may contain %d. No TX dump when absent.'),
      rx_channels: arr('Global RX channel indexes to dump.', 'integer'),
      tx_channels: arr('Global TX channel indexes to dump.', 'integer'),
      rx_header: bool('Write a timestamp/count header before each TRX read.', { default: false }),
      tx_header: bool('Same as rx_header for TX.', { default: false }),
    },
    oneOf: [['rx_filename', 'tx_filename']],
    example: { message: 'trx_iq_dump', duration: 100, rx_filename: '/tmp/rx%d.bin' },
    danger: 'caution',
    dangerNote: 'Writes ~(sample_rate x 8 bytes x channels) per second to the box disk and adds CPU load.',
    readOnly: false,
    docRef: doc('trx_iq_dump'),
    notes: 'The docs say "default = 1s, max = 30s" but the unit is milliseconds. Response arrives after the dump completes.',
    check: (m) => (typeof m.duration === 'number' && m.duration > 0 && m.duration < 1
      ? [{ level: 'warning', path: 'duration', text: 'duration is in milliseconds; a value below 1 looks like seconds' }]
      : []),
  },

  // ── Mobility ──────────────────────────────────────────────────────────────
  {
    message: 'handover',
    components: ['ENB'],
    category: 'Mobility',
    label: 'Handover',
    description: 'Trigger a handover of a connected UE to the cell with this PCI (and EARFCN / SSB NR-ARFCN). The target must be resolvable through the serving cell ncell_list (add it with ncell_list_add).',
    params: {
      ran_ue_id: int('eNB UE id (LTE) or RAN UE id (NR), from ue_get.', { min: 0, aliases: ['enb_ue_id'] }),
      pci: req(int('Target physical cell ID.', { min: 0, max: 1007 })),
      dl_earfcn: int('Target DL EARFCN. When absent the UE\'s current EARFCN is used.', { min: 0, max: 262143 }),
      ssb_nr_arfcn: int('Target SSB NR-ARFCN (NR). When absent the current SSB ARFCN is used.', { min: 0, max: 3279165 }),
      type: str('Handover type. EPS->5GS needs s1, 5GS->EPS needs ng.', { enum: ['auto', 'intra', 's1', 'x2', 'xn', 'ng'], default: 'auto' }),
    },
    oneOf: [['ran_ue_id', 'enb_ue_id']],
    example: { message: 'handover', ran_ue_id: 1, pci: 2, dl_earfcn: 3350 },
    danger: 'caution',
    dangerNote: 'Moves a live UE. If the target is not in ncell_list the eNB rejects or the UE drops.',
    readOnly: false,
    docRef: doc('handover'),
    notes: 'Live-tested 2026-06-12: works with ran_ue_id or enb_ue_id, pci and dl_earfcn, and only after the target was added with ncell_list_add.',
    check: (m) => (m.dl_earfcn === undefined && m.ssb_nr_arfcn === undefined
      ? [{ level: 'warning', path: 'dl_earfcn', text: 'No dl_earfcn/ssb_nr_arfcn: the eNB looks for the PCI on the UE\'s current frequency only. Live tests needed dl_earfcn.' }]
      : []),
  },
  {
    message: 'ncell_list_add',
    components: ['ENB'],
    category: 'Mobility',
    label: 'Add neighbour cell',
    description: 'Add a neighbour to a cell\'s ncell_list at runtime (needed before handover). `ncell` uses the same fields as ncell_list in the cell config.',
    params: {
      cell_id: req(int('Serving cell ID whose ncell_list is extended.', { min: 0 })),
      ncell: req(obj('Neighbour: rat (eutra/nr), n_id_cell, dl_earfcn (LTE) or ssb_nr_arfcn (NR), cell_id (28-bit ECI or 36-bit NCI), plmn, tac ...')),
    },
    example: { message: 'ncell_list_add', cell_id: 1, ncell: { rat: 'eutra', n_id_cell: 2, dl_earfcn: 3350, cell_id: 0x1a2d002, tac: 1 } },
    danger: 'caution',
    readOnly: false,
    docRef: doc('ncell_list_add'),
    notes: 'Restore: ncell_list_del with the same cell_id, n_id_cell and dl_arfcn.',
    check: (m) => {
      const n = m.ncell;
      const out: ValidationIssue[] = [];
      if (!n || typeof n !== 'object') return out;
      const rat = n.rat ?? 'eutra';
      if (!['eutra', 'nr'].includes(rat)) out.push({ level: 'error', path: 'ncell.rat', text: 'rat must be eutra or nr' });
      if (typeof n.n_id_cell !== 'number') out.push({ level: 'error', path: 'ncell.n_id_cell', text: 'n_id_cell (PCI) is required' });
      else if (n.n_id_cell < 0 || n.n_id_cell > (rat === 'nr' ? 1007 : 503)) out.push({ level: 'error', path: 'ncell.n_id_cell', text: `n_id_cell must be in [0:${rat === 'nr' ? 1007 : 503}]` });
      if (rat === 'eutra' && n.cell_id === undefined) out.push({ level: 'error', path: 'ncell.cell_id', text: 'cell_id (28-bit ECI) is required for an EUTRA neighbour' });
      if (rat === 'eutra' && n.dl_earfcn === undefined) out.push({ level: 'warning', path: 'ncell.dl_earfcn', text: 'dl_earfcn absent: assumed same as the serving cell' });
      if (rat === 'nr' && n.cell_id === undefined && n.ssb_nr_arfcn === undefined) out.push({ level: 'error', path: 'ncell.ssb_nr_arfcn', text: 'NR neighbour needs cell_id (internal) or ssb_nr_arfcn' });
      return out;
    },
  },
  {
    message: 'ncell_list_del',
    components: ['ENB'],
    category: 'Mobility',
    label: 'Remove neighbour cell',
    description: 'Remove a neighbour from a cell\'s ncell_list.',
    params: {
      cell_id: req(int('Serving cell ID.', { min: 0 })),
      n_id_cell: req(int('Neighbour PCI (0-503 LTE, 0-1007 NR).', { min: 0, max: 1007 })),
      dl_arfcn: int('Neighbour DL EARFCN or SSB NR-ARFCN; same as serving cell when absent.', { min: 0, max: 3279165 }),
    },
    example: { message: 'ncell_list_del', cell_id: 1, n_id_cell: 2, dl_arfcn: 3350 },
    danger: 'caution',
    readOnly: false,
    docRef: doc('ncell_list_del'),
  },
  {
    message: 'rrc_cnx_release',
    components: ['ENB'],
    category: 'Mobility',
    label: 'RRC connection release',
    description: 'Force an RRC release (optionally with redirection or suspend to RRC inactive).',
    params: {
      ran_ue_id: int('eNB or RAN UE id.', { min: 0, aliases: ['enb_ue_id'] }),
      redirect: int('Index into the cell rrc_redirect list.', { min: 0 }),
      redirected_carrier_info: any('ASN.1 RedirectedCarrierInfo (JER object or GSER).'),
      idle_mode_mobility_control: any('IdleModeMobilityControlInfo.'),
      cell_reselection_priorities: any('ASN.1 CellReselectionPriorities.'),
      suspend: bool('Suspend to RRC inactive instead of releasing, when the UE supports it.', { default: false }),
      mps_priority_indication: bool('Send mpsPriorityIndication-r16 with redirection.', { default: false }),
    },
    oneOf: [['ran_ue_id', 'enb_ue_id']],
    example: { message: 'rrc_cnx_release', ran_ue_id: 1 },
    danger: 'caution',
    dangerNote: 'The UE goes idle; data sessions pause until it reconnects.',
    readOnly: false,
    docRef: doc('rrc_cnx_release'),
    notes: 'Live-tested 2026-06-12 with {ran_ue_id}.',
  },
  {
    message: 'rrc_cnx_reconf',
    components: ['ENB'],
    category: 'Mobility',
    label: 'RRC reconfiguration (SCells/BWP)',
    description: 'Send an RRC reconfiguration: add/remove SCells (subset of the PCell scell_list), reconfigure PUCCH/SRS, or switch BWP (NR).',
    params: {
      enb_ue_id: int('eNB or RAN UE id.', { min: 0, aliases: ['ran_ue_id'] }),
      eutra_secondary_cell_list: arr('LTE SCells: objects like scell_list entries ({cell_id, cross_carrier_scheduling ...}). [] removes all.', 'object'),
      nr_secondary_cell_list: arr('NR SCells, subset of the PCell/PSCell scell_list.', 'object'),
      reconf_pucch_srs: bool('LTE: reconfigure PUCCH (CSI, SR) and SRS for all serving cells. Not with eutra_secondary_cell_list.'),
      dl_bwp_id: int('NR: switch DL BWP (-1 keeps current).', { min: -1, max: 4 }),
      ul_bwp_id: int('NR: switch UL BWP (-1 keeps current).', { min: -1, max: 4 }),
      bwp_scell_id: int('NR: SCell cell_id for the BWP switch (-1 = PCell).', { min: -1 }),
      cell_group: str('Cell group the reconfiguration is for.', { enum: ['master', 'secondary'] }),
    },
    oneOf: [['enb_ue_id', 'ran_ue_id']],
    example: { message: 'rrc_cnx_reconf', enb_ue_id: 1, eutra_secondary_cell_list: [{ cell_id: 2 }] },
    danger: 'caution',
    readOnly: false,
    docRef: doc('rrc_cnx_reconf'),
    notes: 'Live-tested 2026-06-12 with eutra_secondary_cell_list. Restore by sending the original SCell list from ue_get.',
    check: (m) => {
      const out: ValidationIssue[] = [];
      if (m.reconf_pucch_srs && m.eutra_secondary_cell_list) out.push({ level: 'error', path: 'reconf_pucch_srs', text: 'reconf_pucch_srs cannot be combined with eutra_secondary_cell_list' });
      const bwp = m.dl_bwp_id !== undefined || m.ul_bwp_id !== undefined;
      if (bwp && (m.eutra_secondary_cell_list || m.nr_secondary_cell_list)) out.push({ level: 'error', path: 'dl_bwp_id', text: 'BWP switch cannot be combined with secondary cell lists' });
      if (!bwp && !m.reconf_pucch_srs && !m.eutra_secondary_cell_list && !m.nr_secondary_cell_list) out.push({ level: 'warning', path: '', text: 'Nothing to reconfigure: set a secondary cell list, reconf_pucch_srs or a BWP id' });
      return out;
    },
  },
  {
    message: 'scells_act_deact',
    components: ['ENB'],
    category: 'Mobility',
    label: 'Activate / deactivate SCells',
    description: 'Activate or deactivate configured SCells through a MAC CE. Response: scells (configured) and activated.',
    params: {
      enb_ue_id: int('eNB or RAN UE id.', { min: 0, aliases: ['ran_ue_id'] }),
      activate: arr('SCell cell_ids to activate.', 'integer'),
      deactivate: arr('SCell cell_ids to deactivate.', 'integer'),
    },
    oneOf: [['enb_ue_id', 'ran_ue_id']],
    example: { message: 'scells_act_deact', enb_ue_id: 1, activate: [2] },
    danger: 'caution',
    readOnly: false,
    docRef: doc('scells_act_deact'),
    notes: 'Live-tested 2026-06-12. Sending neither list just returns the SCell status.',
  },
  {
    message: 'page_ue',
    components: ['ENB'],
    category: 'Mobility',
    label: 'Page an idle UE',
    description: 'Send a paging message on a list of cells for a UE in RRC idle.',
    params: {
      type: req(str('UE type to page.', { enum: ['normal', 'cat0', 'ce', 'nb-iot', 'nr'] })),
      cn_domain: str('Core network domain (not for NB-IoT/NR).', { enum: ['cs', 'ps'] }),
      imsi: str('IMSI of the UE to page. Required except for NR UEs.', { pattern: IMSI_PATTERN }),
      's-tmsi': obj('{mmec, m-tmsi}: page by S-TMSI instead of IMSI (EPC).'),
      '5g-s-tmsi': obj('{amf_set_id, amf_pointer, 5g-tmsi}: page a 5GC UE.'),
      edrx: obj('{edrx_cycle, paging_time_window}.'),
      cell_id: req(arr('cell_ids to page on.', 'integer')),
    },
    example: { message: 'page_ue', type: 'normal', cn_domain: 'ps', imsi: '001010123456789', cell_id: [1] },
    danger: 'safe',
    readOnly: false,
    docRef: doc('page_ue'),
    notes: 'Live-tested 2026-06-12: rejected without imsi for LTE UEs.',
    check: (m) => {
      const out: ValidationIssue[] = [];
      if (m.type !== 'nr' && m.imsi === undefined) out.push({ level: 'error', path: 'imsi', text: 'imsi is required unless type is nr' });
      if (m.type === 'nr' && m['5g-s-tmsi'] === undefined) out.push({ level: 'warning', path: '5g-s-tmsi', text: 'NR paging normally needs 5g-s-tmsi' });
      if (Array.isArray(m.cell_id) && m.cell_id.length === 0) out.push({ level: 'error', path: 'cell_id', text: 'cell_id must list at least one cell' });
      return out;
    },
  },
  {
    message: 'rrc_ue_info_req',
    components: ['ENB'],
    category: 'Mobility',
    label: 'UE information request',
    description: 'Send RRC UE Information Request. req_mask bits: 0 RACH, 1 RLF, 2 LogMeas, 3 ConnEst, 4 MobHist, 5 IdleModeMeas, 6 ANR, 7 CoarseLocation, 8 SuccessHO-Report.',
    params: {
      enb_ue_id: int('eNB or RAN UE id.', { min: 0, aliases: ['ran_ue_id'] }),
      req_mask: req(int('Bitmap of requested information (0-511).', { min: 0, max: 511 })),
    },
    oneOf: [['enb_ue_id', 'ran_ue_id']],
    example: { message: 'rrc_ue_info_req', enb_ue_id: 1, req_mask: 3 },
    danger: 'safe',
    readOnly: false,
    docRef: doc('rrc_ue_info_req'),
  },
  {
    message: 'rrc_ue_cap_enquiry',
    components: ['ENB'],
    category: 'Mobility',
    label: 'UE capability enquiry',
    description: 'Send UE Capability Enquiry; the response can include the UL DCCH payload in hex and decoded text.',
    params: {
      ran_ue_id: int('eNB or RAN UE id.', { min: 0, aliases: ['enb_ue_id'] }),
      payload: bool('Add the UL DCCH payload hex dump to the response.'),
      text: bool('Add the decoded UL DCCH message to the response.'),
    },
    oneOf: [['ran_ue_id', 'enb_ue_id']],
    example: { message: 'rrc_ue_cap_enquiry', ran_ue_id: 1, text: true },
    danger: 'safe',
    readOnly: false,
    docRef: doc('rrc_ue_cap_enquiry'),
  },
  {
    message: 'rlc_drop_rate',
    components: ['ENB'],
    category: 'Mobility',
    label: 'Drop UL RLC PDUs',
    description: 'Drop a percentage of uplink RLC PDUs on a bearer (reset to 0 on handover/reestablishment).',
    params: {
      ran_ue_id: int('eNB or RAN UE id.', { min: 0, aliases: ['enb_ue_id'] }),
      rb_id: req(int('Bearer identity.', { min: 0 })),
      srb: req(bool('true for a signalling bearer.')),
      percentage: req(int('Drop percentage.', { min: 0, max: 100 })),
    },
    oneOf: [['ran_ue_id', 'enb_ue_id']],
    example: { message: 'rlc_drop_rate', ran_ue_id: 1, rb_id: 3, srb: false, percentage: 10 },
    presets: [{ label: 'Restore 0 %', body: { message: 'rlc_drop_rate', ran_ue_id: 1, rb_id: 3, srb: false, percentage: 0 } }],
    danger: 'caution',
    readOnly: false,
    docRef: doc('rlc_drop_rate'),
  },
  { message: 'pdcch_order_prach', components: ['ENB'], category: 'Mobility', label: 'PDCCH order PRACH', description: 'Send a PDCCH order for PRACH (not for BR UEs).', params: { enb_ue_id: req(int('S1AP eNB UE id or NGAP RAN UE id.', { min: 0 })) }, example: { message: 'pdcch_order_prach', enb_ue_id: 1 }, danger: 'caution', readOnly: false, docRef: doc('pdcch_order_prach') },
  {
    message: 'dci_bwp_switch', components: ['ENB'], category: 'Mobility', label: 'BWP switch via DCI', description: 'Initiate a BWP switch through DCI 0_1 (UL) or 1_1 (DL, experimental).',
    params: { enb_ue_id: req(int('eNB (NSA) or RAN (SA) UE id.', { min: 0 })), dl_bwp_id: int('Target DL BWP.', { min: 0, max: 4 }), ul_bwp_id: int('Target UL BWP.', { min: 0, max: 4 }), scell_id: int('SCell cell_id (-1 = PCell).', { min: -1 }) },
    oneOf: [['dl_bwp_id', 'ul_bwp_id']],
    example: { message: 'dci_bwp_switch', enb_ue_id: 1, ul_bwp_id: 1 }, danger: 'caution', readOnly: false, docRef: doc('dci_bwp_switch'),
  },
  { message: 'mr_dc_scg_release', components: ['ENB'], category: 'Mobility', label: 'Release SCG (EN-DC/NR-DC)', description: 'Release the SCG. Requires a meas_config_desc SCG-addition trigger on the PCell.', params: { ran_ue_id: req(int('eNB or RAN UE id.', { min: 0 })) }, example: { message: 'mr_dc_scg_release', ran_ue_id: 1 }, danger: 'caution', readOnly: false, docRef: doc('mr_dc_scg_release') },
  { message: 'nr_pscell_change', components: ['ENB'], category: 'Mobility', label: 'NR PSCell change', description: 'Trigger a PSCell change for an EN-DC/NR-DC UE.', params: { ran_ue_id: req(int('MCG eNB UE id.', { min: 0 })), cell_id: req(int('NR target cell id.', { min: 0 })) }, example: { message: 'nr_pscell_change', ran_ue_id: 1, cell_id: 2 }, danger: 'caution', readOnly: false, docRef: doc('nr_pscell_change') },
  { message: 'mr_dc_split_dl_ratio_change', components: ['ENB'], category: 'Mobility', label: 'Split bearer DL ratio', description: 'Force the MR-DC split bearer DL ratio (0..1, -1 disables).', params: { ran_ue_id: req(int('MCG RAN UE id.', { min: 0 })), drb_id: req(int('DRB id.', { min: 1 })), secondary_path_dl_ratio: req(num('0..1, or -1 to disable.', { min: -1, max: 1 })) }, example: { message: 'mr_dc_split_dl_ratio_change', ran_ue_id: 1, drb_id: 1, secondary_path_dl_ratio: 0.5 }, danger: 'caution', readOnly: false, docRef: doc('mr_dc_split_dl_ratio_change') },

  // ── Cell configuration ────────────────────────────────────────────────────
  {
    message: 'sib_set',
    components: ['ENB'],
    category: 'Cell config',
    label: 'Modify SIBs',
    description: 'Change SIB content and announce a system information modification in paging. cells.<id>.sib1 (cell_barred, p_max, reserved ...), sib2 (barring_info, reference_signal_power ...), sib3..sib7/sib24/sib27 (type gser|hex|jer + payload), sib14, sib25.',
    params: { cells: req(obj('Keyed by cell_id: { "1": { "sib1": {...} } }.')) },
    example: { message: 'sib_set', cells: { '1': { sib1: { p_max: 20 } } } },
    presets: [
      { label: 'Bar cell 1', body: { message: 'sib_set', cells: { '1': { sib1: { cell_barred: true } } } } },
      { label: 'Unbar cell 1', body: { message: 'sib_set', cells: { '1': { sib1: { cell_barred: false } } } } },
      { label: 'SIB3 from hex', body: { message: 'sib_set', cells: { '1': { sib3: { type: 'hex', payload: '000c16043f95aa0007ae' } } } } },
    ],
    danger: 'caution',
    dangerNote: 'Every UE in the cell re-reads system information. Note the original SIB values (config_get / log) to restore.',
    readOnly: false,
    openParams: false,
    docRef: doc('sib_set'),
    notes: 'Live-tested 2026-06-12. For NR cells cell_barred is set with config_set, not sib_set.',
    check: (m) => {
      const out = checkCellsObject(m, true);
      if (m.cells && typeof m.cells === 'object') {
        for (const [cid, c] of Object.entries<any>(m.cells)) {
          if (!c || typeof c !== 'object') continue;
          for (const [sib, body] of Object.entries<any>(c)) {
            if (!/^sib(1|2|3|4|5|6|7|14|24|25|27)$/.test(sib)) out.push({ level: 'warning', path: `cells.${cid}.${sib}`, text: `${sib} is not a documented sib_set block` });
            if (body && typeof body === 'object' && 'type' in body && !['gser', 'hex', 'jer'].includes(body.type)) {
              out.push({ level: 'error', path: `cells.${cid}.${sib}.type`, text: 'type must be gser, hex or jer' });
            }
            if (body && body.type === 'hex' && typeof body.payload === 'string' && !/^([0-9a-fA-F]{2})+$/.test(body.payload)) {
              out.push({ level: 'error', path: `cells.${cid}.${sib}.payload`, text: 'hex payload must be an even number of hex digits' });
            }
            if (sib === 'sib1' && body && typeof body.cell_barred !== 'undefined' && ![true, false, 'auto'].includes(body.cell_barred)) {
              out.push({ level: 'error', path: `cells.${cid}.sib1.cell_barred`, text: 'cell_barred must be true, false or "auto"' });
            }
          }
        }
      }
      return out;
    },
    assess: (m) => {
      const barred = Object.entries<any>(m.cells ?? {}).filter(([, c]) => c?.sib1?.cell_barred === true).map(([id]) => id);
      return barred.length ? { level: 'destructive', reasons: [`Bars cell(s) ${barred.join(', ')}: idle UEs leave, new attaches are refused.`] } : null;
    },
  },
  {
    message: 'config_set',
    components: ['ENB'],
    category: 'Cell config',
    label: 'Runtime cell / RF / log settings',
    description: 'Change runtime settings. logs; cells.<id> (pdsch_mcs, pusch_mcs, force_dl_schedule, force_full_bsr, fixed RB alloc, forced_cqi/ri/pmi, pdsch_fer/pusch_fer, inactivity_timer, rrc_procedure_filter, cell_barred (NR) ...); rf_ports[] (channel_dl simulator, ul_freq_shift); son_config.',
    params: {
      logs: obj('Log configuration (same structure as config_get.logs).'),
      cells: obj('Keyed by cell_id.'),
      rf_ports: arr('Per RF port: channel_dl {noise_level, freq_shift, delay, gain, freq_doppler, paths[]}, ul_freq_shift.', 'object'),
      son_config: obj('SON configuration (see LTE/NR cell SON configuration).'),
    },
    example: { message: 'config_set', cells: { '1': { pdsch_mcs: 20 } } },
    presets: [
      { label: 'PHY debug logs', body: { message: 'config_set', logs: { layers: { PHY: { level: 'debug', max_size: 1, payload: true } } } } },
      { label: 'Force DL scheduling', body: { message: 'config_set', cells: { '1': { force_dl_schedule: true } } } },
      { label: 'Fixed PDSCH RB alloc', body: { message: 'config_set', cells: { '1': { pdsch_fixed_rb_alloc: true, pdsch_fixed_rb_start: 0, pdsch_fixed_l_crb: 20 } } } },
      { label: 'Force PUSCH MCS', body: { message: 'config_set', cells: { '1': { pusch_mcs: 2 } } } },
      { label: 'Force full BSR', body: { message: 'config_set', cells: { '1': { force_full_bsr: true } } } },
      { label: 'Inactivity timer 60 s', body: { message: 'config_set', cells: { '1': { inactivity_timer: 60000 } } } },
      { label: 'Release forced MCS', body: { message: 'config_set', cells: { '1': { pdsch_mcs: -1, pusch_mcs: -1 } } } },
    ],
    danger: 'caution',
    dangerNote: 'Test features take effect on the live cell immediately. Record config_get first; forced values persist until you set them back (e.g. pdsch_mcs: -1).',
    readOnly: false,
    docRef: 'lteenb 10.5 Common messages / config_set',
    notes: 'config_set does not restart lteenb. Settings are not written to enb.cfg and are lost on restart.',
    check: (m) => {
      const out = [...checkCellsObject(m, false), ...checkCellRanges(m)];
      if (m.logs === undefined && m.cells === undefined && m.rf_ports === undefined && m.son_config === undefined) {
        out.push({ level: 'warning', path: '', text: 'config_set with nothing to change' });
      }
      return out;
    },
    assess: (m) => {
      const reasons: string[] = [];
      for (const [cid, c] of Object.entries<any>(m.cells ?? {})) {
        if (c?.cell_barred === true) reasons.push(`cell ${cid} barred`);
        for (const [proc, f] of Object.entries<any>(c?.rrc_procedure_filter ?? {})) {
          if (f?.action === 'reject' || f?.action === 'ignore') reasons.push(`cell ${cid}: ${proc} will be ${f.action}ed${f.ttl ? ` (${f.ttl}x)` : ' until changed'}`);
        }
        if (typeof c?.pdsch_fer === 'number' && c.pdsch_fer >= 0.5) reasons.push(`cell ${cid}: simulated PDSCH FER ${c.pdsch_fer}`);
        if (typeof c?.pusch_fer === 'number' && c.pusch_fer >= 0.5) reasons.push(`cell ${cid}: simulated PUSCH FER ${c.pusch_fer}`);
      }
      if (reasons.length) return { level: 'destructive', reasons };
      if (m.cells === undefined && m.rf_ports === undefined && m.son_config === undefined) return { level: 'safe', reasons: [] };
      return null;
    },
  },
  {
    message: 'ntn_satellite_update',
    components: ['ENB'],
    category: 'Cell config',
    label: 'NTN satellite update',
    description: 'Update satellite ephemeris / channel simulator for an NTN cell (NR or NB-IoT).',
    params: {
      cell_id: req(int('Cell ID.', { min: 0 })),
      sv_filename: str('New state vectors file.'),
      tle_filename: str('New TLE file.'),
      ephemeris: obj('Explicit ephemeris (same as ntn config).'),
      channel_sim_control: obj('Channel simulator behaviour.'),
      earth_moving: obj('Earth-moving beam parameters.'),
      t_service: union(['integer', 'string'], 'NR: end of service time (UTC, epoch format); 0 = computed from ephemeris.', { minVersion: '2026-09-11' }),
      distance_threshold: int('Distance from reference_location in 50 m steps; -1 stops broadcasting distanceThresh.', { min: -1, max: 65525, minVersion: '2026-09-11' }),
    },
    example: { message: 'ntn_satellite_update', cell_id: 1, tle_filename: 'sat.tle' },
    danger: 'caution',
    readOnly: false,
    docRef: doc('ntn_satellite_update'),
    notes: 't_service and distance_threshold are new in 2026-09-11.',
  },
  {
    message: 'dl_sync',
    components: ['ENB'],
    category: 'Cell config',
    label: 'DL synchronization',
    description: 'Restart or query DL synchronization to a remote cell (cells configured with dl_sync). Events arrive as {message:"dl_sync", event: lost|timeout|restart|info|sync}.',
    params: {
      action: str('start forces a cell search; info returns state.', { enum: ['start', 'info'], default: 'start' }),
      cell_id: req(int('Cell ID.', { min: 0 })),
      timeout: num('Search timeout in s.', { min: 0 }),
    },
    example: { message: 'dl_sync', action: 'info', cell_id: 1 },
    danger: 'safe',
    readOnly: false,
    docRef: 'lteenb 10.10.2 DL synchronization / dl_sync',
    assess: (m) => (m.action === undefined || m.action === 'start' ? { level: 'caution', reasons: ['A new cell search interrupts the synchronized cell.'] } : null),
  },

  // ── Links ─────────────────────────────────────────────────────────────────
  { message: 's1connect', components: ['ENB'], category: 'Links', label: 'S1 connect', description: 'Force S1 connection to all registered MMEs, or to one address.', params: { address: str('MME address; all MMEs when absent.') }, example: { message: 's1connect' }, danger: 'safe', readOnly: false, docRef: doc('s1connect') },
  { message: 's1disconnect', components: ['ENB'], category: 'Links', label: 'S1 disconnect', description: 'Force S1 disconnection from all MMEs, or one address.', params: { address: str('MME address; all MMEs when absent.') }, example: { message: 's1disconnect' }, danger: 'destructive', dangerNote: 'All LTE UEs lose core connectivity. Restore with s1connect.', readOnly: false, docRef: doc('s1disconnect') },
  { message: 's1add', components: ['ENB'], category: 'Links', label: 'Add MME', description: 'Add an MME to the S1AP list (same fields as an mme_list entry, e.g. mme_addr).', params: { mme_addr: req(str('MME address.')) }, openParams: true, example: { message: 's1add', mme_addr: '127.0.1.100' }, danger: 'caution', readOnly: false, docRef: doc('s1add') },
  { message: 's1delete', components: ['ENB'], category: 'Links', label: 'Remove MME', description: 'Remove an MME address from the S1AP list.', params: { addr: req(str('MME address to remove.')) }, example: { message: 's1delete', addr: '127.0.1.100' }, danger: 'destructive', readOnly: false, docRef: doc('s1delete') },
  { message: 'ngconnect', components: ['ENB'], category: 'Links', label: 'NG connect', description: 'Force NG connection to all AMFs, or one address.', params: { address: str('AMF address; all AMFs when absent.') }, example: { message: 'ngconnect' }, danger: 'safe', readOnly: false, docRef: doc('ngconnect') },
  { message: 'ngdisconnect', components: ['ENB'], category: 'Links', label: 'NG disconnect', description: 'Force NG disconnection from all AMFs, or one address.', params: { address: str('AMF address; all AMFs when absent.') }, example: { message: 'ngdisconnect' }, danger: 'destructive', dangerNote: 'All 5GC UEs lose core connectivity. Restore with ngconnect.', readOnly: false, docRef: doc('ngdisconnect') },
  { message: 'ngadd', components: ['ENB'], category: 'Links', label: 'Add AMF', description: 'Add an AMF to the NGAP list (same fields as an amf_list entry, e.g. amf_addr).', params: { amf_addr: req(str('AMF address.')) }, openParams: true, example: { message: 'ngadd', amf_addr: '127.0.1.100' }, danger: 'caution', readOnly: false, docRef: doc('ngadd') },
  { message: 'ngdelete', components: ['ENB'], category: 'Links', label: 'Remove AMF', description: 'Remove an AMF address from the NGAP list.', params: { addr: req(str('AMF address to remove.')) }, example: { message: 'ngdelete', addr: '127.0.1.100' }, danger: 'destructive', readOnly: false, docRef: doc('ngdelete') },
  { message: 'x2connect', components: ['ENB'], category: 'Links', label: 'X2 connect', description: 'Force X2 connection to a peer.', params: { addr: req(str('X2 peer address.')) }, example: { message: 'x2connect', addr: '192.168.1.81' }, danger: 'safe', readOnly: false, docRef: doc('x2connect') },
  { message: 'x2disconnect', components: ['ENB'], category: 'Links', label: 'X2 disconnect', description: 'Force X2 disconnection from a peer.', params: { addr: req(str('X2 peer address.')) }, example: { message: 'x2disconnect', addr: '192.168.1.81' }, danger: 'caution', readOnly: false, docRef: doc('x2disconnect') },
  { message: 'xnconnect', components: ['ENB'], category: 'Links', label: 'Xn connect', description: 'Force Xn connection to a peer.', params: { addr: req(str('Xn peer address.')) }, example: { message: 'xnconnect', addr: '192.168.1.81' }, danger: 'safe', readOnly: false, docRef: doc('xnconnect') },
  { message: 'xndisconnect', components: ['ENB'], category: 'Links', label: 'Xn disconnect', description: 'Force Xn disconnection from a peer.', params: { addr: req(str('Xn peer address.')) }, example: { message: 'xndisconnect', addr: '192.168.1.81' }, danger: 'caution', readOnly: false, docRef: doc('xndisconnect') },
  { message: 'm2connect', components: ['ENB'], category: 'Links', label: 'M2 connect', description: 'Connect to the MBMSGW (previous address when absent).', params: { addr: str('MBMSGW address.') }, example: { message: 'm2connect' }, danger: 'safe', readOnly: false, docRef: doc('m2connect') },
  { message: 'm2disconnect', components: ['ENB'], category: 'Links', label: 'M2 disconnect', description: 'Release the MBMSGW connection.', example: { message: 'm2disconnect' }, danger: 'caution', readOnly: false, docRef: doc('m2disconnect') },
];


// UE simulator (lteue) remote API catalogue.
// Source: lteue.html 2026-09-11, chapter 8 "Remote API", sections 8.5-8.9.
// IP simulation messages (ping, cbr_*, tcp, flood_*, http) are not catalogued.
import type { ApiCommand } from '../common/types';
import { arr, bool, int, num, obj, req, str, union } from '../common/helpers';

const doc = (m: string) => `lteue 8.6 LTE messages / ${m}`;
const ueId = (help = 'UE identifier (ue_id from ue_get).') => req(int(help, { min: 0 }));

export const ueCommands: ApiCommand[] = [
  {
    message: 'ue_get', components: ['UE'], category: 'UEs', label: 'Simulated UEs',
    description: 'UE list with rrc_state, emm_state, cells, pdn_list, bitrates, counters. With update: true the call long-polls for changes.',
    params: {
      ue_id: int('Only this UE.'),
      max: int('Maximum UEs returned.', { min: 1 }),
      update: bool('Only UEs modified since the last update call on this connection (long-poll).'),
      timeout: int('Seconds to wait for a change when update is true.', { min: 0, default: 5 }),
    },
    example: { message: 'ue_get', max: 50 }, danger: 'safe', readOnly: true, docRef: doc('ue_get'),
    check: (m) => (m.timeout !== undefined && m.update !== true ? [{ level: 'warning', path: 'timeout', text: 'timeout is only used with update: true' }] : []),
  },
  { message: 'power_on', components: ['UE'], category: 'UEs', label: 'Power on', description: 'Switch a UE on.', params: { ue_id: ueId() }, example: { message: 'power_on', ue_id: 1 }, danger: 'safe', readOnly: false, docRef: doc('power_on') },
  { message: 'power_off', components: ['UE'], category: 'UEs', label: 'Power off', description: 'Switch a UE off (detach).', params: { ue_id: ueId(), n3gpp: bool('Power off non-3GPP access only.', { default: false }) }, example: { message: 'power_off', ue_id: 1 }, danger: 'caution', dangerNote: 'The UE detaches; restore with power_on.', readOnly: false, docRef: doc('power_off') },
  { message: 'deregister', components: ['UE'], category: 'UEs', label: 'Deregister', description: 'Deregister the UE.', params: { ue_id: ueId() }, example: { message: 'deregister', ue_id: 1 }, danger: 'caution', readOnly: false, docRef: doc('deregister') },
  { message: 'rrc_reest', components: ['UE'], category: 'UEs', label: 'RRC reestablishment', description: 'Trigger an RRC reestablishment.', params: { ue_id: ueId() }, example: { message: 'rrc_reest', ue_id: 1 }, danger: 'caution', readOnly: false, docRef: doc('rrc_reest') },
  { message: 'tau_request', components: ['UE'], category: 'UEs', label: 'TAU / mobility registration', description: 'Trigger a NAS TAU / mobility registration.', params: { ue_id: ueId() }, example: { message: 'tau_request', ue_id: 1 }, danger: 'safe', readOnly: false, docRef: doc('tau_request') },
  { message: 'force_meas_report', components: ['UE'], category: 'UEs', label: 'Force measurement report', description: 'Send an RRC Measurement Report for a meas_id.', params: { ue_id: ueId(), meas_id: req(int('Measurement identifier.', { min: 1 })) }, example: { message: 'force_meas_report', ue_id: 1, meas_id: 1 }, danger: 'caution', readOnly: false, docRef: doc('force_meas_report') },
  { message: 'ue_move', components: ['UE'], category: 'UEs', label: 'Move UE (channel sim)', description: 'Move a UE; only with channel_sim.', params: { ue_id: ueId(), position: arr('Position [x, y] (see channel simulator).', 'number'), speed: num('Speed.'), direction: num('Direction.'), elevation: num('Elevation.') }, example: { message: 'ue_move', ue_id: 1, position: [100, 0] }, danger: 'caution', readOnly: false, docRef: doc('ue_move') },
  { message: 'ue_add', components: ['UE'], category: 'UEs', label: 'Add UEs', description: 'Add UEs (same fields as ue_list in ue.cfg). Response info lines.', params: { list: req(arr('UE definitions.', 'object')) }, example: { message: 'ue_add', list: [{ ue_id: 100, imsi: '001010123456789', K: '00112233445566778899aabbccddeeff', sim_algo: 'milenage' }] }, danger: 'caution', readOnly: false, docRef: doc('ue_add') },
  {
    message: 'ue_del', components: ['UE'], category: 'UEs', label: 'Remove UE(s)', description: 'Remove UE(s) from the simulator WITHOUT deregistration. Response: deleted / unknown / invalid for lists.',
    params: { ue_id: req(union(['integer', 'array'], 'UE id or list of ids.', { items: 'integer' })) },
    example: { message: 'ue_del', ue_id: 100 }, danger: 'destructive', dangerNote: 'The UE definition is gone from the running simulator and the core keeps a stale context (no detach).', readOnly: false, docRef: doc('ue_del'),
  },
  { message: 'ue_del_all', components: ['UE'], category: 'UEs', label: 'Remove ALL UEs', description: 'Remove every UE without deregistration.', example: { message: 'ue_del_all' }, danger: 'destructive', dangerNote: 'Empties the simulator. Restart lteue (or ue_add) to recover.', readOnly: false, docRef: doc('ue_del_all') },
  { message: 'ue_ntn_stats', components: ['UE'], category: 'UEs', label: 'NTN stats', description: 'Satellite position and UE NTN link information.', params: { ue_id: ueId() }, example: { message: 'ue_ntn_stats', ue_id: 1 }, danger: 'safe', readOnly: true, minVersion: '2026-06-12', docRef: doc('ue_ntn_stats') },
  {
    message: 'ue_assistance_information', components: ['UE'], category: 'UEs', label: 'UE assistance information', description: 'Send UEAssistanceInformation.',
    params: { ue_id: ueId(), power_pref_indication: str('LTE.', { enum: ['normal', 'lowPowerConsumption'] }), preferred_rrc_state: str('NR.', { enum: ['idle', 'inactive', 'connected', 'outOfConnected'] }), preferred_max_cc: int('NR reducedMaxCCs.', { min: 1, max: 31 }), preferred_max_layers: int('NR reducedMaxMIMO-Layers.', { min: 1, max: 4 }) },
    example: { message: 'ue_assistance_information', ue_id: 1, preferred_rrc_state: 'idle' }, danger: 'safe', readOnly: false, docRef: doc('ue_assistance_information'),
  },

  // ── Sessions ──────────────────────────────────────────────────────────────
  {
    message: 'pdn_connect', components: ['UE'], category: 'Sessions', label: 'PDN / PDU session connect', description: 'Open a PDN connection or PDU session. Response: cid (+ erab_id or pdu_session_id).',
    params: {
      ue_id: ueId(), apn: str('APN (required unless emergency).'), emergency: bool('Emergency PDN.', { default: false }),
      n3gpp: bool('Over non-3GPP access.', { default: false, minVersion: '2026-06-12' }),
      authentication: str('Authentication.', { enum: ['none', 'pap', 'chap', 'eap'], default: 'none' }), username: str('Username (<=100 chars).'), password: str('Password (<=100 chars).'),
      pdn_type: str('Session type.', { enum: ['ipv4', 'ipv6', 'ipv4v6', 'unstructured', 'ethernet'], default: 'ipv4v6' }),
      ims: bool('IMS session.', { default: false }), pdu_session_id: int('PDU session id.'), always_on: bool('Always-on (5G).', { default: true }), snssai: obj('S-NSSAI (5G).'),
    },
    oneOf: [['apn', 'emergency']],
    example: { message: 'pdn_connect', ue_id: 1, apn: 'internet', pdn_type: 'ipv4' }, danger: 'safe', readOnly: false, docRef: doc('pdn_connect'),
  },
  { message: 'pdn_disconnect', components: ['UE'], category: 'Sessions', label: 'PDN / PDU session disconnect', description: 'Release a PDN connection / PDU session by cid or apn.', params: { ue_id: ueId(), cid: int('Connection id from pdn_connect (0 = initial).', { min: 0 }), apn: str('APN if cid absent.'), emergency: bool('Emergency PDN.', { default: false }), snssai: obj('S-NSSAI (5G).') }, oneOf: [['cid', 'apn', 'emergency']], example: { message: 'pdn_disconnect', ue_id: 1, cid: 1 }, danger: 'caution', readOnly: false, docRef: doc('pdn_disconnect') },
  { message: 'n3gpp_pdn_ho', components: ['UE'], category: 'Sessions', label: '3GPP <-> non-3GPP PDN handover', description: 'Move a PDN/PDU session between 3GPP and non-3GPP access.', params: { ue_id: ueId(), cid: req(int('Connection id.', { min: 0 })), apn: str('APN (EPS).'), to_n3gpp: req(bool('true: to non-3GPP, false: to 3GPP.')) }, example: { message: 'n3gpp_pdn_ho', ue_id: 1, cid: 0, to_n3gpp: true }, danger: 'caution', readOnly: false, minVersion: '2026-06-12', docRef: doc('n3gpp_pdn_ho') },
  { message: 'n3gpp_register', components: ['UE'], category: 'Sessions', label: 'Non-3GPP registration', description: '5GS only: trigger a non-3GPP registration.', params: { ue_id: ueId() }, example: { message: 'n3gpp_register', ue_id: 1 }, danger: 'safe', readOnly: false, minVersion: '2026-06-12', docRef: doc('n3gpp_register') },
  { message: 'non_ip_data', components: ['UE'], category: 'Sessions', label: 'Send non-IP data', description: 'Send hex data over a non-IP PDN / unstructured PDU session.', params: { ue_id: ueId(), erab_id: int('Non-IP default bearer (LTE).'), pdu_session_id: int('Unstructured PDU session (5G).'), data: req(str('Hex dump.', { pattern: '^([0-9a-fA-F]{2})*$' })) }, oneOf: [['erab_id', 'pdu_session_id']], example: { message: 'non_ip_data', ue_id: 1, erab_id: 5, data: '48656c6c6f' }, danger: 'safe', readOnly: false, docRef: doc('non_ip_data') },
  { message: 'rlc_drop_rate', components: ['UE'], category: 'Sessions', label: 'Drop DL RLC PDUs', description: 'Drop a percentage of downlink RLC PDUs.', params: { ue_id: ueId(), rb_id: req(int('Bearer identity.', { min: 0 })), srb: req(bool('Signalling bearer.')), percentage: req(int('Drop percentage.', { min: 0, max: 100 })) }, example: { message: 'rlc_drop_rate', ue_id: 1, rb_id: 3, srb: false, percentage: 0 }, danger: 'caution', readOnly: false, docRef: doc('rlc_drop_rate') },
  { message: 'ue_activate_dedicated_bearer', components: ['UE'], category: 'Sessions', label: 'Request dedicated bearer', description: 'UE-initiated Bearer Resource Allocation Request.', params: { ue_id: ueId(), def_bearer_id: req(int('Default EPS bearer id.')), qci: int('QCI.', { min: 1, max: 255 }), gbr: obj('GBR info.'), filters: arr('TFT filters.', 'object') }, example: { message: 'ue_activate_dedicated_bearer', ue_id: 1, def_bearer_id: 5, qci: 1 }, danger: 'safe', readOnly: false, docRef: doc('ue_activate_dedicated_bearer') },
  { message: 'ue_bearer_resource_modification', components: ['UE'], category: 'Sessions', label: 'Modify bearer', description: 'Bearer Resource Modification Request.', params: { ue_id: ueId(), bearer_id: req(int('EPS bearer id.')), qci: int('QCI.', { min: 1, max: 255 }), gbr: obj('GBR.'), filters: arr('TFT.', 'object') }, example: { message: 'ue_bearer_resource_modification', ue_id: 1, bearer_id: 6, qci: 2 }, danger: 'caution', readOnly: false, docRef: doc('ue_bearer_resource_modification') },
  { message: 'ue_deactivate_dedicated_bearer', components: ['UE'], category: 'Sessions', label: 'Deactivate dedicated bearer', description: 'Bearer Resource Modification Request for deactivation.', params: { ue_id: ueId(), bearer_id: req(int('EPS bearer id.')) }, example: { message: 'ue_deactivate_dedicated_bearer', ue_id: 1, bearer_id: 6 }, danger: 'caution', readOnly: false, docRef: doc('ue_deactivate_dedicated_bearer') },
  { message: 'ue_pdu_session_modification', components: ['UE'], category: 'Sessions', label: 'PDU session modification', description: 'PDU Session Modification Request.', params: { ue_id: ueId(), cid: int('Connection id.'), apn: str('APN (if no cid).'), n3gpp: bool('Non-3GPP session.', { default: false }), qos_rules: arr('QoS rules.', 'object'), qos_flow: arr('QoS flows.', 'object') }, oneOf: [['cid', 'apn']], example: { message: 'ue_pdu_session_modification', ue_id: 1, cid: 0 }, danger: 'caution', readOnly: false, docRef: doc('ue_pdu_session_modification') },

  // ── Messaging / MBMS ──────────────────────────────────────────────────────
  { message: 'sms', components: ['UE'], category: 'Messaging', label: 'Send SMS', description: 'Send an SMS from a UE.', params: { ue_id: ueId(), dst: req(str('Destination number.')), text: req(str('SMS text.')), validity: int('Validity in s.', { default: 86400 }), status_req: bool('Request a status report.', { default: false }) }, example: { message: 'sms', ue_id: 1, dst: '0600000001', text: 'hello' }, danger: 'safe', readOnly: false, docRef: doc('sms') },
  { message: 'sms_command', components: ['UE'], category: 'Messaging', label: 'SMS-COMMAND', description: 'Send an SMS-COMMAND (TP-Command-Type 0-3).', params: { ue_id: ueId(), type: req(int('TP-Command-Type.', { enum: [0, 1, 2, 3] })), msg_number: req(int('TP-Message-Number.', { min: 0, max: 255 })), dst: req(str('TP-Destination-Address.')) }, example: { message: 'sms_command', ue_id: 1, type: 0, msg_number: 0, dst: '0600000001' }, danger: 'safe', readOnly: false, docRef: doc('sms_command') },
  { message: 'sms_memory', components: ['UE'], category: 'Messaging', label: 'SMS memory', description: 'Set SMS memory availability (true sends RP-SMMA).', params: { memory: req(bool('Memory available.')) }, example: { message: 'sms_memory', memory: true }, danger: 'safe', readOnly: false, docRef: doc('sms_memory') },
  { message: 'mbms', components: ['UE'], category: 'Messaging', label: 'MBMS statistics', description: 'MBMS (LTE) or MBS broadcast (NR) session statistics for a UE.', params: { ue_id: ueId() }, example: { message: 'mbms', ue_id: 1 }, danger: 'safe', readOnly: true, minVersion: '2026-06-12', docRef: doc('mbms') },
  { message: 'mbms_set', components: ['UE'], category: 'Messaging', label: 'MBMS services', description: 'Start/stop receiving MBMS services ("plmn.service_id").', params: { ue_id: ueId(), service_list: req(arr('"plmn.service_id" strings.', 'string')) }, example: { message: 'mbms_set', ue_id: 1, service_list: ['00101.1'] }, danger: 'safe', readOnly: false, docRef: doc('mbms_set') },

  // ── Radio ─────────────────────────────────────────────────────────────────
  {
    message: 'rf', components: ['UE'], category: 'Radio', label: 'RF gains (get/set)', description: 'Without gains: current tx_gain/rx_gain and rf_info. With gains: set them.',
    params: { tx_gain: union(['number', 'array'], 'TX gain dB.', { items: 'number' }), tx_channel_index: int('Channel.', { min: 0 }), rx_gain: union(['number', 'array'], 'RX gain dB.', { items: 'number' }), rx_channel_index: int('Channel.', { min: 0 }) },
    example: { message: 'rf' }, danger: 'safe', readOnly: true, docRef: doc('rf'),
    assess: (m) => (m.tx_gain !== undefined || m.rx_gain !== undefined ? { level: 'caution', reasons: ['Changes the simulator RF gain for all UEs.'] } : null),
  },
  {
    message: 'trx_iq_dump', components: ['UE'], category: 'Radio', label: 'IQ dump', description: 'Dump IQ samples to files on the UE box (notification when started, then response).',
    params: { duration: num('ms, max 30000.', { min: 1, max: 30000, default: 1000 }), rf_port: union(['integer', 'array'], 'RF ports.', { items: 'integer' }), rx_filename: str('RX file (%d per antenna).'), tx_filename: str('TX file (%d per antenna).'), rx_channels: arr('RX channels.', 'integer'), tx_channels: arr('TX channels.', 'integer'), rx_header: bool('Per-read header.'), tx_header: bool('Per-write header.') },
    oneOf: [['rx_filename', 'tx_filename']],
    example: { message: 'trx_iq_dump', duration: 100, rx_filename: '/tmp/ue_rx%d.bin' }, danger: 'caution', readOnly: false, docRef: doc('trx_iq_dump'),
  },
  {
    message: 'ext_app', components: ['UE'], category: 'Radio', label: 'External application', description: 'Run an external program in a UE namespace (needs tun_setup_script). Sends start and progress notifications, then output/error.',
    params: { name: req(str('Session name.')), ue_id: int('UE identifier (shown in the doc example).', { min: 0 }), end_time: req(num('End time (kill after).')), prog: req(str('Program path.')), args: arr('Arguments.', 'any'), dump_stdout: bool('Redirect stdout.'), dump_stderr: bool('Redirect stderr.') },
    example: { message: 'ext_app', name: 'ping', ue_id: 1, start_time: 1, end_time: 5, prog: 'ext_app.sh', args: ['ping -c 3 8.8.8.8'] },
    danger: 'caution', dangerNote: 'Executes a program on the UE simulator host.', readOnly: false, longPoll: true, docRef: doc('ext_app'),
  },
];

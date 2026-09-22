// MME / AMF (ltemme) remote API catalogue.
// Source: ltemme.html 2026-09-11, chapter 6 "Remote API", sections 6.5-6.9.
// Positioning (LCSAP/LPPa/LPP/NRPPa) and ePDG messages are not catalogued;
// the raw editor still sends them (validation reports them as unknown).
import type { ApiCommand, ValidationIssue } from '../common/types';
import { arr, bool, imeiParam, imsiParam, int, n3gppParam, naiParam, obj, req, str } from '../common/helpers';

const doc = (m: string) => `ltemme 6.6 LTE messages / ${m}`;

/** Addressing a subscriber: imsi or nai (+ imei with multi_sim). */
const subscriber = () => ({ imsi: imsiParam(), nai: naiParam(), imei: imeiParam() });

/** EMM causes that make a UE treat its USIM as invalid (TS 24.301 5.5.1.2.5). */
const SIM_INVALIDATING_CAUSES = new Set([3, 6, 7, 8]);

const status = (message: string, label: string, description: string): ApiCommand => ({
  message, components: ['MME'], category: 'Links', label, description,
  example: { message }, danger: 'safe', readOnly: true, docRef: doc(message),
});
const connect = (message: string, label: string, key: 'addr' | 'api_root', description: string): ApiCommand => ({
  message, components: ['MME'], category: 'Links', label, description,
  params: { [key]: str(key === 'addr' ? 'Peer address; previously configured address when absent.' : 'api_root (<scheme>://<host>:<port>); previously configured when absent.') },
  example: { message }, danger: 'safe', readOnly: false, docRef: doc(message),
});
const disconnect = (message: string, label: string, description: string): ApiCommand => ({
  message, components: ['MME'], category: 'Links', label, description,
  example: { message }, danger: 'caution', dangerNote: 'Subscribers depending on this interface fail until reconnected.', readOnly: false, docRef: doc(message),
});

export const mmeCommands: ApiCommand[] = [
  // ── Subscribers ───────────────────────────────────────────────────────────
  {
    message: 'ue_get',
    components: ['MME'],
    category: 'Subscribers',
    label: 'UE contexts',
    description: 'UEs known to the MME/AMF: rat_type, imsi, imeisv, registered, tac, enb_ue_id/mme_ue_id (connected), bearers/PDN sessions with IP addresses.',
    params: {
      imsi: str('Only this IMSI.'),
      nai: str('Only this NAI (5GC, only if imsi absent).'),
      imei: str('Only this IMEI (14 or 15 digits).'),
      type: str('Access type filter.', { enum: ['3gpp', 'n3gpp', 'both'], default: 'both' }),
      mme_ue_id: int('Only this MME UE id (EPC). Other filters ignored.'),
      amf_ue_id: int('Only this AMF UE id (5GC). Other filters ignored.'),
      radio_capabilities: bool('Include radio_capabilities.'),
    },
    example: { message: 'ue_get' },
    danger: 'safe',
    readOnly: true,
    docRef: doc('ue_get'),
    check: (m) => (m.nai !== undefined && m.imsi !== undefined ? [{ level: 'warning', path: 'nai', text: 'nai is only used when imsi is absent' }] : []),
  },
  {
    message: 'ue_set',
    components: ['MME'],
    category: 'Subscribers',
    label: 'Modify UE in database',
    description: 'Modify per-PDN settings of a subscriber in the UE database.',
    params: { imsi: str('Subscriber IMSI.'), nai: str('Subscriber NAI (if imsi absent).'), pdn_list: req(arr('Entries: {access_point_name, ...PDN settings}.', 'object')) },
    oneOf: [['imsi', 'nai']],
    openParams: true,
    example: { message: 'ue_set', imsi: '001010123456789', pdn_list: [{ access_point_name: 'internet' }] },
    danger: 'caution',
    readOnly: false,
    docRef: doc('ue_set'),
  },
  {
    message: 'ue_add',
    components: ['MME'],
    category: 'Subscribers',
    label: 'Add subscribers',
    description: 'Add entries to the UE database (same fields as ue_db in mme.cfg: sim_algo, imsi, amf, sqn, K, impi ...). Not persisted to the config file.',
    params: { ue_db: req(arr('ue_db entries.', 'object')) },
    example: { message: 'ue_add', ue_db: [{ sim_algo: 'milenage', imsi: '001010123456789', opc: '00000000000000000000000000000000', amf: 0x9001, sqn: '000000000000', K: '00112233445566778899aabbccddeeff' }] },
    danger: 'caution',
    readOnly: false,
    docRef: doc('ue_add'),
    check: (m) => {
      const out: ValidationIssue[] = [];
      (Array.isArray(m.ue_db) ? m.ue_db : []).forEach((u: any, i: number) => {
        if (!u || typeof u !== 'object') out.push({ level: 'error', path: `ue_db.${i}`, text: 'entry must be an object' });
        else if (!u.imsi && !u.nai) out.push({ level: 'error', path: `ue_db.${i}.imsi`, text: 'entry needs imsi (or nai)' });
      });
      return out;
    },
  },
  {
    message: 'ue_del',
    components: ['MME'],
    category: 'Subscribers',
    label: 'Delete subscriber',
    description: 'REMOVES the UE from the UE database and detaches it if needed. The subscriber can no longer attach until re-added (ue_add) or the MME restarts with mme.cfg.',
    params: { imsi: imsiParam('IMSI of the UE to delete. Shall be present if nai is absent.'), nai: naiParam(), local: bool('Local detach without NAS signalling.', { default: false }) },
    oneOf: [['imsi', 'nai']],
    example: { message: 'ue_del', imsi: '001010123456789' },
    danger: 'destructive',
    dangerNote: 'Deletes the subscriber from ue_db (not just the context). Use ue_detach to only detach.',
    readOnly: false,
    docRef: doc('ue_del'),
    notes: 'Live-tested 2026-06-12: the entry is gone from ue_db afterwards. Keep the ue_db entry to re-add it with ue_add.',
  },
  {
    message: 'ue_detach',
    components: ['MME'],
    category: 'Subscribers',
    label: 'Network detach',
    description: 'Force a network-initiated detach / deregistration.',
    params: {
      ...subscriber(),
      n3gpp: n3gppParam(),
      type: int('Detach type (24.301 9.9.3.7) / de-registration type (24.501). EPS default 2 (re-attach not required); 5GS default 1.'),
      cause: int('EMM/5GMM cause. DEFAULT 3 (Illegal UE). -1 omits the cause IE.', { min: -1, max: 255, default: 3 }),
      local: bool('Local detach without NAS signalling.', { default: false }),
    },
    oneOf: [['imsi', 'nai']],
    example: { message: 'ue_detach', imsi: '001010123456789', type: 1, cause: -1 },
    danger: 'caution',
    readOnly: false,
    docRef: doc('ue_detach'),
    notes: 'The default cause #3 (Illegal UE) makes the UE mark its USIM invalid: it stops attaching until power cycle / SIM re-insert. Live-observed 2026-06-12. Send cause -1 (no cause) with type 1 (re-attach required) for a clean re-attach.',
    check: (m) => (m.cause === undefined
      ? [{ level: 'warning', path: 'cause', text: 'No cause: the server uses #3 (Illegal UE), which locks the SIM out. Set cause: -1 for a harmless detach.' }]
      : []),
    assess: (m) => {
      const cause = m.cause === undefined ? 3 : m.cause;
      if (SIM_INVALIDATING_CAUSES.has(cause)) {
        return { level: 'destructive', reasons: [`EMM cause #${cause}${m.cause === undefined ? ' (server default)' : ''} invalidates the USIM on the UE: it will not re-attach until power cycle or SIM re-insert.`] };
      }
      return null;
    },
  },
  {
    message: 'ue_identity_request',
    components: ['MME'],
    category: 'Subscribers',
    label: 'Identity request',
    description: 'Force an identification procedure.',
    params: { ...subscriber(), n3gpp: n3gppParam(), type: req(int('Identity type 1-5 (1 IMSI/SUCI, 2 IMEI, 3 IMEISV ...).', { min: 1, max: 5 })) },
    oneOf: [['imsi', 'nai']],
    example: { message: 'ue_identity_request', imsi: '001010123456789', type: 2 },
    danger: 'safe',
    readOnly: false,
    docRef: doc('ue_identity_request'),
  },
  {
    message: 'load_balancing_tau',
    components: ['MME'],
    category: 'Subscribers',
    label: 'Load balancing TAU',
    description: 'Initiate an LTE load-balancing TAU (UE is released and re-attaches through TAU).',
    params: { imsi: req(imsiParam('UE IMSI.')), imei: imeiParam() },
    example: { message: 'load_balancing_tau', imsi: '001010123456789', imei: '35609204079301' },
    danger: 'caution',
    readOnly: false,
    docRef: doc('load_balancing_tau'),
    notes: 'Live-tested 2026-06-12 with {imsi, imei}.',
  },
  { message: 'guti_realloc', components: ['MME'], category: 'Subscribers', label: 'GUTI reallocation', description: 'Initiate an LTE GUTI reallocation procedure.', params: { imsi: req(imsiParam('UE IMSI.')), imei: imeiParam() }, example: { message: 'guti_realloc', imsi: '001010123456789' }, danger: 'caution', readOnly: false, docRef: doc('guti_realloc') },
  { message: 'mt_cs_paging', components: ['MME'], category: 'Subscribers', label: 'CS paging', description: 'Trigger a CS paging for a UE connected to EPC (CSFB).', params: { imsi: req(imsiParam('UE IMSI.')) }, example: { message: 'mt_cs_paging', imsi: '001010123456789' }, danger: 'caution', readOnly: false, docRef: doc('mt_cs_paging') },
  {
    message: 'me_add', components: ['MME'], category: 'Subscribers', label: 'Add devices (EIR)', description: 'Add/update IMEI (14) or IMEISV (16) entries in the ME database.',
    params: { default_status: str('Status for unlisted devices.', { enum: ['whitelisted', 'blacklisted', 'greylisted'] }), whitelist: arr('IMEI/IMEISV list.', 'string'), blacklist: arr('IMEI/IMEISV list.', 'string'), greylist: arr('IMEI/IMEISV list.', 'string') },
    example: { message: 'me_add', whitelist: ['35609204079301'] }, danger: 'caution', readOnly: false, docRef: doc('me_add'),
    assess: (m) => (m.default_status === 'blacklisted' || (Array.isArray(m.blacklist) && m.blacklist.length) ? { level: 'destructive', reasons: ['Blacklisted devices are rejected at attach.'] } : null),
  },
  { message: 'me_del', components: ['MME'], category: 'Subscribers', label: 'Remove devices (EIR)', description: 'Remove IMEI/IMEISV entries from the ME database.', params: { list: req(arr('IMEI (14) or IMEISV (16) strings.', 'string')) }, example: { message: 'me_del', list: ['35609204079301'] }, danger: 'caution', readOnly: false, docRef: doc('me_del') },

  // ── Bearers ───────────────────────────────────────────────────────────────
  {
    message: 'ue_activate_dedicated_bearer',
    components: ['MME'],
    category: 'Bearers',
    label: 'Activate dedicated bearer / QoS flow',
    description: 'Network-initiated dedicated EPS bearer or 5GS QoS flow. Response: erab_id (EPS) or pdu_session_id + qos_flow_id (5GS).',
    params: {
      ...subscriber(),
      apn: str('APN of the default bearer (if no pdu_session_id / linked_erab_id).'),
      sst: int('PDU session SST (5GC).'), sd: int('PDU session SD (5GC).'),
      linked_erab_id: int('Default EPS bearer id (EPC).'),
      pdu_session_id: int('PDU session id (5GC).'),
      qci: req(int('QCI (EPS) or 5QI (5GS).', { min: 1, max: 255 })),
      '5qi_qos': obj('5QI QoS characteristics.'),
      priority_level: int('ARP priority level.', { min: 1, max: 15, default: 15 }),
      pre_emption_capability: str('ARP pre-emption capability.', { enum: ['shall_not_trigger_pre_emption', 'may_trigger_pre_emption'] }),
      pre_emption_vulnerability: str('ARP pre-emption vulnerability.', { enum: ['not_pre_emptable', 'pre_emptable'] }),
      filters: req(arr('TFT packet filters.', 'object')),
      gbr: obj('GBR: {maximum_bitrate_dl, maximum_bitrate_ul, guaranteed_bitrate_dl, guaranteed_bitrate_ul}.'),
      transaction_identifier: int('Transaction identifier IE.', { min: 0, max: 127 }),
      llc_sapi: int('LLC SAPI IE.', { min: 0, max: 15 }),
      radio_priority: int('Radio priority IE.', { min: 0, max: 7 }),
      packet_flow_identifier: int('Packet flow identifier IE.', { min: 0, max: 127 }),
      sm_qos: str('Hex QoS IE without IEI/length.'),
    },
    oneOf: [['imsi', 'nai'], ['apn', 'pdu_session_id', 'linked_erab_id']],
    example: { message: 'ue_activate_dedicated_bearer', imsi: '001010123456789', apn: 'internet', qci: 1, filters: [{ direction: 'both', id: 1, precedence: 0, components: [{ type: 'ipv4_remote_address', addr: '192.168.3.1', mask: '255.255.255.255' }] }] },
    danger: 'caution',
    readOnly: false,
    docRef: doc('ue_activate_dedicated_bearer'),
  },
  {
    message: 'ue_deactivate_bearer',
    components: ['MME'],
    category: 'Bearers',
    label: 'Deactivate bearer / QoS flow',
    description: 'Network-initiated bearer or QoS flow deactivation (local release when the UE is idle).',
    params: {
      ...subscriber(), n3gpp: n3gppParam(),
      erab_id: int('ERAB id (EPS).'), esm_cause: int('ESM cause (EPS).', { default: 36 }),
      pdu_session_id: int('PDU session id (5GS).'), qos_flow_id: int('QoS flow id (5GS).'), '5gsm_cause': int('5GSM cause (5GS).', { default: 36 }),
    },
    oneOf: [['imsi', 'nai'], ['erab_id', 'qos_flow_id']],
    example: { message: 'ue_deactivate_bearer', imsi: '001010123456789', erab_id: 6 },
    danger: 'caution',
    dangerNote: 'Deactivating the DEFAULT bearer tears down the PDN connection.',
    readOnly: false,
    docRef: doc('ue_deactivate_bearer'),
  },

  // ── PWS ───────────────────────────────────────────────────────────────────
  { message: 'pws_write', components: ['MME'], category: 'PWS', label: 'Start PWS broadcast', description: 'Start broadcasting a Public Warning message defined in mme.cfg (local_identifier).', params: { local_id: req(int('local_identifier from the MME config.')), nf: bool('Use N50 instead of SBC.', { default: false }), increment_serial_number: bool('Increment serial_number.', { default: true }) }, example: { message: 'pws_write', local_id: 1 }, danger: 'caution', dangerNote: 'Real phones in range display the warning. Stop with pws_kill.', readOnly: false, docRef: doc('pws_write') },
  { message: 'pws_kill', components: ['MME'], category: 'PWS', label: 'Stop PWS broadcast', description: 'Stop a PWS broadcast.', params: { local_id: req(int('local_identifier from the MME config.')), stop_all: bool('Stop-All-Indicator IE.'), send_warning_indication: bool('Send-Stop-Warning-Indication IE.'), nf: bool('Use N50 instead of SBC.', { default: false }) }, example: { message: 'pws_kill', local_id: 1 }, danger: 'safe', readOnly: false, docRef: doc('pws_kill') },

  // ── Links / RAN ───────────────────────────────────────────────────────────
  status('enb', 'eNB connections', 'enb_list: plmn, eNB_ID, name, address, ue_ctx.'),
  status('ng_ran', 'NG-RAN connections', 'ng_ran_list of gNB / ng-eNB connections.'),
  status('s6', 'S6a (HSS) state', 'state, address, host, realm.'),
  connect('s6connect', 'S6a connect', 'addr', 'Force S6a connection.'),
  disconnect('s6disconnect', 'S6a disconnect', 'Force S6a release.'),
  status('s13', 'S13 (EIR) state', 'state, address, host, realm.'),
  connect('s13connect', 'S13 connect', 'addr', 'Force S13 connection.'),
  disconnect('s13disconnect', 'S13 disconnect', 'Force S13 release.'),
  status('sgs', 'SGs (MSC/VLR) state', 'state, address.'),
  connect('sgsconnect', 'SGs connect', 'addr', 'Force SGs connection.'),
  disconnect('sgsdisconnect', 'SGs disconnect', 'Force SGs release.'),
  status('sbc', 'CBC connections', 'cbc_list.'),
  status('lcs', 'LCS (E-SMLC) state', 'state, address.'),
  connect('lcsconnect', 'LCS connect', 'addr', 'Force LCS connection.'),
  status('n8', 'N8 (UDM)', 'server_address.'),
  connect('n8connect', 'N8 connect', 'api_root', 'Connect the AMF N8 client to the UDM.'),
  disconnect('n8disconnect', 'N8 disconnect', 'Disconnect the AMF N8 client.'),
  status('n12', 'N12 (AUSF)', 'server_address, client_address.'),
  connect('n12connect', 'N12 connect', 'api_root', 'Connect the AMF N12 client to the AUSF.'),
  disconnect('n12disconnect', 'N12 disconnect', 'Disconnect the AMF N12 client.'),
  status('n17', 'N17 (EIR)', 'server_address, client_address.'),
  connect('n17connect', 'N17 connect', 'api_root', 'Connect the AMF N17 client to the EIR.'),
  disconnect('n17disconnect', 'N17 disconnect', 'Disconnect the AMF N17 client.'),
  status('nl1', 'NL1 (LMF)', 'server_address, client_address.'),
  connect('nl1connect', 'NL1 connect', 'api_root', 'Connect the AMF NL1 client to the LMF.'),
  disconnect('nl1disconnect', 'NL1 disconnect', 'Disconnect the AMF NL1 client.'),
  status('mbs_session_info', 'MBS sessions', 'MBS broadcast sessions at the MB-SMF side.'),

  // ── Core config ───────────────────────────────────────────────────────────
  {
    message: 'config_set',
    components: ['MME'],
    category: 'Core config',
    label: 'Runtime MME/AMF settings',
    description: 'Change runtime settings: logs, relative_capacity, *_reject_error causes, attach_reject_filter, NAS timers (t3402, t3412, t3512 ...), psm/edrx/mico, ims_vops_*, emergency_number_list, emm/5gmm_procedure_filter, pdn_list ...',
    params: {
      logs: obj('Log configuration.'),
      relative_capacity: int('MME/AMF relative capacity.', { min: 0, max: 255 }),
      attach_reject_error: int('Force EMM cause in attach reject.', { min: 0, max: 255 }),
      tracking_area_update_reject_error: int('Force EMM cause in TAU reject.', { min: 0, max: 255 }),
      service_reject_error: int('Force EMM cause in service reject.', { min: 0, max: 255 }),
      pdn_connect_reject_error: int('Force ESM cause in PDN connectivity reject.', { min: 0, max: 255 }),
      registration_initial_reject_error: int('Force 5GMM cause in initial registration reject.', { min: 0, max: 255 }),
      ext_emm_cause: int('Extended EMM cause with cause 15.', { min: -1, max: 15 }),
      ext_5gmm_cause: int('Extended 5GMM cause with cause 15.', { min: -1, max: 255, minVersion: '2026-09-11' }),
      attach_reject_filter: obj('IMSI (prefix*) -> reject settings.'),
      t3402: int('T3402/T3502 in s (-1 not sent).'), t3412: int('T3412 in s (-1 deactivated).'), t3512: int('T3512 in s (-1 deactivated).'),
      emm_procedure_filter: obj('EMM procedure -> {action: treat|ignore|reject, ttl}.'),
      '5gmm_procedure_filter': obj('5GMM procedure -> {action, ttl}.'),
      ims_vops_eps: bool('IMS VoPS in S1 mode bit.'),
      pdn_list: arr('Per-PDN runtime settings.', 'object'),
      ohr_cp_ciot_opt: bool('CP CIoT with overhead reduction.', { minVersion: '2026-09-11' }),
    },
    openParams: true,
    example: { message: 'config_set', attach_reject_error: 0 },
    presets: [{ label: 'Debug NAS logs', body: { message: 'config_set', logs: { layers: { NAS: { level: 'debug', max_size: 1 } } } } }],
    danger: 'caution',
    dangerNote: 'Runtime core behaviour change for every subscriber; not saved to mme.cfg.',
    readOnly: false,
    docRef: 'ltemme 6.5 Common messages / config_set',
    assess: (m) => {
      const keys = Object.keys(m).filter(k => !['message', 'message_id'].includes(k));
      if (keys.length && keys.every(k => k === 'logs')) return { level: 'safe', reasons: [] };
      const rejects = keys.filter(k => /reject_error$/.test(k) && m[k] > 0);
      return rejects.length ? { level: 'destructive', reasons: [`${rejects.join(', ')} makes the core reject every UE until reset to 0.`] } : null;
    },
  },
];

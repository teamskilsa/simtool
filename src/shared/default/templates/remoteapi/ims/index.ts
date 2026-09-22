// IMS (lteims) remote API catalogue.
// Source: lteims.html 2026-09-11, chapter 6 "Remote API", sections 6.5-6.7.
import type { ApiCommand } from '../common/types';
import { any, arr, bool, int, num, obj, req, str, union } from '../common/helpers';

const doc = (m: string) => `lteims 6.6 LTE messages / ${m}`;

export const imsCommands: ApiCommand[] = [
  {
    message: 'users_get', components: ['IMS'], category: 'Users', label: 'Users', description: 'IMS users with bindings (uri, impu, expires) and dialogs.',
    params: { registered_only: bool('Only registered users.', { default: false }) },
    example: { message: 'users_get', registered_only: true }, danger: 'safe', readOnly: true, docRef: doc('users_get'),
    notes: 'The docs spell the parameter "registered_only." (typo with a trailing dot); the server key is registered_only.',
  },
  { message: 'users_add', components: ['IMS'], category: 'Users', label: 'Add users', description: 'Add users (same fields as the IMS ue_db).', params: { users: req(arr('User entries.', 'object')) }, example: { message: 'users_add', users: [{ impi: '001010123456789', impu: ['tel:0600000001'] }] }, danger: 'caution', readOnly: false, docRef: doc('users_add') },
  { message: 'user_set', components: ['IMS'], category: 'Users', label: 'Configure user', description: 'Set per-user options.', params: { impi: req(str('IMPI of the user.')), force_sms_over_sg: bool('Force SMS over SGs.') }, example: { message: 'user_set', impi: '001010123456789', force_sms_over_sg: false }, danger: 'caution', readOnly: false, docRef: doc('user_set') },
  { message: 'impu_set', components: ['IMS'], category: 'Users', label: 'Configure IMPU', description: 'Set IMPU parameters (same as impu config object).', params: { impu: req(str('IMPU to configure.')) }, openParams: true, example: { message: 'impu_set', impu: 'tel:0600000001' }, danger: 'caution', readOnly: false, docRef: doc('impu_set') },
  { message: 'impu_add', components: ['IMS'], category: 'Users', label: 'Add IMPU', description: 'Add an IMPU to a user, or to the echo list with impi "echo".', params: { impu: req(union(['string', 'object'], 'IMPU.')), impi: req(str('User IMPI, or "echo".')) }, example: { message: 'impu_add', impi: '001010123456789', impu: 'tel:0600000002' }, danger: 'caution', readOnly: false, docRef: doc('impu_add') },
  { message: 'impu_del', components: ['IMS'], category: 'Users', label: 'Remove IMPU', description: 'Remove an IMPU from a user or the echo list.', params: { impu: req(union(['string', 'object'], 'IMPU.')), impi: req(str('User IMPI, or "echo".')) }, example: { message: 'impu_del', impi: '001010123456789', impu: 'tel:0600000002' }, danger: 'caution', readOnly: false, docRef: doc('impu_del') },
  {
    message: 'unregister', components: ['IMS'], category: 'Users', label: 'Deregister binding', description: 'Network deregistration of a binding.',
    params: { uri: req(str('Binding URI (address of record).')), unregister_event: str('Notify event.', { default: 'deactivated' }) },
    example: { message: 'unregister', uri: 'sip:001010123456789@ims.mnc001.mcc001.3gppnetwork.org' }, danger: 'caution', dangerNote: 'The UE loses IMS registration (VoLTE) until it re-registers.', readOnly: false, docRef: doc('unregister'),
  },
  {
    message: 'sms', components: ['IMS'], category: 'Messaging', label: 'Send SMS', description: 'Send an SMS to a user (by IMPI or IMPU).',
    params: {
      impi: str('Target IMPI.'), impu: str('Target IMPU (if impi absent).'), text: str('SMS text.'), sender: str('Sender.'),
      validity: int('Validity period in s.', { default: 86400 }), binary: str('Base64 TP-User-Data (if no text).'), binary_hex: str('Hex TP-User-Data (if no text).'),
      tp_udl: int('TP-User-Data-Length for binary.'), tp_udhi_present: bool('TP-User-Data starts with a UDH.', { default: false }),
      pid: int('Protocol identifier.', { default: 0 }), dcs: int('Data coding scheme.', { default: 4 }), sos: bool('Only emergency-registered UEs.', { default: false }),
    },
    oneOf: [['impi', 'impu'], ['text', 'binary', 'binary_hex']],
    example: { message: 'sms', impi: '001010123456789', text: 'hello from SimTool', sender: '0600000000' }, danger: 'safe', readOnly: false, docRef: doc('sms'),
  },
  { message: 'sms_flush', components: ['IMS'], category: 'Messaging', label: 'Flush pending SMS', description: 'Flush pending SMS for a user.', params: { impi: req(str('User IMPI.')) }, example: { message: 'sms_flush', impi: '001010123456789' }, danger: 'caution', readOnly: false, docRef: doc('sms_flush') },
  { message: 'mms', components: ['IMS'], category: 'Messaging', label: 'Send MMS', description: 'Send an MMS (jpg, jpeg, png, gif, txt file on the box).', params: { filename: req(str('File on the box.')), from: req(str('Sender number.')), to: req(str('Receiver number.')), sos: bool('Only emergency-registered UEs.', { default: false }) }, example: { message: 'mms', filename: 'image.jpg', from: '0600000000', to: '0600000001' }, danger: 'safe', readOnly: false, docRef: doc('mms') },
  { message: 'mms_server', components: ['IMS'], category: 'Messaging', label: 'MMS server address', description: 'Address of the MMS server (error if not started).', example: { message: 'mms_server' }, danger: 'safe', readOnly: true, docRef: doc('mms_server') },
  {
    message: 'mt_call', components: ['IMS'], category: 'Calls', label: 'Mobile-terminated call', description: 'Call a user. Response: session_id.',
    params: { impi: str('IMPI to call.'), impu: str('IMPU to call.'), contact: str('Contact SIP URI.'), sdp_file: any('SDP content/file.'), caller: str('Force caller IMPU.'), sos: bool('Only emergency-registered UEs.', { default: false }), duration: num('Call duration in s (server hangs up).', { min: 0 }) },
    oneOf: [['impi', 'impu', 'contact']],
    example: { message: 'mt_call', impi: '001010123456789', duration: 10 }, danger: 'safe', readOnly: false, docRef: doc('mt_call'),
  },
  { message: 'dialog_get', components: ['IMS'], category: 'Calls', label: 'Dialogs', description: 'Current dialogs (kept 30 s after stop).', params: { session_id: str('Filter on session id.') }, example: { message: 'dialog_get' }, danger: 'safe', readOnly: true, docRef: doc('dialog_get') },
  {
    message: 'dialog_set', components: ['IMS'], category: 'Calls', label: 'Act on dialog', description: 'answer / stop / hold / downgrade / media ... on a dialog ("*" = latest, "last" = earliest).',
    params: { session_id: req(str('Session id, "*" or "last".')), action: req(str('Action to perform (answer, stop, hold, downgrade, media ...).')), code: int('SIP code / reason cause.'), reason: str('Reason text.'), reason_protocol: str('Reason protocol.'), sdp_file: any('New SDP (MT dialogs).'), media: str('audio, video or text.'), rtp: bool('media action: block (false) or allow RTP.'), rtcp: bool('media action: block (false) or allow RTCP.') },
    example: { message: 'dialog_set', session_id: '*', action: 'stop' }, danger: 'caution', readOnly: false, docRef: doc('dialog_set'),
  },
  {
    message: 'config_set', components: ['IMS'], category: 'IMS config', label: 'Runtime IMS settings',
    description: 'logs, precondition, session_expires, sms_* options, binding_expires, dialog_timeout, custom_headers, 100rel, tcp_* ...',
    params: { logs: obj('Log configuration.'), custom_headers: arr('Replaces custom_headers.', 'object'), sms_retry_delay: int('SMS retry delay.'), sms_expires: int('SMS expiry.'), binding_expires: int('Binding expiry.'), dialog_timeout: int('Dialog timeout.') },
    openParams: true,
    example: { message: 'config_set', logs: { layers: { SIP: { level: 'debug', max_size: 1 } } } },
    danger: 'caution', readOnly: false, docRef: 'lteims 6.5 Common messages / config_set',
    assess: (m) => (Object.keys(m).filter(k => !['message', 'message_id'].includes(k)).every(k => k === 'logs') ? { level: 'safe', reasons: [] } : null),
  },
];

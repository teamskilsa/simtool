// Messages every Amarisoft remote API server implements ("Common messages"
// section of each component's doc). Parameters that only one component takes
// (eNB `stats.rf`, eNB `config_set.cells` ...) are listed on that component.
import type { ApiCommand, ComponentType } from './types';
import { any, bool, int, num, obj, req, str, union, V_CANCEL } from './helpers';

const ALL: ComponentType[] = ['ENB', 'MME', 'IMS', 'UE', 'MBMS', 'LICENSE'];

const DOC: Record<ComponentType, string> = {
  ENB: 'lteenb 10.5',
  MME: 'ltemme 6.5',
  IMS: 'lteims 6.5',
  UE: 'lteue 8.5',
  MBMS: 'ltembmsgw 6.5',
  LICENSE: 'ltelicense 6.5',
};

export const docFor = (c: ComponentType, section: string) => `${DOC[c]} Common messages / ${section}`;

const LOG_LEVELS = ['none', 'error', 'warn', 'info', 'debug'] as const;

export function commonCommands(component: ComponentType): ApiCommand[] {
  const isEnb = component === 'ENB';
  const isUe = component === 'UE';
  const out: ApiCommand[] = [
    {
      message: 'config_get',
      components: ALL,
      category: 'Monitoring',
      label: 'Get configuration',
      description: 'Current configuration: logs, cells (eNB), and component details.',
      example: { message: 'config_get' },
      danger: 'safe',
      readOnly: true,
      docRef: docFor(component, 'config_get'),
    },
    {
      message: 'stats',
      components: ALL,
      category: 'Monitoring',
      label: 'Statistics',
      description: isEnb
        ? 'Cell/CPU/sample statistics. The sampling window is the delay since the previous call on the SAME WebSocket connection.'
        : 'CPU and counter statistics. The server resets statistics on every call, so polling from two connections shortens each other\'s window.',
      params: isEnb || isUe
        ? {
            samples: bool('Include TX/RX sample statistics (like `t spl`).', { default: false }),
            rf: bool('Include TRX CPU usage and TX-RX latency (like `t cpu`).', { default: false }),
            ...(isEnb ? { initial_delay: num('Sampling time in s of the FIRST call on a connection. 0 = first call reports almost nothing.', { min: 0, default: 0.4 }) } : {}),
          }
        : undefined,
      example: isEnb ? { message: 'stats', samples: true, rf: true, initial_delay: 0.7 } : { message: 'stats' },
      danger: 'safe',
      readOnly: true,
      docRef: docFor(component, 'stats'),
      notes: isEnb
        ? 'Per-connection window: the console, the Stats page and the Traffic page each keep their own window.'
        : 'Global window: every `stats` call from any client resets the counters.',
    },
    {
      message: 'log_get',
      components: ALL,
      category: 'Logs',
      label: 'Get logs (long-poll)',
      description: 'Returns buffered logs. Per connection: logs already returned are not sent again on the same connection. The response is held until `min` logs exist or `timeout` elapses.',
      params: {
        min: num('Minimum logs before the response is sent (unless timeout).', { min: 0, default: 1 }),
        max: num('Maximum logs per response.', { min: 1, default: 4096 }),
        timeout: num('Seconds of silence (after at least one log) before responding.', { min: 0, default: 1 }),
        allow_empty: bool('Respond after timeout even when no log is available.', { default: false }),
        rnti: num('Only logs for this RNTI.'),
        ue_id: num('Only logs for this UE_ID.'),
        layers: obj('Layer name -> max level string (none/error/warn/info/debug). If set, unlisted layers are set to none.'),
        short: bool('Only the first line of each log.', { default: false }),
        headers: bool('Include log file headers.'),
        start_timestamp: num('Drop logs older than this (ms since epoch).'),
        end_timestamp: num('Drop logs newer than this (ms since epoch).'),
        max_size: num('Max JSON response size in bytes; forces sending when exceeded.', { min: 1, default: 1048576 }),
      },
      example: { message: 'log_get', min: 1, max: 200, timeout: 1, allow_empty: true },
      danger: 'safe',
      readOnly: true,
      longPoll: true,
      docRef: docFor(component, 'log_get'),
      notes: 'Long-poll: without allow_empty the request can wait indefinitely on a quiet system. The console waits timeout + 30 s before giving up.',
      check: (m) => {
        const issues = [];
        if (m.layers && typeof m.layers === 'object') {
          for (const [k, v] of Object.entries(m.layers)) {
            if (typeof v !== 'string' || !(LOG_LEVELS as readonly string[]).includes(v)) {
              issues.push({ level: 'error' as const, path: `layers.${k}`, text: `level must be one of ${LOG_LEVELS.join(', ')}` });
            }
          }
        }
        if (m.allow_empty !== true && m.min !== 0) {
          issues.push({ level: 'info' as const, path: 'allow_empty', text: 'Without allow_empty the server holds the response until a log arrives.' });
        }
        return issues;
      },
    },
    {
      message: 'log_set',
      components: ALL,
      category: 'Logs',
      label: 'Add log / flush / rotate',
      description: 'Inject a log line, or flush / rotate / cut the log file.',
      params: {
        log: str('Log text to add. If set, layer and level are mandatory.'),
        layer: str('Layer name. Mandatory if log is set.'),
        level: str('Log level. Mandatory if log is set.', { enum: ['error', 'warn', 'info', 'debug'] }),
        dir: str('Direction.', { enum: ['UL', 'DL', 'FROM', 'TO'] }),
        ue_id: num('UE_ID.'),
        flush: bool('Flush the log file.', { default: false }),
        rotate: bool('Force log file rotation.', { default: false }),
        cut: bool('Force log file reset.', { default: false }),
      },
      example: { message: 'log_set', log: 'SimTool marker', layer: 'PROD', level: 'info' },
      presets: [{ label: 'Flush log file', body: { message: 'log_set', flush: true } }],
      danger: 'safe',
      readOnly: false,
      docRef: docFor(component, 'log_set'),
      check: (m) => (typeof m.log === 'string' && (!m.layer || !m.level)
        ? [{ level: 'error', path: 'log', text: 'layer and level are mandatory when log is set' }]
        : []),
      assess: (m) => (m.cut ? { level: 'caution', reasons: ['cut: true resets the log file on the box'] } : null),
    },
    {
      message: 'log_reset',
      components: ALL,
      category: 'Logs',
      label: 'Reset log buffer',
      description: 'Clears the in-memory log buffer. Every client (web GUI, other log_get readers) loses unread logs.',
      example: { message: 'log_reset' },
      danger: 'caution',
      dangerNote: 'Unread logs are discarded for all clients.',
      readOnly: false,
      docRef: docFor(component, 'log_reset'),
    },
    {
      message: 'config_set',
      components: ALL,
      category: 'Logs',
      label: 'Set log configuration',
      description: 'Change log levels at runtime. `logs.layers.<LAYER>` takes level/max_size/key/crypto/payload; use layer name "all" for every layer. Rejected (logs: "locked") when com_log_lock is set.',
      params: {
        logs: obj('Log configuration, same structure as config_get.logs.'),
      },
      openParams: true,
      example: { message: 'config_set', logs: { layers: { PHY: { level: 'debug', max_size: 1, payload: true } } } },
      danger: 'safe',
      readOnly: false,
      docRef: docFor(component, 'config_set'),
    },
    {
      message: 'license',
      components: ALL,
      category: 'Monitoring',
      label: 'License info',
      description: 'License file information: products, user, validity, id, server.',
      example: { message: 'license' },
      danger: 'safe',
      readOnly: true,
      docRef: docFor(component, 'license'),
    },
    {
      message: 'help',
      components: ALL,
      category: 'Monitoring',
      label: 'List messages',
      description: 'Returns `messages` (every message this server accepts) and `events` (registrable events). Use it to diff the live server against this catalogue.',
      example: { message: 'help' },
      danger: 'safe',
      readOnly: true,
      docRef: docFor(component, 'help'),
    },
    {
      message: 'cancel',
      components: ALL,
      category: 'System',
      label: 'Cancel pending requests',
      description: 'Cancels pending (delayed, looping or long-poll) requests. With group_id only that group; without it EVERY pending message on the server.',
      params: { group_id: int('Cancel only messages sent with this group_id.') },
      example: { message: 'cancel', group_id: 1 },
      danger: 'caution',
      dangerNote: 'Without group_id every pending request is cancelled, including other clients\' scheduled messages.',
      readOnly: false,
      minVersion: V_CANCEL,
      docRef: docFor(component, 'cancel'),
      assess: (m) => (m.group_id === undefined
        ? { level: 'caution', reasons: ['No group_id: all pending requests on the server are cancelled.'] }
        : null),
    },
    {
      message: 'quit',
      components: ALL,
      category: 'System',
      label: 'Terminate process',
      description: 'Terminates the server PROCESS (lteenb/ltemme/...). It does not just close this connection. The service stays down until restarted (e.g. `service lte restart`).',
      example: { message: 'quit' },
      danger: 'destructive',
      dangerNote: 'Stops the software component on the box. All UEs drop; nothing restarts it automatically.',
      readOnly: false,
      docRef: docFor(component, 'quit'),
    },
  ];

  // `register` exists on components that generate events.
  const events: Partial<Record<ComponentType, string[]>> = {
    ENB: ['ue_measurement_report', 'srs', 'pusch', 'npusch', 'carrier_sense'],
    MME: ['registration', 'registration_reject', 'non_ip_data', 'generic_nas_transport', '5gs_nas_transport', 'eps_bearer_notification', 'qos_flow_notification'],
    IMS: ['users_update', 'sms', 'dialog'],
    UE: ['ue_update', 'sms', 'sms_status_report', 'non_ip_data', 'pws_msg', 'measurement_report', 'srs', 'pdsch', 'npdsch'],
  };
  const ev = events[component];
  if (ev) {
    out.push({
      message: 'register',
      components: [component],
      category: 'System',
      label: 'Register for events',
      description: `Subscribe this connection to server events: ${ev.join(', ')}. Events arrive as {message: "<event>"} without message_id.`,
      params: {
        register: union(['string', 'array'], `Event name(s): ${ev.join(', ')}.`, { items: 'string', enum: ev }),
        unregister: union(['string', 'array'], 'Event name(s) to stop receiving.', { items: 'string', enum: ev }),
      },
      oneOf: [['register', 'unregister']],
      example: { message: 'register', register: [ev[0]] },
      danger: 'safe',
      readOnly: true,
      docRef: docFor(component, 'register'),
      notes: ['srs', 'pusch', 'npusch', 'pdsch', 'npdsch'].some(e => ev.includes(e))
        ? 'Signal events (srs/pusch/pdsch...) are binary frames; the console shows their JSON header only.'
        : undefined,
      check: (m) => {
        const both = m.register !== undefined && m.unregister !== undefined;
        return both ? [{ level: 'error', path: '', text: 'Cannot register and unregister in the same message' }] : [];
      },
    });
  }

  if (component === 'MME' || component === 'IMS') {
    out.push({
      message: 'ipsec',
      components: [component],
      category: 'Monitoring',
      label: 'IPsec SAs',
      description: 'Lists IPsec security associations (ePDG / IMS). Response includes keys in hex; treat as sensitive.',
      example: { message: 'ipsec' },
      danger: 'safe',
      readOnly: true,
      docRef: docFor(component, 'ipsec'),
    });
  }
  return out;
}

/** Request fields any message may carry (lteenb 10.1 "Request"). */
export const COMMON_REQUEST_PARAMS = {
  message: req(str('Message name.')),
  message_id: any('Echoed in the response. The console assigns one when absent.'),
  start_time: num('Delay (s) before executing. Absolute clock when absolute_time is true.', { min: 0 }),
  absolute_time: bool('Interpret start_time as absolute (use `time` from any response).', { default: false }),
  standalone: bool('Keep running if this WebSocket disconnects.', { default: false }),
  loop_count: int('Repeat the message this many times.', { min: 0, max: 1000000, default: 0 }),
  loop_delay: num('Seconds between repetitions. Mandatory when loop_count > 0.', { min: 0.1, max: 86400 }),
  group_id: int('Group for the cancel message.', { minVersion: V_CANCEL }),
} as const;


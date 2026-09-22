// MBMS gateway (ltembmsgw) remote API catalogue.
// Source: ltembmsgw.html 2026-09-11, section 6.6.
import type { ApiCommand } from '../common/types';
import { int, req } from '../common/helpers';

export const mbmsCommands: ApiCommand[] = [
  { message: 'service_start', components: ['MBMS'], category: 'Services', label: 'Start service', description: 'Start an MBMS service defined in the MBMSGW config.', params: { service_id: req(int('Service identifier.', { min: 0 })) }, example: { message: 'service_start', service_id: 1 }, danger: 'caution', readOnly: false, docRef: 'ltembmsgw 6.6 LTE messages / service_start' },
  { message: 'service_stop', components: ['MBMS'], category: 'Services', label: 'Stop service', description: 'Stop an MBMS service.', params: { service_id: req(int('Service identifier.', { min: 0 })) }, example: { message: 'service_stop', service_id: 1 }, danger: 'caution', dangerNote: 'Receivers of this service lose the broadcast. Restore with service_start.', readOnly: false, docRef: 'ltembmsgw 6.6 LTE messages / service_stop' },
];

// License server (ltelicense) remote API catalogue.
// Source: ltelicense.html 2026-09-11, section 6.6. Default port 9006.
import type { ApiCommand } from '../common/types';
import { bool, req, str } from '../common/helpers';

const doc = (m: string) => `ltelicense 6.6 License messages / ${m}`;

export const licenseCommands: ApiCommand[] = [
  {
    message: 'list', components: ['LICENSE'], category: 'Licenses', label: 'License states',
    description: 'licenses[]: uid, products, origin, tag, max, version, connections[] (product, name, address, lifetime, shared_params), shared_params (since 2026-03-13).',
    params: { tag: str('Only licenses with this tag.'), full: bool('Include all license file properties.', { default: false }) },
    example: { message: 'list' }, danger: 'safe', readOnly: true, docRef: doc('list'),
  },
  { message: 'reload', components: ['LICENSE'], category: 'Licenses', label: 'Reload licenses', description: 'Force license reload; config file changes are applied.', example: { message: 'reload' }, danger: 'caution', dangerNote: 'A changed or missing license file can drop connected components (lteenb/ltemme stop when they lose their license).', readOnly: false, docRef: doc('reload') },
  { message: 'message', components: ['LICENSE'], category: 'Licenses', label: 'Broadcast message', description: 'Show a text in the monitor window of every connected component.', params: { text: req(str('Message text.')) }, example: { message: 'message', text: 'SimTool test starting' }, danger: 'safe', readOnly: false, docRef: doc('message') },
];

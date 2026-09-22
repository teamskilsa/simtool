// Small builders so the catalogue files read like the docs they come from.
import type { ParamSpec, ParamType } from './types';

type Extra = Omit<ParamSpec, 'type' | 'help'>;

const mk = (type: ParamType | ParamType[]) => (help: string, extra: Extra = {}): ParamSpec => ({ type, help, ...extra });

export const int = mk('integer');
export const num = mk('number');
export const str = mk('string');
export const bool = mk('boolean');
export const obj = mk('object');
export const arr = (help: string, items?: ParamType, extra: Extra = {}): ParamSpec => ({ type: 'array', help, items, ...extra });
export const any = mk('any');
export const union = (types: ParamType[], help: string, extra: Extra = {}): ParamSpec => ({ type: types, help, ...extra });

/** Mark a spec as mandatory. */
export const req = (spec: ParamSpec): ParamSpec => ({ ...spec, required: true });

export const IMSI_PATTERN = '^[0-9]{6,15}$';
export const IMEI_PATTERN = '^[0-9]{14,15}$';

/** Release in which `cancel`, `group_id` and the `cancel` response flag appeared. */
export const V_CANCEL = '2026-06-12';
/** Release documented by this catalogue. */
export const CATALOGUE_VERSION = '2026-09-11';

// Parameters shared by many MME messages that address one subscriber.
export const imsiParam = (help = 'UE IMSI. Shall be present if nai is absent.') =>
  str(help, { pattern: IMSI_PATTERN });
export const naiParam = () => str('Network specific identifier-based SUPI (5GC only). Shall be present if imsi is absent.');
export const imeiParam = () => str('UE IMEI, 14 or 15 digits. Required if multi_sim is set to true.', { pattern: IMEI_PATTERN });
export const n3gppParam = () => bool('Set to true for a non-3GPP UE connected to 5GC.', { default: false });

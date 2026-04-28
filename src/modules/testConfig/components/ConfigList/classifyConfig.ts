// Classify a config item as either a "main" Amarisoft config (enb.cfg, gnb.cfg,
// mme.cfg) or an "auxiliary" dependency file (drb*.cfg, sib*.asn, *.db).
//
// Used by the configurations list to separate the two via tabs / filters and
// to show a per-config RAT badge.
import { tryParseAmarisoftConfig, detectConfigType } from '../ConfigBuilder';
import type { BuilderConfigType } from '../ConfigBuilder';
import type { ConfigItem } from '../../types';

export type ConfigKind = 'main' | 'auxiliary';

export interface ConfigClassification {
  kind: ConfigKind;
  /** RAT type for main configs; for auxiliary files this is undefined */
  rat?: BuilderConfigType;
  /** Display label for auxiliary files (e.g. "DRB", "SIB", "ASN", "DB") */
  auxKind?: 'drb' | 'sib' | 'asn' | 'db' | 'include' | 'other';
}

/** Quick filename-based check — auxiliary files don't need full parsing */
function quickAuxClassify(name: string): ConfigClassification | null {
  const n = name.toLowerCase();
  if (/^drb[._-]/i.test(name) || /\bdrb[._-]?nr\.cfg$/i.test(n) || /\bdrb[._-]?brh\.cfg$/i.test(n) || n === 'drb.cfg' || /\bdrb_nb\.cfg$/i.test(n)) {
    return { kind: 'auxiliary', auxKind: 'drb' };
  }
  if (/^sib/i.test(name) && /\.asn[a-z0-9]*$/i.test(n)) {
    return { kind: 'auxiliary', auxKind: 'sib' };
  }
  if (/\.asn[a-z0-9]*$/i.test(n)) {
    return { kind: 'auxiliary', auxKind: 'asn' };
  }
  if (/\.db$/i.test(n)) {
    return { kind: 'auxiliary', auxKind: 'db' };
  }
  return null;
}

/**
 * Classify a single config. Tries fast filename heuristics first; for files
 * that look like main configs (enb*.cfg / gnb*.cfg / mme*.cfg / etc) it
 * detects RAT via the parser.
 *
 * Pure & cheap to memoize — no I/O, no heavy state.
 */
export function classifyConfig(config: ConfigItem): ConfigClassification {
  const aux = quickAuxClassify(config.name);
  if (aux) return aux;

  // Main config: detect RAT
  const ast = tryParseAmarisoftConfig(config.content || '');
  const rat = detectConfigType(ast, config.name);
  if (rat === 'unknown') {
    // Couldn't tell — treat as auxiliary 'other' so it doesn't pollute the
    // main list with files we don't understand.
    return { kind: 'auxiliary', auxKind: 'other' };
  }
  return { kind: 'main', rat };
}

/** Convenience: classify many configs (caller can memoize). */
export function classifyAll(configs: ConfigItem[]): Map<string, ConfigClassification> {
  const map = new Map<string, ConfigClassification>();
  for (const c of configs) map.set(c.id, classifyConfig(c));
  return map;
}

/** Filter chip metadata for RAT — shared between list filter UI and config item badge. */
export const RAT_BADGE: Record<BuilderConfigType, { label: string; color: string }> = {
  nr:    { label: 'NR (5G)',    color: 'bg-purple-50 text-purple-700 border-purple-200' },
  lte:   { label: 'LTE',        color: 'bg-blue-50 text-blue-700 border-blue-200' },
  nsa:   { label: 'NSA',        color: 'bg-pink-50 text-pink-700 border-pink-200' },
  nbiot: { label: 'NB-IoT',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  catm:  { label: 'CAT-M',      color: 'bg-amber-50 text-amber-700 border-amber-200' },
  core:  { label: 'Core (MME)', color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export const AUX_BADGE: Record<NonNullable<ConfigClassification['auxKind']>, { label: string; color: string }> = {
  drb:     { label: 'DRB',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
  sib:     { label: 'SIB',     color: 'bg-amber-50 text-amber-700 border-amber-200' },
  asn:     { label: 'ASN',     color: 'bg-purple-50 text-purple-700 border-purple-200' },
  db:      { label: 'DB',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  include: { label: 'INCLUDE', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  other:   { label: 'AUX',     color: 'bg-gray-50 text-gray-700 border-gray-200' },
};

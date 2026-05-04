// modules/ueSim/services/applyService.ts
//
// Diffs two MaterializedProfiles and classifies each change as hot (can be
// applied via Remote API config_set without restarting lteue) or cold
// (requires the lteue process to restart with the new ue.cfg).
//
// Hot-applyable keys (per Amarisoft docs):
//   - tx_gain, rx_gain
//   - log_options (per-layer levels)
//   - per-cell channel_dl/channel_ul scalar params (doppler, noise floor,
//     ul_power_attenuation) when channel_sim is already on
//   - sim_events scheduling (can be added/removed at runtime)
//   - ue_modify_bearer parameters
//
// Cold (require restart):
//   - cell_groups structure (group_type, cells count, bandwidth, dl_earfcn,
//     n_antenna_dl, scs)
//   - ue_list count or imsi/K/sim_algo (USIM identity)
//   - rf_driver (name, args)
//   - com_addr, com_auth, com_password
//   - multi_ue (per cell group)
//   - channel_sim master switch (toggling on/off requires restart)
//   - User Plane mode change (sim ↔ tun ↔ remote)
//
// The classifier is conservative: when in doubt, classify as cold.

import {
  ApplyDiff,
  ChangeKind,
  DiffEntry,
  MaterializedProfile,
} from '../types';

// ────────────────────────────────────────────────────────────────────────────
// Path-based hot/cold rules
// ────────────────────────────────────────────────────────────────────────────

// Keys that can change at runtime via config_set. Match by path prefix.
const HOT_PATH_PREFIXES = [
  'settings.tx_gain',
  'settings.rx_gain',
  'settings.log_layers',
  'channel.per_cell.', // scalar tweaks while channel_sim already on
  'channel.mobility.', // ue_move remote API supports live mobility update
  'traffic.templates',
  'traffic.assignments',
  'traffic.server',
  'traffic.default_address',
];

// Anything matching these is unconditionally cold even if a prefix above
// would otherwise match.
const COLD_PATH_PATTERNS: RegExp[] = [
  /^cell\./,                        // any cell-group / cell change
  /^subscriber\.ues\b/,              // adding/removing UEs or changing IMSI/K
  /^subscriber\.defaults\b/,         // defaults shift implies new UEs
  /^userPlane\.mode\b/,              // mode change
  /^userPlane\.tun_setup_script/,    // process needs to re-source
  /^userPlane\.rue_addr/,
  /^channel\.channel_sim\b/,         // master toggle
  /^settings\.com_addr/,
  /^settings\.com_auth/,
  /^settings\.com_password/,
  /^settings\.rf_driver/,
  /^settings\.cpu_core_list/,
];

function classify(path: string): ChangeKind {
  for (const re of COLD_PATH_PATTERNS) {
    if (re.test(path)) return 'cold';
  }
  for (const prefix of HOT_PATH_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + '.') || path.startsWith(prefix + '[')) {
      return 'hot';
    }
  }
  return 'cold';
}

// ────────────────────────────────────────────────────────────────────────────
// Deep diff
// ────────────────────────────────────────────────────────────────────────────

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function diffNode(
  before: unknown,
  after: unknown,
  path: string,
  out: DiffEntry[],
  section: keyof MaterializedProfile,
): void {
  if (before === after) return;
  // Both arrays — diff by index, classify the array root if length differs
  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    for (let i = 0; i < max; i++) {
      diffNode(before[i], after[i], `${path}[${i}]`, out, section);
    }
    return;
  }
  if (isPlainObj(before) && isPlainObj(after)) {
    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      diffNode(before[k], after[k], path ? `${path}.${k}` : k, out, section);
    }
    return;
  }
  // Leaf — emit
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    out.push({
      section,
      path,
      before,
      after,
      kind: classify(path),
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export function diffProfiles(
  before: MaterializedProfile | null,
  after: MaterializedProfile,
): ApplyDiff {
  // Null baseline → "first apply". We could emit one synthetic
  // "section is brand new" entry per section, but the caller already
  // surfaces a "first apply — full cfg" badge, and the user mostly
  // wants to see the same per-key change list they'd get on a normal
  // apply. So we treat null as an empty per-section object and let
  // diffNode walk the after-side keys naturally — every leaf shows up
  // as `∅ → <value>`, which renders cleanly in summarizeDiff.
  const entries: DiffEntry[] = [];
  const sections: Array<keyof MaterializedProfile> =
    ['cell', 'subscriber', 'traffic', 'userPlane', 'channel', 'settings'];
  for (const s of sections) {
    const beforeSection: unknown = before ? before[s] : {};
    diffNode(beforeSection, after[s], s, entries, s);
  }
  return {
    entries,
    hasHot: entries.some(e => e.kind === 'hot'),
    hasCold: entries.some(e => e.kind === 'cold'),
  };
}

/**
 * Group diff entries by tab + format for human-readable presentation in
 * the Apply confirmation dialog.
 */
export function summarizeDiff(diff: ApplyDiff): Array<{ section: keyof MaterializedProfile; lines: string[] }> {
  const grouped = new Map<keyof MaterializedProfile, string[]>();
  for (const e of diff.entries) {
    const arr = grouped.get(e.section) ?? [];
    arr.push(`[${e.kind.toUpperCase()}] ${e.path}: ${formatVal(e.before)} → ${formatVal(e.after)}`);
    grouped.set(e.section, arr);
  }
  return Array.from(grouped.entries()).map(([section, lines]) => ({ section, lines }));
}

function formatVal(v: unknown): string {
  if (v === undefined) return '∅';
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  return String(v);
}

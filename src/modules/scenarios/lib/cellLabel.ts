// Human labels for cells, params and run verdicts — shared by the Run panel,
// the live cell map and the history detail. Pure (no Node, no React) so both
// the client components and the editor can import it.
import type { CellInfo, MetricRecord, MobilityScenario, RunView, Step } from '../types';

// ─── Frequencies ────────────────────────────────────────────────────────────
/** NR-ARFCN → MHz on the 3GPP 38.104 global frequency raster. */
export function nrArfcnMhz(n?: number): number | undefined {
  if (!Number.isFinite(n) || (n as number) <= 0) return undefined;
  const N = n as number;
  if (N < 600_000) return 0.005 * N;
  if (N < 2_016_667) return 3000 + 0.015 * (N - 600_000);
  return 24_250.08 + 0.06 * (N - 2_016_667);
}

/** E-UTRA band → (lowest DL frequency MHz, first DL EARFCN). 36.101 table 5.7.3-1. */
const EUTRA_DL: Record<number, [number, number]> = {
  1: [2110, 0], 2: [1930, 600], 3: [1805, 1200], 4: [2110, 1950], 5: [869, 2400],
  7: [2620, 2750], 8: [925, 3450], 11: [1475.9, 3800], 12: [729, 5010], 13: [746, 5180],
  14: [758, 5280], 17: [734, 5730], 18: [860, 5850], 19: [875, 6000], 20: [791, 6150],
  21: [1495.9, 6450], 25: [1930, 8040], 26: [859, 8690], 28: [758, 9210], 29: [717, 9660],
  30: [2350, 9770], 32: [1452, 9920], 38: [2570, 37_750], 39: [1880, 38_250], 40: [2300, 38_650],
  41: [2496, 39_650], 42: [3400, 41_590], 43: [3600, 43_590], 46: [5150, 45_590], 48: [3550, 55_240],
  66: [2110, 66_436], 71: [617, 68_586],
};

export function eutraEarfcnMhz(earfcn?: number, band?: number): number | undefined {
  if (!Number.isFinite(earfcn) || !band) return undefined;
  const row = EUTRA_DL[band];
  return row ? row[0] + 0.1 * ((earfcn as number) - row[1]) : undefined;
}

/** Downlink centre frequency of a cell, in MHz, when it can be derived. */
export function cellFreqMhz(c: CellInfo): number | undefined {
  return c.rat === 'nr' ? nrArfcnMhz(c.earfcn ?? c.ssb) : eutraEarfcnMhz(c.earfcn, c.band);
}

/** "n78" / "B7" / "NR" — what a test engineer calls the band. */
export function cellBandLabel(c: CellInfo): string {
  if (c.band) return c.rat === 'nr' ? `n${c.band}` : `B${c.band}`;
  return c.rat.toUpperCase();
}

/** Whole MHz unless the raster really lands between them — 3340.02 reads 3340. */
const fmtMhz = (mhz: number) => (Math.abs(mhz - Math.round(mhz)) < 0.2 ? String(Math.round(mhz)) : mhz.toFixed(1));

/** "n78 3340 MHz" — band and frequency, falling back to the raw ARFCN. */
export function cellRadioLabel(c: CellInfo): string {
  const mhz = cellFreqMhz(c);
  if (mhz !== undefined) return `${cellBandLabel(c)} ${fmtMhz(mhz)} MHz`;
  return `${cellBandLabel(c)} ${c.rat === 'nr' ? 'SSB' : 'EARFCN'} ${c.rat === 'nr' ? c.ssb ?? c.earfcn : c.earfcn}`;
}

/** "Cell 4 — n78 3580 MHz": the label used in every cell picker and tile. */
export function cellLabel(c: CellInfo): string {
  return `Cell ${c.id} — ${cellRadioLabel(c)}`;
}

// ─── Groups ─────────────────────────────────────────────────────────────────
/** Cells that aggregate with each other (scell_list is symmetric in practice),
 *  as connected components. Two groups of three is the live 6-cell layout. */
export function cellGroups(cells: CellInfo[]): CellInfo[][] {
  const byId = new Map(cells.map(c => [c.id, c]));
  const seen = new Set<number>();
  const groups: CellInfo[][] = [];
  const neighbours = (c: CellInfo) => [
    ...c.scells,
    ...cells.filter(o => o.scells.includes(c.id)).map(o => o.id),
  ];
  for (const c of cells) {
    if (seen.has(c.id)) continue;
    const stack = [c.id];
    const group: CellInfo[] = [];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const cell = byId.get(id);
      if (!cell) continue;
      group.push(cell);
      for (const n of neighbours(cell)) if (!seen.has(n) && byId.has(n)) stack.push(n);
    }
    groups.push(group.sort((a, b) => a.id - b.id));
  }
  return groups.sort((a, b) => a[0].id - b[0].id);
}

export const groupName = (i: number) => String.fromCharCode(65 + i);

// ─── Params ─────────────────────────────────────────────────────────────────
export type ParamKind = 'number' | 'ms' | 'db' | 'boolean' | 'cellIndexList' | 'json';

export interface ParamSpec {
  key: string;
  kind: ParamKind;
  label: string;
  /** Plain-language meaning, from the table below or from the scenario text. */
  help?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** cellIndexList: how many entries the scenario expects. */
  length?: number;
}

/** Meanings for the keys the shipped scenarios use, in customer language. */
const KNOWN: Record<string, Partial<ParamSpec>> = {
  iterations: { label: 'Iterations', help: 'How many times the loop repeats — one handover (or cycle) per iteration.', min: 1, max: 1000 },
  pair: { label: 'Cell pair', help: 'The two cells the UE moves between.', length: 2 },
  carriers: { label: 'Carriers per group', help: 'Carriers each group should end up aggregating, PCell included.', min: 1, max: 8 },
  periodMs: { label: 'Period', help: 'Wait between handovers.' },
  settleMs: { label: 'Settle time', help: 'Wait after a hop before checking or moving on.' },
  dwellMs: { label: 'Dwell per step', help: 'Time spent on each cell (or each gain step).' },
  idleMs: { label: 'Idle time', help: 'How long the UE is left released before it must come back.' },
  sibWaitMs: { label: 'SIB wait', help: 'How long the cell stays barred before it is unbarred again.' },
  holdMs: { label: 'Hold time', help: 'The condition has to stay true this long to count.' },
  hoTimeoutMs: { label: 'Handover timeout', help: 'Longest wait for the new PCell before the step fails.' },
  caTimeoutMs: { label: 'Carrier rebuild timeout', help: 'Longest wait for the secondary carriers to come back.' },
  reconnectTimeoutMs: { label: 'Reconnect timeout', help: 'Longest wait for the UE to come back after a release.' },
  reestTimeoutMs: { label: 'Re-establishment timeout', help: 'Longest wait for the UE to recover after a radio link failure.' },
  reconfTimeoutMs: { label: 'Reconfiguration timeout', help: 'Longest wait for the SCell reconfiguration to take effect.' },
  floorDb: { label: 'Gain floor', help: 'Lowest gain the ramp goes down to.', min: -200, max: 0 },
  stepDb: { label: 'Gain step', help: 'How much the gain changes per tick.', min: 0.5, max: 50 },
};

const humanize = (k: string) =>
  k.replace(/Ms$/, '').replace(/Db$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();

/** A sentence of the scenario description that explains this param, if any. */
export function helpFromDescription(description: string, key: string): string | undefined {
  const parts = String(description ?? '').split(/(?<=\.)\s+|;\s+/).map(s => s.trim()).filter(Boolean);
  const hit = parts.find(p => new RegExp(`\\bparams\\.${key}\\b`).test(p));
  return hit ? hit.replace(/^[a-z]/, c => c.toUpperCase()) : undefined;
}

/** How to render one param: from its key, then its value's shape. */
export function paramSpec(key: string, value: unknown, description = '', cellCount = 0): ParamSpec {
  const known = KNOWN[key] ?? {};
  const base: ParamSpec = {
    key,
    kind: 'json',
    label: known.label ?? humanize(key),
    help: helpFromDescription(description, key) ?? known.help,
    min: known.min, max: known.max, step: known.step, length: known.length,
  };
  if (typeof value === 'boolean') return { ...base, kind: 'boolean' };
  if (typeof value === 'number') {
    if (/Ms$/.test(key)) return { ...base, kind: 'ms', unit: 'ms', step: 100, min: base.min ?? 0 };
    if (/Db$/.test(key)) return { ...base, kind: 'db', unit: 'dB', step: 1 };
    return { ...base, kind: 'number', step: 1 };
  }
  // A short array of small whole numbers is a list of 0-based cell indexes.
  if (Array.isArray(value) && value.length > 0 && value.length <= 6
    && value.every(v => Number.isInteger(v) && (v as number) >= 0 && (cellCount ? (v as number) < Math.max(cellCount, 32) : (v as number) < 32))) {
    return { ...base, kind: 'cellIndexList', length: base.length ?? value.length };
  }
  return base;
}

export const paramSpecs = (scenario: MobilityScenario | null, cellCount = 0): ParamSpec[] =>
  Object.entries(scenario?.params ?? {}).map(([k, v]) => paramSpec(k, v, scenario?.description ?? '', cellCount));

// ─── "What will happen" ─────────────────────────────────────────────────────
const asNumber = (v: unknown, params: Record<string, unknown>): number | undefined => {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return undefined;
  const m = /^\$\{\s*params\.([A-Za-z_]\w*)\s*\}$/.exec(v);
  const raw = m ? params[m[1]] : Number(v);
  return Number.isFinite(Number(raw)) ? Number(raw) : undefined;
};

/** Rough wall-clock estimate: waits and dwells dominate; each action/assert
 *  is charged a typical round trip rather than its timeout. */
export function estimateMs(steps: Step[], params: Record<string, unknown>): number {
  let total = 0;
  for (const s of steps) {
    switch (s.type) {
      case 'wait': total += asNumber(s.ms, params) ?? 0; break;
      case 'assert': total += 400; break;
      case 'action': total += 200; break;
      case 'traffic': total += 300; break;
      case 'ramp': {
        const dwell = asNumber(s.dwellMs, params) ?? 0;
        const step = asNumber(s.stepDb, params) || 1;
        const span = Math.max(...s.cells.map(c => Math.abs((asNumber(c.to, params) ?? 0) - (asNumber(c.from, params) ?? 0))), 0);
        total += dwell * Math.max(1, Math.ceil(span / step));
        break;
      }
      case 'loop': {
        const n = asNumber(s.count, params) ?? s.maxIterations ?? 1;
        total += n * estimateMs(s.steps, params);
        break;
      }
    }
  }
  return total;
}

export function humanDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'a few seconds';
  if (ms < 45_000) return `${Math.max(5, Math.round(ms / 5000) * 5)} s`;
  const min = ms / 60_000;
  return min < 10 ? `${min.toFixed(min < 2 ? 1 : 0)} min` : `${Math.round(min)} min`;
}

/** One line telling the customer what pressing Run does. */
export function runSummary(scenario: MobilityScenario | null, params: Record<string, unknown>, cells: CellInfo[]): string {
  if (!scenario) return 'Pick a scenario.';
  const est = humanDuration(estimateMs(scenario.steps, params));
  const iterations = Number(params.iterations);
  const pair = Array.isArray(params.pair) ? (params.pair as number[]) : null;
  const name = (idx: number) => {
    const c = cells[idx];
    return c ? `cell ${c.id}` : `cell index ${idx}`;
  };
  if (pair && pair.length === 2 && Number.isFinite(iterations)) {
    const carriers = Number(params.carriers);
    const what = Number.isFinite(carriers) && carriers > 1
      ? `${iterations} ${carriers}-carrier group handovers between ${name(pair[0])} and ${name(pair[1])}`
      : `${iterations} handovers between ${name(pair[0])} and ${name(pair[1])}`;
    return `${what}, ~${est}.`;
  }
  if (Number.isFinite(iterations)) return `${iterations} × ${scenario.name.toLowerCase()}, ~${est}.`;
  return `${scenario.name}: ${scenario.steps.length} steps, ~${est}.`;
}

// ─── Verdict ────────────────────────────────────────────────────────────────
export interface MetricStat { name: string; unit: string; n: number; min: number; max: number; avg: number }

export function statsOf(metrics: MetricRecord[]): MetricStat[] {
  const by = new Map<string, { unit: string; values: number[] }>();
  for (const m of metrics) {
    const e = by.get(m.name) ?? { unit: m.unit, values: [] };
    e.values.push(m.value);
    by.set(m.name, e);
  }
  return [...by.entries()].map(([name, { unit, values }]) => ({
    name, unit, n: values.length,
    min: Math.min(...values), max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
  }));
}

export const statOf = (metrics: MetricRecord[], name: string) => statsOf(metrics).find(s => s.name === name);

/** "4/4 handovers passed, 523 ms average, carriers rebuilt in 7 ms".
 *  A run that did not pass leads with why, so a green-looking assert count can
 *  never be mistaken for a green run. */
export function verdictLine(run: Pick<RunView, 'metrics' | 'steps' | 'asserts' | 'state' | 'error'>): string {
  const parts: string[] = [];
  const ho = statOf(run.metrics, 'ho_complete_ms');
  const ca = statOf(run.metrics, 'ca_rebuild_ms');
  const attempted = run.steps.filter(s => s.type === 'action' && /handover|hand over|→ cell/i.test(s.label) && s.status !== 'skipped').length;

  if (run.state !== 'passed') {
    const failedStep = run.steps.find(s => s.status === 'failed');
    const why = run.error ?? (failedStep ? `${failedStep.label}${failedStep.detail ? ` — ${failedStep.detail}` : ''}` : '');
    parts.push(run.state === 'aborted' ? `Stopped${why ? `: ${why}` : ''}`
      : run.state === 'inconclusive' ? `Inconclusive${(run as { inconclusive?: string }).inconclusive ? `: ${(run as { inconclusive?: string }).inconclusive}` : ''}`
        : `Failed${why ? `: ${why}` : ''}`);
  }
  if (ho) {
    parts.push(`${ho.n}/${Math.max(attempted, ho.n)} handovers passed`);
    parts.push(`${Math.round(ho.avg)} ms average`);
  } else if (run.asserts.total) {
    parts.push(`${run.asserts.passed}/${run.asserts.total} checks passed`);
  }
  if (ca) parts.push(`carriers rebuilt in ${Math.round(ca.avg)} ms`);
  if (run.asserts.failed) parts.push(`${run.asserts.failed} check${run.asserts.failed === 1 ? '' : 's'} failed`);
  if (!parts.length) parts.push(run.state);
  return `${parts.join(', ')}.`;
}

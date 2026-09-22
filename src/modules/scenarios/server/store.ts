// File storage for Mobility Scenarios and their runs:
//   data/scenarios/<id>.json       — the library (seeded from ../seeds on first use)
//   data/scenario-runs/<runId>.json — one result per run
//
// The configs storage adapter (src/lib/storage) is typed around StoredConfig
// and its module buckets, so it isn't a fit for arbitrary JSON documents; this
// reuses its base path (storageConfig.basePath → <cwd>/data or
// NEXT_PUBLIC_STORAGE_PATH) so everything lands in the same data root.
import fs from 'fs/promises';
import path from 'path';
import { storageConfig } from '@/lib/storage/config';
import type { MobilityScenario, RunSummary, RunView } from '../types';
import { ID_RE, validateScenario } from '../lib/validate';
import { SEED_SCENARIOS } from '../seeds';

const base = () => storageConfig?.basePath || path.join(process.cwd(), 'data');
export const scenariosDir = () => path.join(base(), 'scenarios');
export const runsDir = () => path.join(base(), 'scenario-runs');
const SEED_MARKER = '.seeded';

const RUN_ID_RE = /^[a-z0-9-]{6,64}$/;

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

/** Write any seed that isn't on disk yet. A seed the user deleted stays deleted
 *  (tracked in .seeded) until "Restore built-ins". */
export async function ensureSeeds(force = false) {
  const dir = scenariosDir();
  await fs.mkdir(dir, { recursive: true });
  let seeded: string[] = [];
  try { seeded = JSON.parse(await fs.readFile(path.join(dir, SEED_MARKER), 'utf8')); } catch { /* first run */ }
  for (const s of SEED_SCENARIOS) {
    const file = path.join(dir, `${s.id}.json`);
    const exists = await fs.access(file).then(() => true, () => false);
    if (force || (!exists && !seeded.includes(s.id))) {
      await writeJson(file, { ...s, builtin: true, updatedAt: new Date().toISOString() });
    }
    if (!seeded.includes(s.id)) seeded.push(s.id);
  }
  await writeJson(path.join(dir, SEED_MARKER), seeded);
}

export async function listScenarios(): Promise<MobilityScenario[]> {
  await ensureSeeds();
  const files = (await fs.readdir(scenariosDir())).filter(f => f.endsWith('.json'));
  const out: MobilityScenario[] = [];
  for (const f of files) {
    try { out.push(JSON.parse(await fs.readFile(path.join(scenariosDir(), f), 'utf8'))); } catch { /* skip corrupt file */ }
  }
  return out.sort((a, b) => (Number(!!b.builtin) - Number(!!a.builtin)) || a.name.localeCompare(b.name));
}

export async function getScenario(id: string): Promise<MobilityScenario | null> {
  if (!ID_RE.test(id)) return null;
  await ensureSeeds();
  try { return JSON.parse(await fs.readFile(path.join(scenariosDir(), `${id}.json`), 'utf8')); } catch { return null; }
}

export async function saveScenario(s: MobilityScenario) {
  const issues = validateScenario(s).filter(i => i.level === 'error');
  if (issues.length) throw Object.assign(new Error(`Invalid scenario: ${issues[0].path} ${issues[0].msg}`), { issues });
  const doc = { ...s, updatedAt: new Date().toISOString() };
  await writeJson(path.join(scenariosDir(), `${s.id}.json`), doc);
  return doc;
}

export async function deleteScenario(id: string) {
  if (!ID_RE.test(id)) throw new Error('bad id');
  await fs.unlink(path.join(scenariosDir(), `${id}.json`));
}

export async function restoreBuiltin(id?: string) {
  if (!id) return ensureSeeds(true);
  const seed = SEED_SCENARIOS.find(s => s.id === id);
  if (!seed) throw new Error(`${id} is not a built-in scenario`);
  return writeJson(path.join(scenariosDir(), `${id}.json`), { ...seed, builtin: true, updatedAt: new Date().toISOString() });
}

// ─── Runs ───────────────────────────────────────────────────────────────────
export async function saveRun(run: RunView) {
  await writeJson(path.join(runsDir(), `${run.id}.json`), run);
}

export async function getRun(id: string): Promise<RunView | null> {
  if (!RUN_ID_RE.test(id)) return null;
  try { return JSON.parse(await fs.readFile(path.join(runsDir(), `${id}.json`), 'utf8')); } catch { return null; }
}

export const summarize = (r: RunView): RunSummary => ({
  id: r.id, scenarioId: r.scenarioId, scenarioName: r.scenarioName, host: r.host, systemName: r.systemName,
  imsi: r.imsi, phoneSerial: r.phoneSerial, state: r.state, startedAt: r.startedAt, endedAt: r.endedAt,
  asserts: r.asserts, error: r.error, linkedTest: r.linkedTest,
});

export async function listRuns(filter?: { scenarioId?: string; linkedTestId?: string; limit?: number }): Promise<RunSummary[]> {
  let files: string[] = [];
  try { files = (await fs.readdir(runsDir())).filter(f => f.endsWith('.json')); } catch { return []; }
  const out: RunSummary[] = [];
  for (const f of files) {
    try {
      const r: RunView = JSON.parse(await fs.readFile(path.join(runsDir(), f), 'utf8'));
      if (filter?.scenarioId && r.scenarioId !== filter.scenarioId) continue;
      if (filter?.linkedTestId && r.linkedTest?.id !== filter.linkedTestId) continue;
      out.push(summarize(r));
    } catch { /* skip */ }
  }
  return out.sort((a, b) => b.startedAt - a.startedAt).slice(0, filter?.limit ?? 200);
}

export async function deleteRun(id: string) {
  if (!RUN_ID_RE.test(id)) throw new Error('bad id');
  await fs.unlink(path.join(runsDir(), `${id}.json`));
}

/** One row per assert, metric and step — what a spreadsheet wants. */
export function runToCsv(r: RunView): string {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: unknown[][] = [['run_id', 'scenario', 'host', 'imsi', 'kind', 'path', 'name', 'result', 'value', 'unit', 'at_iso', 'detail']];
  const iso = (t?: number) => (t ? new Date(t).toISOString() : '');
  rows.push([r.id, r.scenarioName, r.host, r.imsi, 'run', '', r.scenarioId, r.state, r.endedAt ? r.endedAt - r.startedAt : '', 'ms', iso(r.startedAt), r.error ?? '']);
  for (const s of r.steps) rows.push([r.id, r.scenarioName, r.host, r.imsi, 'step', s.path, `${s.type}: ${s.label}`, s.status, s.endedAt ? s.endedAt - s.startedAt : '', 'ms', iso(s.startedAt), s.detail ?? '']);
  for (const a of r.assertResults) rows.push([r.id, r.scenarioName, r.host, r.imsi, 'assert', a.path, a.label, a.passed ? 'pass' : a.optional ? 'warn' : 'fail', a.elapsedMs, 'ms', iso(a.at), a.detail]);
  for (const m of r.metrics) rows.push([r.id, r.scenarioName, r.host, r.imsi, 'metric', m.path, m.name, '', m.value, m.unit, iso(m.at), '']);
  for (const t of r.teardown) rows.push([r.id, r.scenarioName, r.host, r.imsi, 'teardown', '', t.what, t.ok ? 'ok' : 'fail', '', '', iso(t.at), t.detail ?? '']);
  return rows.map(row => row.map(esc).join(',')).join('\n') + '\n';
}

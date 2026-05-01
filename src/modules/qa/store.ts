// Filesystem-backed Run store. Same pattern as other simtool data
// (data/users/<...>.json) — runs live at data/qa/runs/<runId>.json
// and per-case evidence bundles (cfgs, log tails, hardcopies) live
// under data/qa/runs/<runId>/<caseId>/.
//
// We use a tiny in-memory mutex (per-runId) so concurrent updates
// from the runner + cancel-handler don't race on the JSON file.

import { promises as fs } from 'fs';
import * as path from 'path';
import type { Run } from './types';

const QA_ROOT = path.join(process.cwd(), 'data', 'qa');
const RUNS_DIR = path.join(QA_ROOT, 'runs');

const inflight = new Map<string, Promise<unknown>>();

async function withLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  const prev = inflight.get(runId) ?? Promise.resolve();
  const p = prev.then(fn, fn);
  inflight.set(runId, p.catch(() => undefined));
  return p;
}

async function ensureDirs() {
  await fs.mkdir(RUNS_DIR, { recursive: true });
}

function runPath(runId: string): string {
  return path.join(RUNS_DIR, `${runId}.json`);
}

export function evidenceDir(runId: string, caseId: string): string {
  return path.join(RUNS_DIR, runId, caseId);
}

export async function saveRun(run: Run): Promise<void> {
  await ensureDirs();
  await withLock(run.id, async () => {
    const tmp = runPath(run.id) + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(run, null, 2), 'utf8');
    await fs.rename(tmp, runPath(run.id));
  });
}

export async function loadRun(runId: string): Promise<Run | null> {
  try {
    const raw = await fs.readFile(runPath(runId), 'utf8');
    return JSON.parse(raw) as Run;
  } catch (e: any) {
    if (e?.code === 'ENOENT') return null;
    throw e;
  }
}

export async function listRuns(limit = 100): Promise<Run[]> {
  await ensureDirs();
  const files = await fs.readdir(RUNS_DIR);
  const runFiles = files.filter((f) => f.endsWith('.json'));
  // Sort by mtime desc for "newest first" in the UI.
  const stats = await Promise.all(
    runFiles.map(async (f) => ({
      f,
      mtime: (await fs.stat(path.join(RUNS_DIR, f))).mtimeMs,
    })),
  );
  stats.sort((a, b) => b.mtime - a.mtime);
  const top = stats.slice(0, limit);
  const runs: Run[] = [];
  for (const { f } of top) {
    try {
      const raw = await fs.readFile(path.join(RUNS_DIR, f), 'utf8');
      runs.push(JSON.parse(raw) as Run);
    } catch {
      // Malformed run JSON — skip rather than crash the listing.
    }
  }
  return runs;
}

export async function ensureEvidenceDir(runId: string, caseId: string): Promise<string> {
  const dir = evidenceDir(runId, caseId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeEvidenceFile(
  runId: string,
  caseId: string,
  filename: string,
  content: string | Buffer,
): Promise<string> {
  const dir = await ensureEvidenceDir(runId, caseId);
  const dest = path.join(dir, filename);
  await fs.writeFile(dest, content);
  return dest;
}

export async function readEvidenceFile(
  runId: string,
  caseId: string,
  filename: string,
): Promise<string | null> {
  try {
    return await fs.readFile(path.join(evidenceDir(runId, caseId), filename), 'utf8');
  } catch (e: any) {
    if (e?.code === 'ENOENT') return null;
    throw e;
  }
}

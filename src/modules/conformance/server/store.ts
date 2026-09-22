// File storage for pre-conformance plans and reports:
//   data/conformance/plans/<id>.json    — test plans (seeded from lib/plans.ts)
//   data/conformance/reports/<id>.json  — one finished (or running) plan run
// Same data root as the Mobility Scenarios store.
import fs from 'fs/promises';
import path from 'path';
import { storageConfig } from '@/lib/storage/config';
import type { PlanRunSummary, PlanRunView, TestPlan } from '../types';
import { DEFAULT_PLANS } from '../lib/plans';
import { CASE_BY_ID } from '../lib/cases';
import { summarizePlanRun } from '../lib/report';

const base = () => storageConfig?.basePath || path.join(process.cwd(), 'data');
export const plansDir = () => path.join(base(), 'conformance', 'plans');
export const reportsDir = () => path.join(base(), 'conformance', 'reports');
const SEED_MARKER = '.seeded';
export const PLAN_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const REPORT_ID_RE = /^pc-[a-z0-9-]{6,64}$/;

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

export function validatePlan(p: unknown): string[] {
  const errs: string[] = [];
  if (!p || typeof p !== 'object') return ['plan must be an object'];
  const plan = p as TestPlan;
  if (typeof plan.id !== 'string' || !PLAN_ID_RE.test(plan.id)) errs.push('id must be a lowercase slug (a-z, 0-9, -)');
  if (typeof plan.name !== 'string' || !plan.name.trim()) errs.push('name is required');
  if (!['nr', 'lte', 'auto'].includes(plan.rat as string)) errs.push('rat must be nr, lte or auto');
  if (!Array.isArray(plan.cases) || plan.cases.length === 0) errs.push('a plan needs at least one case');
  else plan.cases.forEach((c, i) => {
    if (!c || !CASE_BY_ID[c.caseId]) errs.push(`cases[${i}]: unknown case "${c?.caseId}"`);
    if (c?.params !== undefined && (typeof c.params !== 'object' || Array.isArray(c.params))) errs.push(`cases[${i}].params must be an object`);
  });
  if (typeof plan.stopOnFail !== 'boolean') errs.push('stopOnFail must be true/false');
  return errs;
}

export async function ensurePlanSeeds(force = false) {
  const dir = plansDir();
  await fs.mkdir(dir, { recursive: true });
  let seeded: string[] = [];
  try { seeded = JSON.parse(await fs.readFile(path.join(dir, SEED_MARKER), 'utf8')); } catch { /* first run */ }
  for (const p of DEFAULT_PLANS) {
    const file = path.join(dir, `${p.id}.json`);
    const exists = await fs.access(file).then(() => true, () => false);
    if (force || (!exists && !seeded.includes(p.id))) await writeJson(file, { ...p, builtin: true, updatedAt: new Date().toISOString() });
    if (!seeded.includes(p.id)) seeded.push(p.id);
  }
  await writeJson(path.join(dir, SEED_MARKER), seeded);
}

export async function listPlans(): Promise<TestPlan[]> {
  await ensurePlanSeeds();
  const out: TestPlan[] = [];
  for (const f of (await fs.readdir(plansDir())).filter(x => x.endsWith('.json'))) {
    try { out.push(JSON.parse(await fs.readFile(path.join(plansDir(), f), 'utf8'))); } catch { /* skip corrupt */ }
  }
  return out.sort((a, b) => (Number(!!b.builtin) - Number(!!a.builtin)) || a.name.localeCompare(b.name));
}

export async function getPlan(id: string): Promise<TestPlan | null> {
  if (!PLAN_ID_RE.test(id)) return null;
  await ensurePlanSeeds();
  try { return JSON.parse(await fs.readFile(path.join(plansDir(), `${id}.json`), 'utf8')); } catch { return null; }
}

export async function savePlan(p: TestPlan) {
  const errs = validatePlan(p);
  if (errs.length) throw new Error(`Invalid plan: ${errs.join('; ')}`);
  const doc: TestPlan = { ...p, updatedAt: new Date().toISOString() };
  await writeJson(path.join(plansDir(), `${p.id}.json`), doc);
  return doc;
}

export async function deletePlan(id: string) {
  if (!PLAN_ID_RE.test(id)) throw new Error('bad id');
  await fs.unlink(path.join(plansDir(), `${id}.json`));
}

export async function restorePlans(id?: string) {
  if (!id) return ensurePlanSeeds(true);
  const seed = DEFAULT_PLANS.find(p => p.id === id);
  if (!seed) throw new Error(`${id} is not a built-in plan`);
  return writeJson(path.join(plansDir(), `${id}.json`), { ...seed, builtin: true, updatedAt: new Date().toISOString() });
}

// ─── Reports ────────────────────────────────────────────────────────────────
export async function saveReport(r: PlanRunView) {
  await writeJson(path.join(reportsDir(), `${r.id}.json`), r);
}

export async function getReport(id: string): Promise<PlanRunView | null> {
  if (!REPORT_ID_RE.test(id)) return null;
  try { return JSON.parse(await fs.readFile(path.join(reportsDir(), `${id}.json`), 'utf8')); } catch { return null; }
}

export async function listReports(limit = 200): Promise<PlanRunSummary[]> {
  let files: string[] = [];
  try { files = (await fs.readdir(reportsDir())).filter(f => f.endsWith('.json')); } catch { return []; }
  const out: PlanRunSummary[] = [];
  for (const f of files) {
    try { out.push(summarizePlanRun(JSON.parse(await fs.readFile(path.join(reportsDir(), f), 'utf8')))); } catch { /* skip */ }
  }
  return out.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
}

export async function deleteReport(id: string) {
  if (!REPORT_ID_RE.test(id)) throw new Error('bad id');
  await fs.unlink(path.join(reportsDir(), `${id}.json`));
}

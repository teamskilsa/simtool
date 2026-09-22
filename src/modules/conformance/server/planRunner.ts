// Pre-conformance plan runner (server only): a thin orchestration layer over
// the Mobility Scenario runner.
//
// A plan run reserves the system (no mobility run can start on it meanwhile,
// and it refuses to start while one is active), reads the callbox once
// (software banners, config_get cells, the UE in the core), then runs each
// case in order: precondition check → build its scenario for this config →
// startRun (with the reservation token) → wait → verdict. Every case keeps its
// own scenario run record (data/scenario-runs); the plan run is the report
// (data/conformance/reports), saved after every case.
import * as crypto from 'crypto';
import type { PromptResponse, RunView } from '@/modules/scenarios/types';
import { RemoteConn } from '@/modules/scenarios/server/remoteConn';
import { getRunObject, parseCells, releaseSystem, reserveSystem, respondToPrompt, startRun, stopRun } from '@/modules/scenarios/server/runner';
import { isIPv4 } from '@/modules/traffic/server/traffic.server';
import type {
  CaseEnv, CaseResult, PlanPreflightCheck, PlanRunRequest, PlanRunView, Rat, TestCaseDef, TestPlan, Verdict,
} from '../types';
import { DISCLAIMER, emptyCounts } from '../types';
import { CASE_BY_ID, defaultParams, specsFor, supportsRat } from '../lib/cases';
import { ratLabel } from '../lib/signalling';
import { summarizePlanRun } from '../lib/report';
import { getPlan, saveReport, validatePlan } from './store';

const g = globalThis as unknown as { __simtoolPlanRuns?: Map<string, PlanRun> };
const planRuns: Map<string, PlanRun> = g.__simtoolPlanRuns ?? (g.__simtoolPlanRuns = new Map());

class PlanRun {
  view: PlanRunView;
  private token: string | null = null;
  private abortReason: string | null = null;
  private currentRunId: string | null = null;
  private hasSsh: boolean;
  private wake: (() => void) | null = null;

  constructor(private req: PlanRunRequest, private plan: TestPlan) {
    const id = `pc-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(4).toString('hex')}`;
    const c = req.creds;
    this.hasSsh = !!(c?.username && (c.password || c.privateKey));
    this.view = {
      id, planId: plan.id, planName: plan.name, disclaimer: DISCLAIMER, state: 'preflight',
      host: req.host, enbPort: req.enbPort ?? 9001, mmePort: req.mmePort ?? 9000, systemName: req.systemName,
      imsi: req.imsi, stopOnFail: req.stopOnFail ?? plan.stopOnFail, startedAt: Date.now(),
      preflight: [], callbox: {}, cells: [], cellSummary: [], ue: { imsi: req.imsi },
      cases: plan.cases.map((pc, index) => {
        const def = CASE_BY_ID[pc.caseId];
        return {
          index, caseId: pc.caseId, title: def?.title ?? pc.caseId, category: def?.category ?? 'Robustness', automation: def?.automation ?? 'automatic',
          specs: def ? specsFor(def) : [], status: 'pending', verdict: 'NOT_RUN', reason: 'not run yet',
          params: { ...(def ? defaultParams(def) : {}), ...(pc.params ?? {}) }, evidence: [], checks: [], metrics: [], teardown: [],
        };
      }),
      currentIndex: -1, counts: emptyCounts(), confirmedRisky: (req.confirmRisky ?? []).filter(x => CASE_BY_ID[x]?.risky),
    };
  }

  // ─── Preflight ────────────────────────────────────────────────────────────
  private check(name: string, ok: boolean, level: 'error' | 'warn' | 'info', detail: string, plain: string) {
    const c: PlanPreflightCheck = { name, ok, level: ok ? 'info' : level, detail, plain };
    this.view.preflight.push(c);
  }

  async preflight(): Promise<boolean> {
    const enb = new RemoteConn('eNB', this.req.host, this.view.enbPort, 'simtool-pc');
    const mme = new RemoteConn('MME', this.req.host, this.view.mmePort, 'simtool-pc');
    try {
      try { await enb.connect(); this.check('eNB/gNB remote API', true, 'error', `${enb.info.name ?? ''} ${enb.info.version ?? ''}`.trim(), `Reached the callbox radio (${enb.info.name ?? 'eNB/gNB'} ${enb.info.version ?? ''}).`); }
      catch (e: any) { this.check('eNB/gNB remote API', false, 'error', e.message, `Cannot reach the callbox radio: ${e.message}`); return false; }
      try { await mme.connect(); this.check('MME/AMF remote API', true, 'error', `${mme.info.name ?? ''} ${mme.info.version ?? ''}`.trim(), `Reached the core network (${mme.info.name ?? 'MME/AMF'} ${mme.info.version ?? ''}).`); }
      catch (e: any) { this.check('MME/AMF remote API', false, 'error', e.message, `Cannot reach the core network: ${e.message}`); return false; }
      this.view.callbox = { enb: { name: enb.info.name, version: enb.info.version }, mme: { name: mme.info.name, version: mme.info.version } };

      const cfg = await enb.send<any>({ message: 'config_get' });
      const cells = parseCells(cfg);
      this.view.cells = cells;
      this.view.cellSummary = cells.map(c => `Cell ${c.id}: ${c.rat === 'nr' ? `NR PCI ${c.pci}, SSB ${c.ssb} (DL NR-ARFCN ${c.earfcn})${c.band ? `, n${c.band}` : ''}` : `LTE PCI ${c.pci}, DL EARFCN ${c.earfcn}${c.band ? `, band ${c.band}` : ''}`}`
        + `, TAC ${c.tac ?? '?'}${c.scells.length ? `, SCells ${c.scells.join(',')}` : ''}${c.hoFromMeas ? ', HO from measurements' : ''}${c.barred === true ? ', BARRED' : ''}`);
      const nr = cells.filter(c => c.rat === 'nr').length;
      const lte = cells.filter(c => c.rat === 'lte').length;
      this.check('Cells', cells.length > 0, 'error', `${lte} LTE, ${nr} NR`, cells.length ? `${cells.length} cell(s) running: ${lte} LTE, ${nr} NR.` : 'The callbox reports no cells.');

      const m = await mme.send<any>({ message: 'ue_get', imsi: this.req.imsi });
      const ue = (m.ue_list ?? []).find((u: any) => String(u.imsi) === this.req.imsi);
      const bearer = (ue?.bearers ?? []).find((b: any) => b.ip);
      this.view.ue = { imsi: this.req.imsi, ip: bearer?.ip, rat: ue?.rat_type, registered: ue ? !!ue.registered : undefined, imeisv: typeof ue?.imeisv === 'string' ? ue.imeisv : undefined };
      this.check('UE in the core', !!ue?.registered, 'warn',
        ue ? `${ue.rat_type ?? '?'} ${ue.registered ? 'registered' : 'not registered'}` : 'unknown IMSI',
        ue ? (ue.registered ? `IMSI ${this.req.imsi} is registered (${ue.rat_type}${bearer?.ip ? `, IP ${bearer.ip}` : ''}).` : `IMSI ${this.req.imsi} is known to the core but not registered — cases that need a registered UE will be INCONCLUSIVE; run the initial registration case first.`)
          : `IMSI ${this.req.imsi} is not known to the core yet — only operator-prompted registration can run until it registers.`);

      // RAT: the UE's, else the only RAT the config runs, else the plan's.
      const ueRat: Rat | undefined = ue?.rat_type === 'NR' ? 'nr' : ue?.rat_type === 'LTE' ? 'lte' : undefined;
      const cfgRat: Rat | undefined = nr && !lte ? 'nr' : lte && !nr ? 'lte' : undefined;
      let rat: Rat | undefined = ueRat ?? cfgRat ?? (this.plan.rat !== 'auto' ? this.plan.rat : undefined);
      if (this.plan.rat !== 'auto') {
        if (rat && rat !== this.plan.rat) {
          this.check('RAT', false, 'error', `plan ${this.plan.rat}, target ${rat}`, `This plan is for ${ratLabel(this.plan.rat)}, but the ${ueRat ? 'UE is on' : 'callbox runs'} ${ratLabel(rat)}.`);
          return false;
        }
        rat = this.plan.rat;
      }
      if (!rat) { this.check('RAT', false, 'error', 'unknown', 'Cannot tell whether to test NR SA or LTE: the UE is not in the core and the config runs both RATs. Pick an NR- or LTE-specific plan.'); return false; }
      const ratCells = cells.filter(c => c.rat === rat).length;
      if (!ratCells) { this.check('RAT', false, 'error', `no ${rat} cells`, `The running config has no ${ratLabel(rat)} cell.`); return false; }
      this.view.rat = rat;
      this.check('RAT', true, 'error', rat, `Testing ${ratLabel(rat)} (${ueRat ? 'the UE’s RAT' : 'the running config'}).`);
      this.check('Callbox traffic', this.hasSsh, 'warn', this.hasSsh ? 'SSH login present' : 'no SSH login',
        this.hasSsh ? 'The system has an SSH login: the callbox can send downlink UDP to page the UE or keep it connected.' : 'No SSH login on this system: cases that need callbox downlink data (paging) will be INCONCLUSIVE; others rely on the UE’s own traffic to stay connected.');
      const risky = this.plan.cases.filter(pc => CASE_BY_ID[pc.caseId]?.risky);
      for (const pc of risky) {
        const ok = this.view.confirmedRisky.includes(pc.caseId);
        this.check(`Confirm ${pc.caseId}`, ok, 'warn', ok ? 'confirmed' : 'not confirmed', ok ? `${pc.caseId} confirmed by the operator.` : `${pc.caseId} needs operator confirmation — it will be NOT RUN.`);
      }
      return true;
    } catch (e: any) {
      this.check('Preflight', false, 'error', e?.message ?? String(e), `Pre-check failed: ${e?.message ?? e}`);
      return false;
    } finally { enb.close(); mme.close(); }
  }

  // ─── Execute ──────────────────────────────────────────────────────────────
  async execute() {
    this.view.state = 'running';
    await this.save();
    let failedAt: string | null = null;
    try {
      for (let i = 0; i < this.view.cases.length; i++) {
        const cr = this.view.cases[i];
        this.view.currentIndex = i;
        if (this.abortReason) { this.finishCase(cr, 'NOT_RUN', `Not run: plan aborted (${this.abortReason})`); continue; }
        if (failedAt && this.view.stopOnFail) { this.finishCase(cr, 'NOT_RUN', `Not run: stop on fail after ${failedAt}`); continue; }
        await this.runCase(cr);
        if (cr.verdict === 'FAIL') failedAt = failedAt ?? cr.caseId;
        await this.save();
        const pause = this.plan.interCaseMs ?? 2000;
        if (i < this.view.cases.length - 1 && !this.abortReason && pause > 0 && cr.runId) await this.pause(pause);
      }
      this.view.state = this.abortReason ? 'aborted' : 'finished';
      if (this.abortReason) this.view.error = this.abortReason;
    } catch (e: any) {
      this.view.state = 'error';
      this.view.error = e?.message ?? String(e);
      for (const c of this.view.cases) if (c.status !== 'done') this.finishCase(c, 'NOT_RUN', `Not run: ${this.view.error}`);
    } finally {
      this.view.currentIndex = -1;
      this.view.prompt = undefined;
      this.view.endedAt = Date.now();
      this.recount();
      await this.save();
      if (this.token) releaseSystem(this.req.host, this.req.enbPort, this.token);
      this.token = null;
    }
  }

  private pause(ms: number) {
    return new Promise<void>(resolve => {
      const t = setTimeout(done, ms);
      function done() { clearTimeout(t); resolve(); }
      this.wake = done;
    }).finally(() => { this.wake = null; });
  }

  private recount() {
    const counts = emptyCounts();
    for (const c of this.view.cases) if (c.status === 'done') counts[c.verdict]++; else counts.NOT_RUN++;
    this.view.counts = counts;
  }

  private finishCase(cr: CaseResult, verdict: Verdict, reason: string) {
    cr.status = 'done';
    cr.verdict = verdict;
    cr.reason = reason;
    cr.endedAt = cr.endedAt ?? Date.now();
    cr.currentStep = undefined;
    this.recount();
  }

  private async runCase(cr: CaseResult) {
    const def = CASE_BY_ID[cr.caseId];
    const rat = this.view.rat!;
    if (!def) { this.finishCase(cr, 'NOT_RUN', `Unknown case ${cr.caseId}`); return; }
    cr.specs = specsFor(def, rat);
    if (!supportsRat(def, rat)) { this.finishCase(cr, 'NOT_RUN', `Not applicable to ${ratLabel(rat)} (this case is ${def.rat === 'nr' ? 'NR' : 'LTE'} only)`); return; }
    if (def.risky && !this.view.confirmedRisky.includes(def.id)) { this.finishCase(cr, 'NOT_RUN', `Not run: needs operator confirmation before running (${def.risky.confirm})`); return; }

    const env: CaseEnv = { rat, cells: this.view.cells, hasSsh: this.hasSsh, params: { ...cr.params } };
    cr.status = 'running';
    cr.startedAt = Date.now();
    this.recount();
    const why = def.precheck(env);
    if (why) { this.finishCase(cr, 'INCONCLUSIVE', `Precondition not met: ${why}`); return; }

    let scenario;
    try { scenario = def.build(env); }
    catch (e: any) { this.finishCase(cr, 'INCONCLUSIVE', `Could not build the case for this config: ${e?.message ?? e}`); return; }

    let started: { ok: boolean; run: RunView };
    try {
      started = await startRun({
        scenario, host: this.req.host, enbPort: this.req.enbPort, mmePort: this.req.mmePort, imsi: this.req.imsi,
        systemId: this.req.systemId, systemName: this.req.systemName, creds: this.req.creds,
        reservation: this.token ?? undefined, allowNetworkDetach: def.risky ? this.view.confirmedRisky.includes(def.id) : false,
        allowUnregistered: def.automation === 'operator-prompted',
      });
    } catch (e: any) {
      this.finishCase(cr, 'INCONCLUSIVE', `Test system error — the case could not start: ${e?.message ?? e}`);
      return;
    }
    cr.runId = started.run.id;
    if (!started.ok) {
      this.absorb(cr, started.run);
      this.finishCase(cr, 'INCONCLUSIVE', `Test system error — the case could not start: ${started.run.error ?? 'preflight failed'}`);
      return;
    }
    this.currentRunId = started.run.id;
    const obj = getRunObject(started.run.id);
    if (this.abortReason) { try { stopRun(started.run.id, `Plan aborted: ${this.abortReason}`); } catch { /* ended */ } }
    if (obj) await obj.finished;
    this.currentRunId = null;
    const view = obj?.view ?? started.run;
    this.absorb(cr, view);
    const [verdict, reason] = this.verdictOf(def, cr, view);
    this.finishCase(cr, verdict, reason);
    cr.endedAt = view.endedAt ?? Date.now();
  }

  /** Copy the evidence a case report needs out of the scenario run. */
  private absorb(cr: CaseResult, run: RunView) {
    cr.checks = run.assertResults.map(a => ({ label: a.label, passed: a.passed, optional: a.optional, detail: a.detail }));
    cr.evidence = [];
    for (const a of run.assertResults) {
      if (!a.evidence?.length) continue;
      cr.evidence.push(`${a.label}${a.passed ? '' : ' (not complete)'}:`);
      for (const l of a.evidence) cr.evidence.push(`  ${l}`);
    }
    if (!cr.evidence.length) {
      for (const a of run.assertResults.filter(x => x.passed)) cr.evidence.push(`${a.label}: ${a.detail}`);
    }
    cr.metrics = run.metrics.map(m => ({ name: m.name, value: m.value, unit: m.unit }));
    cr.teardown = run.teardown.map(t => ({ what: t.what, ok: t.ok, detail: t.detail }));
    const bad = run.preflight.filter(c => !c.ok && c.level === 'error');
    if (bad.length) cr.evidence.push(...bad.map(c => `pre-check ${c.name}: ${c.detail}`));
  }

  private verdictOf(def: TestCaseDef, cr: CaseResult, run: RunView): [Verdict, string] {
    const tdFailed = run.teardown.filter(t => !t.ok);
    const tdNote = tdFailed.length ? ` Teardown problem: ${tdFailed.map(t => `${t.what} — ${t.detail ?? 'failed'}`).join('; ')}.` : '';
    switch (run.state) {
      case 'passed': {
        if (def.measurement) {
          const m = def.measurement;
          const values = run.metrics.filter(x => x.name === m.metric).map(x => x.value);
          if (!values.length) return ['INCONCLUSIVE', `No ${m.metric} sample was measured.${tdNote}`];
          const value = Math.round((m.stat === 'max' ? Math.max(...values) : values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
          const threshold = Number(cr.params[m.thresholdParam]);
          const pass = Number.isFinite(threshold) ? value <= threshold : false;
          cr.measurement = { metric: m.metric, stat: m.stat, value, unit: m.unit, threshold, pass, samples: values.length };
          return [pass ? 'PASS' : 'FAIL', `${m.stat} ${m.metric} = ${value} ${m.unit} over ${values.length} sample(s) ${pass ? '≤' : '>'} threshold ${threshold} ${m.unit}.${tdNote}`];
        }
        const warned = run.assertResults.filter(a => !a.passed && a.optional).length;
        return ['PASS', `All required checks passed (${run.asserts.passed}/${run.asserts.total}${warned ? `, ${warned} optional not met` : ''}).${tdNote}`];
      }
      case 'inconclusive': return ['INCONCLUSIVE', `${run.inconclusive ?? 'Inconclusive'}.${tdNote}`];
      case 'failed': {
        const a = run.assertResults.find(x => !x.passed && !x.optional);
        return ['FAIL', `${a ? `${a.label}: ${a.detail}` : run.error ?? 'failed'}.${tdNote}`];
      }
      case 'aborted': return ['INCONCLUSIVE', `Aborted: ${run.error ?? this.abortReason ?? 'stopped'}.${tdNote}`];
      default: return ['INCONCLUSIVE', `Test system error: ${run.error ?? run.state}.${tdNote}`];
    }
  }

  private async save() {
    this.recount();
    await saveReport(this.snapshot()).catch(() => { /* disk full etc.: the live view still works */ });
  }

  /** The view with the running case's live step and operator prompt. */
  snapshot(): PlanRunView {
    const v: PlanRunView = { ...this.view, cases: this.view.cases.map(c => ({ ...c })) };
    const id = this.currentRunId;
    const run = id ? getRunObject(id) : null;
    if (run && v.currentIndex >= 0) {
      const cr = v.cases[v.currentIndex];
      const step = [...run.view.steps].reverse().find(s => s.status === 'running');
      cr.currentStep = step ? step.label : run.view.state;
      cr.checks = run.view.assertResults.map(a => ({ label: a.label, passed: a.passed, optional: a.optional, detail: a.detail }));
      if (run.view.prompt) v.prompt = { ...run.view.prompt, runId: run.view.id, caseId: cr.caseId, caseTitle: cr.title };
    }
    return v;
  }

  abort(reason = 'Aborted by the operator') {
    if (this.abortReason || this.view.endedAt) return;
    this.abortReason = reason;
    if (this.currentRunId) { try { stopRun(this.currentRunId, `Plan aborted: ${reason}`); } catch { /* already ended */ } }
    this.wake?.();
  }

  respond(promptId: string, response: PromptResponse) {
    if (!this.currentRunId) throw new Error('No case is waiting for the operator');
    if (response === 'abort') {
      // Abort from the prompt stops the whole plan, not just this case.
      this.abortReason = 'Aborted by the operator';
    }
    return respondToPrompt(this.currentRunId, promptId, response);
  }

  async reserve() { this.token = reserveSystem(this.req.host, this.req.enbPort, `pre-conformance plan "${this.plan.name}" (${this.view.id})`); }
  release() { if (this.token) releaseSystem(this.req.host, this.req.enbPort, this.token); this.token = null; }
}

// ─── Public API ─────────────────────────────────────────────────────────────
export async function startPlanRun(req: PlanRunRequest): Promise<{ ok: boolean; run: PlanRunView }> {
  if (!isIPv4(req.host)) throw new Error('host must be an IPv4 address');
  if (typeof req.imsi !== 'string' || !/^\d{5,15}$/.test(req.imsi)) throw new Error('imsi must be 5–15 digits');
  for (const p of [req.enbPort, req.mmePort]) if (p !== undefined && !(Number.isInteger(p) && p > 0 && p < 65536)) throw new Error('bad port');
  const plan = req.plan ?? (req.planId ? await getPlan(req.planId) : null);
  if (!plan) throw new Error(req.planId ? `Plan "${req.planId}" not found` : 'planId or plan is required');
  const errs = validatePlan(plan);
  if (errs.length) throw new Error(`Plan is invalid: ${errs.join('; ')}`);

  const run = new PlanRun(req, plan);
  await run.reserve(); // throws when a mobility run or another plan holds the system
  planRuns.set(run.view.id, run);
  let ok = false;
  try { ok = await run.preflight(); }
  catch (e: any) { run.view.preflight.push({ name: 'preflight', ok: false, level: 'error', detail: e?.message ?? String(e), plain: e?.message ?? String(e) }); }
  if (!ok) {
    run.view.state = 'error';
    run.view.error = run.view.preflight.filter(c => !c.ok && c.level === 'error').map(c => c.plain).join(' ') || 'Pre-checks failed';
    run.view.endedAt = Date.now();
    for (const c of run.view.cases) { c.status = 'done'; c.verdict = 'NOT_RUN'; c.reason = 'Not run: the plan pre-checks failed'; }
    run.view.counts = { PASS: 0, FAIL: 0, INCONCLUSIVE: 0, NOT_RUN: run.view.cases.length };
    run.release();
    await saveReport(run.view).catch(() => {});
    return { ok: false, run: run.view };
  }
  void run.execute();
  return { ok: true, run: run.snapshot() };
}

/** Pre-checks only (nothing is reserved beyond the check itself). */
export async function preflightPlan(req: PlanRunRequest) {
  if (!isIPv4(req.host)) throw new Error('host must be an IPv4 address');
  const plan = req.plan ?? (req.planId ? await getPlan(req.planId) : null);
  if (!plan) throw new Error('planId or plan is required');
  const run = new PlanRun(req, plan);
  const ok = await run.preflight();
  const rat = run.view.rat;
  const cases = plan.cases.map(pc => {
    const def = CASE_BY_ID[pc.caseId];
    if (!def) return { caseId: pc.caseId, ok: false, detail: 'unknown case' };
    if (!rat) return { caseId: pc.caseId, ok: false, detail: 'RAT unknown' };
    if (!supportsRat(def, rat)) return { caseId: pc.caseId, ok: false, detail: `not applicable to ${ratLabel(rat)} — NOT RUN` };
    if (def.risky && !(req.confirmRisky ?? []).includes(def.id)) return { caseId: pc.caseId, ok: false, detail: 'needs operator confirmation — NOT RUN unless confirmed' };
    const why = def.precheck({ rat, cells: run.view.cells, hasSsh: !!(req.creds?.username && (req.creds.password || req.creds.privateKey)), params: { ...defaultParams(def), ...(pc.params ?? {}) } });
    return { caseId: pc.caseId, ok: !why, detail: why ? `precondition not met — will be INCONCLUSIVE: ${why}` : 'ready' };
  });
  return { ok, checks: run.view.preflight, rat, cells: run.view.cells, cellSummary: run.view.cellSummary, callbox: run.view.callbox, ue: run.view.ue, cases };
}

export function getPlanRun(id: string): PlanRunView | null {
  const r = planRuns.get(id);
  return r ? r.snapshot() : null;
}

export function listPlanRuns() {
  const cutoff = Date.now() - 60 * 60_000;
  for (const [id, r] of planRuns) if (r.view.endedAt && r.view.endedAt < cutoff) planRuns.delete(id);
  return [...planRuns.values()].map(r => summarizePlanRun(r.snapshot())).sort((a, b) => b.startedAt - a.startedAt);
}

export function abortPlanRun(id: string, reason?: string) {
  const r = planRuns.get(id);
  if (!r) throw new Error('No such plan run in memory (it may have finished — see Reports)');
  r.abort(reason);
  return summarizePlanRun(r.snapshot());
}

export function respondPlanPrompt(id: string, promptId: string, response: PromptResponse) {
  const r = planRuns.get(id);
  if (!r) throw new Error('No such plan run in memory');
  r.respond(promptId, response);
  return r.snapshot();
}

export const isPlanRunActive = (id: string) => {
  const r = planRuns.get(id);
  return !!r && !r.view.endedAt;
};

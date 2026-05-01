// QA test runner skeleton. Phase 0: orchestrator structure + step
// recording + evidence-bundle layout. Phase 1 (next commit) wires the
// real generator + /api/systems/* calls. We keep them as TODOs marked
// inline so the contract is reviewable now.
//
// Each case follows the recipe in docs/QA_PLAN.md:
//   A. preflight  → ping/ssh-test both systems
//   B. generate   → enb.cfg + ue.cfg from TestCase params
//   C. validate   → lteenb/lteue dry-run; gate on parse errors
//   D. deploy     → live cfgs + service restart
//   E. attach     → wait for UE registered, snapshot
//   F. teardown   → stop daemons, restore prior cfgs
//   G. evidence   → screen hardcopy, ots.log tail, persist bundle

import type {
  Run,
  TestCase,
  CaseResult,
  CaseStatus,
  CasePhase,
  CaseStep,
} from './types';
import { saveRun, ensureEvidenceDir, writeEvidenceFile } from './store';
import { getCase } from './catalog';

interface RunnerCtx {
  run: Run;
  /** Save the run after each step so the UI sees progress without polling stale data. */
  flush: () => Promise<void>;
  /** True if the run was cancelled mid-flight; checked between phases. */
  cancelled: () => boolean;
}

async function runStep<T>(
  ctx: RunnerCtx,
  caseResult: CaseResult,
  phase: CasePhase,
  name: string,
  fn: () => Promise<{ ok: boolean; detail?: string; data?: T }>,
): Promise<{ ok: boolean; data?: T }> {
  const t0 = Date.now();
  let ok = false;
  let detail: string | undefined;
  let data: T | undefined;
  try {
    const r = await fn();
    ok = r.ok;
    detail = r.detail;
    data = r.data;
  } catch (e: any) {
    ok = false;
    detail = `threw: ${e?.message ?? String(e).slice(0, 200)}`;
  }
  const step: CaseStep = { name, ok, detail, ms: Date.now() - t0, phase };
  caseResult.steps.push(step);
  await ctx.flush();
  return { ok, data };
}

async function runCase(ctx: RunnerCtx, tc: TestCase, idx: number): Promise<void> {
  const caseResult = ctx.run.cases[idx];
  caseResult.status = 'running';
  await ctx.flush();
  const t0 = Date.now();

  // Each phase is a small async function that returns when the gate
  // either passes or fails. On failure, we stamp failedPhase and
  // skip to teardown / evidence so we never leave daemons in a half-
  // running state.
  let failed = false;

  // ── A. preflight ─────────────────────────────────────────────────
  if (!ctx.cancelled() && !failed) {
    const r = await runStep(ctx, caseResult, 'preflight', 'preflight-ping-ssh', async () => {
      // TODO(phase1): call /api/systems/ping + ssh-test for both systems.
      return { ok: true, detail: 'stub — phase 1 will call /api/systems/{ping,ssh-test}' };
    });
    if (!r.ok) { caseResult.failedPhase = 'preflight'; failed = true; }
  }

  // ── B. generate ──────────────────────────────────────────────────
  if (!ctx.cancelled() && !failed) {
    const r = await runStep(ctx, caseResult, 'generate', 'generate-cfgs', async () => {
      // TODO(phase1): call into the existing config generator with
      // TestCase params; write enb.cfg + ue.cfg to the evidence dir.
      const dir = await ensureEvidenceDir(ctx.run.id, tc.id);
      await writeEvidenceFile(ctx.run.id, tc.id, 'enb.cfg', `// stub for ${tc.id}\n`);
      await writeEvidenceFile(ctx.run.id, tc.id, 'ue.cfg',  `// stub for ${tc.id}\n`);
      caseResult.evidence = {
        generatedCfgs: { enb: `${dir}/enb.cfg`, ue: `${dir}/ue.cfg` },
      };
      return { ok: true, detail: `cfgs at ${dir}` };
    });
    if (!r.ok) { caseResult.failedPhase = 'generate'; failed = true; }
  }

  // ── C. validate (dry-run) ────────────────────────────────────────
  if (!ctx.cancelled() && !failed) {
    const r = await runStep(ctx, caseResult, 'validate', 'lteenb-dryrun', async () => {
      // TODO(phase1): call /api/systems/config-validate for callbox.
      return { ok: true, detail: 'stub — phase 1 will call /api/systems/config-validate' };
    });
    if (!r.ok) { caseResult.failedPhase = 'validate'; failed = true; }
  }

  // ── D. deploy live ───────────────────────────────────────────────
  if (!ctx.cancelled() && !failed) {
    const r = await runStep(ctx, caseResult, 'deploy', 'deploy-enb', async () => {
      // TODO(phase1): call /api/systems/config-deploy for callbox + uesim.
      return { ok: true, detail: 'stub — phase 1 will call /api/systems/config-deploy' };
    });
    if (!r.ok) { caseResult.failedPhase = 'deploy'; failed = true; }
  }

  // ── E. attach + verify ───────────────────────────────────────────
  if (!ctx.cancelled() && !failed) {
    const r = await runStep(ctx, caseResult, 'attach', 'wait-attach', async () => {
      // TODO(phase1): poll lteue agent /api/ue_get until state=connected;
      // snapshot imsi/rsrp/pci/earfcn/attachMs.
      return { ok: true, detail: `stub — expect attach within ${tc.expectAttachWithinSec}s` };
    });
    if (!r.ok) { caseResult.failedPhase = 'attach'; failed = true; }
  }

  // ── F. teardown (always runs, even on fail) ──────────────────────
  await runStep(ctx, caseResult, 'teardown', 'teardown', async () => {
    // TODO(phase1): stop lteue + lte; restore prior cfgs from backup.
    return { ok: true, detail: 'stub — phase 1 will stop daemons + restore prior cfgs' };
  });

  // ── Final case status ────────────────────────────────────────────
  if (ctx.cancelled()) {
    caseResult.status = 'skipped';
  } else if (failed) {
    caseResult.status = 'failed';
  } else {
    caseResult.status = 'passed';
  }
  caseResult.durationMs = Date.now() - t0;
  await ctx.flush();
}

/**
 * Top-level entrypoint enqueued by POST /api/qa/runs. Runs every case
 * in `run.cases` sequentially, persists the run after each step,
 * and finalises status (passed / failed / mixed / cancelled).
 */
export async function executeRun(run: Run): Promise<void> {
  let cancelledFlag = false;
  const ctx: RunnerCtx = {
    run,
    flush: () => saveRun(run),
    cancelled: () => cancelledFlag,
  };

  run.status = 'running';
  await ctx.flush();

  for (let i = 0; i < run.cases.length; i++) {
    if (cancelledFlag) break;
    // Allow external cancellation between cases — we re-read the
    // persisted record each iteration in case POST /cancel flipped it.
    // (Phase 1 will refine this with an in-memory flag set by the
    // cancel handler so we don't pay disk I/O between cases.)
    const tc = getCase(run.cases[i].caseId);
    if (!tc) {
      run.cases[i].status = 'failed';
      run.cases[i].failedPhase = 'preflight';
      run.cases[i].steps.push({
        name: 'lookup-case',
        ok: false,
        detail: `caseId not in catalog: ${run.cases[i].caseId}`,
      });
      await ctx.flush();
      if (run.options.stopOnFail) break;
      continue;
    }
    await runCase(ctx, tc, i);
    if (run.cases[i].status === 'failed' && run.options.stopOnFail) break;
  }

  // Finalise.
  const passed = run.cases.filter((c) => c.status === 'passed').length;
  const failed = run.cases.filter((c) => c.status === 'failed').length;
  const skipped = run.cases.filter((c) => c.status === 'skipped' || c.status === 'pending').length;
  run.status =
    cancelledFlag ? 'cancelled'
    : failed === 0 && skipped === 0 ? 'passed'
    : passed === 0 ? 'failed'
    : 'mixed';
  run.finishedAt = new Date().toISOString();
  await ctx.flush();
}

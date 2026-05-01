// /api/qa/runs
//   GET  → list of recent runs (summary)
//   POST → create + enqueue a new run
//
// POST body: CreateRunRequest
//   { caseIds: string[], systems: { callbox, uesim }, options? }
//
// Response: CreateRunResponse
//   { runId, queueLength }
//
// The actual orchestration runs asynchronously on the queue. Clients
// poll GET /api/qa/runs/:runId for progress.

import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';
import type { Run, CaseResult, CreateRunRequest } from '@/modules/qa/types';
import { listRuns, saveRun } from '@/modules/qa/store';
import { runnerQueue } from '@/modules/qa/queue';
import { executeRun } from '@/modules/qa/runner';
import { getCase } from '@/modules/qa/catalog';

function newRunId(): string {
  // <yyyymmdd-hhmmss>-<6 hex>. Sortable + unique enough for filesystem.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `${ts}-${randomBytes(3).toString('hex')}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const runs = await listRuns();
    // Trim down to a summary view — full case/step trail is fetched
    // separately via /api/qa/runs/:runId so this listing stays cheap.
    const summary = runs.map((r) => ({
      id: r.id,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      systems: r.systems,
      counts: {
        total: r.cases.length,
        passed: r.cases.filter((c) => c.status === 'passed').length,
        failed: r.cases.filter((c) => c.status === 'failed').length,
        skipped: r.cases.filter((c) => c.status === 'skipped').length,
      },
    }));
    return res.status(200).json({ runs: summary });
  }

  if (req.method === 'POST') {
    const body = req.body as CreateRunRequest;
    if (!body || !Array.isArray(body.caseIds) || body.caseIds.length === 0) {
      return res.status(400).json({ error: 'caseIds (non-empty array) is required' });
    }
    if (!body.systems || typeof body.systems.callbox !== 'number' || typeof body.systems.uesim !== 'number') {
      return res.status(400).json({ error: 'systems.callbox and systems.uesim (System.id numbers) are required' });
    }
    // Resolve catalog cases up front so we fail fast on bad caseIds.
    const unknown = body.caseIds.filter((id) => !getCase(id));
    if (unknown.length > 0) {
      return res.status(400).json({ error: `unknown caseIds: ${unknown.join(', ')}` });
    }

    const id = newRunId();
    const cases: CaseResult[] = body.caseIds.map((caseId) => ({
      caseId,
      status: 'pending',
      steps: [],
    }));
    const run: Run = {
      id,
      status: 'queued',
      startedAt: new Date().toISOString(),
      systems: body.systems,
      options: {
        stopOnFail: body.options?.stopOnFail ?? false,
        timeoutSec:  body.options?.timeoutSec  ?? 300,
      },
      cases,
    };
    await saveRun(run);

    // Hand off to the queue. The job promise resolves once the runner
    // finishes; we don't await it here — the handler returns
    // immediately so the UI can start polling.
    const queueLength = runnerQueue.enqueue(id, () => executeRun(run));

    return res.status(200).json({ runId: id, queueLength });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

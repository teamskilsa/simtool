// POST /api/qa/runs/:runId/cancel
//   → cancel a queued or in-flight run. Pulls the job out of the
//     queue if it hasn't started yet; if it has, marks the run record
//     as cancelled and the runner picks it up between cases (the
//     current case finishes through teardown, then we stop).

import type { NextApiRequest, NextApiResponse } from 'next';
import { loadRun, saveRun } from '@/modules/qa/store';
import { runnerQueue } from '@/modules/qa/queue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { runId } = req.query;
  if (typeof runId !== 'string') return res.status(400).json({ error: 'runId required' });
  const run = await loadRun(runId);
  if (!run) return res.status(404).json({ error: `unknown runId: ${runId}` });

  const wasQueued = runnerQueue.cancel(runId);
  // For runs already in flight or already finished, just stamp the
  // record. The runner's between-cases gate (see executeRun) reads the
  // persisted status so the next iteration is skipped.
  if (run.status === 'queued' || run.status === 'running') {
    run.status = 'cancelled';
    run.finishedAt = new Date().toISOString();
    for (const c of run.cases) {
      if (c.status === 'pending' || c.status === 'running') c.status = 'skipped';
    }
    await saveRun(run);
  }

  return res.status(200).json({
    runId,
    cancelledFromQueue: wasQueued,
    status: run.status,
  });
}

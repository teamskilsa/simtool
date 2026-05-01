// GET /api/qa/runs/:runId
//   → full Run record with case-level status + per-step trail.
//     UI polls this for live progress while a run is in flight.

import type { NextApiRequest, NextApiResponse } from 'next';
import { loadRun } from '@/modules/qa/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { runId } = req.query;
  if (typeof runId !== 'string') return res.status(400).json({ error: 'runId required' });
  const run = await loadRun(runId);
  if (!run) return res.status(404).json({ error: `unknown runId: ${runId}` });
  return res.status(200).json(run);
}

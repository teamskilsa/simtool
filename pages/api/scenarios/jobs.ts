// Mobility Scenario runs in memory (running and recently finished).
//   GET                       → { runs: RunSummary[] }
//   GET ?id=&eventsFrom=N     → { run }   (events from index N, for incremental polling)
//   POST { action:'stop', id } → stop the run; teardown still runs
//   POST { action:'prompt', id, promptId, response:'continue'|'skip'|'abort' }
//        → answer the operator step the run is waiting on (run.prompt)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getActiveRun, listActiveRuns, respondToPrompt, stopRun } from '@/modules/scenarios/server/runner';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (id) {
        const run = getActiveRun(id, Number(req.query.eventsFrom ?? 0) || 0);
        return run ? res.status(200).json({ success: true, run }) : res.status(404).json({ success: false, error: 'Run not in memory — see /api/scenarios/runs' });
      }
      return res.status(200).json({ success: true, runs: listActiveRuns() });
    }
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
    const { action, id, promptId, response } = req.body ?? {};
    if (action === 'prompt') {
      return res.status(200).json({ success: true, run: respondToPrompt(String(id), String(promptId), response) });
    }
    if (action === 'stop' || action === 'abort') {
      return res.status(200).json({ success: true, run: stopRun(String(id), action === 'abort' ? 'Aborted by user' : 'Stopped by user') });
    }
    return res.status(400).json({ success: false, error: 'action must be stop or prompt' });
  } catch (e: any) {
    return res.status(200).json({ success: false, error: e?.message || 'Mobility run request failed' });
  }
}

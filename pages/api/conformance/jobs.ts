// Pre-conformance plan runs in memory (running and recently finished).
//   GET                    → { runs: PlanRunSummary[] }
//   GET ?id=               → { run: PlanRunView }  (includes run.prompt while an operator step waits)
//   POST { action:'abort', id }                                       → abort; the case teardown still runs
//   POST { action:'prompt', id, promptId, response:'continue'|'skip'|'abort' } → answer the operator prompt
import type { NextApiRequest, NextApiResponse } from 'next';
import { abortPlanRun, getPlanRun, listPlanRuns, respondPlanPrompt } from '@/modules/conformance/server/planRunner';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (id) {
        const run = getPlanRun(id);
        return run ? res.status(200).json({ success: true, run }) : res.status(404).json({ success: false, error: 'Plan run not in memory — see /api/conformance/reports' });
      }
      return res.status(200).json({ success: true, runs: listPlanRuns() });
    }
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
    const { action, id, promptId, response } = req.body ?? {};
    if (action === 'abort' || action === 'stop') return res.status(200).json({ success: true, run: abortPlanRun(String(id)) });
    if (action === 'prompt') return res.status(200).json({ success: true, run: respondPlanPrompt(String(id), String(promptId), response) });
    return res.status(400).json({ success: false, error: 'action must be abort or prompt' });
  } catch (e: any) {
    return res.status(200).json({ success: false, error: e?.message || 'Plan run request failed' });
  }
}

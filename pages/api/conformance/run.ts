// Start (or only pre-check) a pre-conformance plan on a callbox.
//   POST { action:'preflight', ...PlanRunRequest } → { ok, checks, rat, cells, cellSummary, callbox, ue, cases }
//   POST { action:'start', ...PlanRunRequest }     → { success, run }  (run.state 'error' when refused)
// PlanRunRequest: { planId | plan, host, enbPort?, mmePort?, imsi, systemId?, systemName?,
//                   creds?, confirmRisky?: string[], stopOnFail? }
// Refused while a Mobility Scenario run or another plan is active on the system.
import type { NextApiRequest, NextApiResponse } from 'next';
import { preflightPlan, startPlanRun } from '@/modules/conformance/server/planRunner';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const { action = 'start', ...body } = req.body ?? {};
  try {
    if (action === 'preflight') return res.status(200).json({ success: true, ...(await preflightPlan(body)) });
    if (action === 'start') {
      const r = await startPlanRun(body);
      return res.status(200).json({ success: r.ok, run: r.run, error: r.ok ? undefined : r.run.error });
    }
    return res.status(400).json({ success: false, error: 'action must be start or preflight' });
  } catch (e: any) {
    return res.status(200).json({ success: false, error: e?.message || 'Could not start the plan' });
  }
}

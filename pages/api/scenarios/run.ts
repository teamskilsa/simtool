// Start (or dry-run the preflight of) a Mobility Scenario on a callbox.
//   POST { action:'preflight', ...RunRequest } → { ok, checks, cells }
//   POST { action:'start', ...RunRequest }     → { success, run }   (run.state 'error' + preflight when refused)
// RunRequest: { scenarioId | scenario, host, enbPort?, mmePort?, imsi, phoneSerial?,
//               params?, creds?, strict?, systemId?, systemName?, linkedTest?, configText? }
// Only one run per system (host) at a time.
import type { NextApiRequest, NextApiResponse } from 'next';
import { preflightOnly, startRun } from '@/modules/scenarios/server/runner';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const { action = 'start', ...body } = req.body ?? {};
  try {
    if (action === 'preflight') {
      const r = await preflightOnly(body);
      return res.status(200).json({ success: true, ...r });
    }
    if (action === 'start') {
      const r = await startRun(body);
      return res.status(200).json({ success: r.ok, run: r.run, error: r.ok ? undefined : r.run.error });
    }
    return res.status(400).json({ success: false, error: 'action must be start or preflight' });
  } catch (e: any) {
    return res.status(200).json({ success: false, error: e?.message || 'Could not start the mobility scenario' });
  }
}

// Start, stop and list traffic generators.
//   GET                          → { jobs }
//   POST { action: 'start', … }  → { job }   (see StartRequest)
//   POST { action: 'stop', id }  → { job }
import type { NextApiRequest, NextApiResponse } from 'next';
import { listJobs, startJob, stopAllTraffic, stopJob } from '@/modules/traffic/server/traffic.server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return res.status(200).json({ success: true, jobs: listJobs() });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, id, ...start } = req.body ?? {};
  try {
    if (action === 'stop') {
      return res.status(200).json({ success: true, job: await stopJob(String(id)) });
    }
    if (action === 'stop_all') {
      const { creds, phoneSerials } = req.body ?? {};
      const r = await stopAllTraffic(creds, Array.isArray(phoneSerials) ? phoneSerials : []);
      return res.status(200).json({ success: true, ...r, jobs: listJobs() });
    }
    if (action === 'start') {
      return res.status(200).json({ success: true, job: await startJob(start) });
    }
    res.status(400).json({ success: false, error: 'action must be start or stop' });
  } catch (e: any) {
    res.status(200).json({ success: false, error: e?.message || 'Traffic request failed' });
  }
}

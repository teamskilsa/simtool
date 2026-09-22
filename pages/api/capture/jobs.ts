// Capture jobs.
//   GET                                   → { jobs }
//   POST { action: 'start', type: 'iq' | 'log' | 'pcap', … } → { job }
//   POST { action: 'stop' | 'fetch' | 'discard', id }         → { job }
import type { NextApiRequest, NextApiResponse } from 'next';
import { discard, fetchJob, listJobs, startCapture, stopJob } from '@/modules/capture/server/capture.server';
import { isCaptureId } from '@/modules/capture/server/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return res.status(200).json({ success: true, jobs: listJobs() });
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const { action, id, ...body } = req.body ?? {};
  try {
    if (action === 'start') return res.status(200).json({ success: true, job: await startCapture(body) });
    if (!isCaptureId(id)) throw new Error('Invalid capture id');
    if (action === 'stop') return res.status(200).json({ success: true, job: await stopJob(id) });
    if (action === 'fetch') return res.status(200).json({ success: true, job: await fetchJob(id) });
    if (action === 'discard') return res.status(200).json({ success: true, job: await discard(id) });
    throw new Error('action must be start, stop, fetch or discard');
  } catch (e: any) {
    res.status(200).json({ success: false, error: e?.message || 'Capture request failed' });
  }
}

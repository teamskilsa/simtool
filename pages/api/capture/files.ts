// Saved captures under data/captures.
//   GET                 → { captures, hostFreeBytes }
//   DELETE ?id=<id>     → { success }
import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteCapture, hostFreeBytes, listCaptures } from '@/modules/capture/server/store';
import { isCaptureId } from '@/modules/capture/server/validate';
import { listJobs } from '@/modules/capture/server/capture.server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const [captures, free] = await Promise.all([listCaptures(), hostFreeBytes().catch(() => null)]);
      return res.status(200).json({ success: true, captures, hostFreeBytes: free });
    }
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!isCaptureId(id)) throw new Error('Invalid capture id');
      const busy = listJobs().find(j => j.id === id && (j.state === 'capturing' || j.state === 'fetching'));
      if (busy) throw new Error(`Capture ${id} is still ${busy.state}`);
      await deleteCapture(id);
      return res.status(200).json({ success: true });
    }
    res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (e: any) {
    res.status(200).json({ success: false, error: e?.message || 'Request failed' });
  }
}

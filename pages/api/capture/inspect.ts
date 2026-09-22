// Quick look at a fetched IQ file: averaged spectrum over a bounded slice and
// an RMS/peak power timeline across the file.
//   GET ?id=<id>&file=<name>&offsetSec=0&fftSize=2048&frames=64
import type { NextApiRequest, NextApiResponse } from 'next';
import { inspectIq } from '@/modules/capture/server/inspect.server';
import { isCaptureId, isLocalFileName } from '@/modules/capture/server/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const { id, file, offsetSec, fftSize, frames } = req.query;
  try {
    if (!isCaptureId(id) || !isLocalFileName(file)) throw new Error('id and file are required');
    const result = await inspectIq({ id, file, offsetSec: Number(offsetSec ?? 0), fftSize: Number(fftSize ?? 2048), frames: Number(frames ?? 64) });
    res.status(200).json({ success: true, result });
  } catch (e: any) {
    res.status(200).json({ success: false, error: e?.message || 'Inspect failed' });
  }
}

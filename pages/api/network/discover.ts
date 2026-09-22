// Scan the SimTool host's attached networks for Amarisoft callboxes.
//   POST { linkLocal?: boolean } → ScanResult
import type { NextApiRequest, NextApiResponse } from 'next';
import { discover } from '@/modules/network/server/discovery.server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const result = await discover({ linkLocal: !!req.body?.linkLocal });
    res.status(200).json({ success: true, ...result });
  } catch (e: any) {
    res.status(200).json({ success: false, error: e?.message || 'Scan failed', found: [], scanned: [] });
  }
}

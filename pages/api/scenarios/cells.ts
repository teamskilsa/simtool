// The callbox's cells, as the Mobility Scenario runner sees them — so the Run
// panel can offer real cell pickers ("Cell 4 — n78 3580 MHz") instead of raw
// 0-based indexes, and draw the cell map before a run starts.
//
//   POST { host, enbPort? } → { success, cells: CellInfo[] }
//
// Read-only: one eNB config_get, no state on the callbox is touched.
import type { NextApiRequest, NextApiResponse } from 'next';
import { readCells } from '@/modules/scenarios/server/runner';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const { host, enbPort = 9001 } = req.body ?? {};
  try {
    const cells = await readCells(String(host ?? ''), Number(enbPort) || 9001);
    return res.status(200).json({ success: true, cells });
  } catch (e: any) {
    return res.status(200).json({ success: false, cells: [], error: e?.message || 'eNB remote API unreachable' });
  }
}

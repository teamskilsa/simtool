// GET /api/qa/catalog/:caseId
//   → one TestCase, full record. Used by the UI's case-detail panel
//     to show the parameter set + expectations before queueing a run.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getCase } from '@/modules/qa/catalog';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { caseId } = req.query;
  if (typeof caseId !== 'string') return res.status(400).json({ error: 'caseId required' });
  const tc = getCase(caseId);
  if (!tc) return res.status(404).json({ error: `unknown caseId: ${caseId}` });
  return res.status(200).json(tc);
}

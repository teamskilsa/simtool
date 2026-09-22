// Pre-conformance catalogue (read-only).
//   GET → { cases: TestCaseInfo[], disclaimer }
import type { NextApiRequest, NextApiResponse } from 'next';
import { CASES, caseInfo } from '@/modules/conformance/lib/cases';
import { DISCLAIMER_LONG } from '@/modules/conformance/types';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
  return res.status(200).json({ success: true, disclaimer: DISCLAIMER_LONG, cases: CASES.map(caseInfo) });
}

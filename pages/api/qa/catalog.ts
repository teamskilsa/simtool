// GET /api/qa/catalog
//   → list of all TestCases, generated programmatically. UI uses this
//     to populate the catalog browser + filter chips.
//
// Optional query params:
//   ?rat=lte|nr|nbiot|catm|nsa  filter by RAT
//   ?band=7                      filter by primary band

import type { NextApiRequest, NextApiResponse } from 'next';
import { getCatalog, getCatalogRats } from '@/modules/qa/catalog';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let cases = getCatalog();
  const { rat, band } = req.query;
  if (typeof rat === 'string')  cases = cases.filter((c) => c.rat === rat);
  if (typeof band === 'string') cases = cases.filter((c) => String(c.band) === band);

  return res.status(200).json({
    rats: getCatalogRats(),
    total: cases.length,
    cases,
  });
}

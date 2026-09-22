// UEs attached to a callbox's MME, with per-bearer byte counters, plus what
// the radio is carrying right now from lteenb. The Traffic tab polls this once
// a second: diffing the MME counters gives the load the core forwarded, and
// the lteenb bitrates give what went over the air.
import type { NextApiRequest, NextApiResponse } from 'next';
import { isIPv4, listUes, radioSnapshot } from '@/modules/traffic/server/traffic.server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { host, mmePort = 9000, enbPort = 9001 } = req.body ?? {};
  if (!isIPv4(host)) return res.status(400).json({ success: false, error: 'host must be an IPv4 address' });

  const [ues, radio] = await Promise.allSettled([
    listUes(host, Number(mmePort)),
    radioSnapshot(host, Number(enbPort)),
  ]);
  if (ues.status === 'rejected') {
    return res.status(200).json({ success: false, error: ues.reason?.message || 'MME remote API unreachable', ues: [] });
  }
  res.status(200).json({
    success: true,
    at: Date.now(),
    ues: ues.value,
    radio: radio.status === 'fulfilled' ? radio.value : null,
    radioError: radio.status === 'rejected' ? (radio.reason?.message || 'eNB remote API unreachable') : undefined,
  });
}

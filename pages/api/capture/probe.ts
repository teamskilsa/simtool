// What a component offers for capture: RF ports + cells + channel counts
// (IQ) and current log levels, from config_get.
//   POST { host, apiPort } → { success, probe, hostFreeBytes }
import type { NextApiRequest, NextApiResponse } from 'next';
import { probe } from '@/modules/capture/server/probe';
import { hostFreeBytes } from '@/modules/capture/server/store';
import { isIPv4, toPort } from '@/modules/capture/server/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const { host, apiPort } = req.body ?? {};
  try {
    if (!isIPv4(host)) throw new Error('host must be an IPv4 address');
    const [p, free] = await Promise.all([probe(host, toPort(apiPort, 9001)), hostFreeBytes().catch(() => null)]);
    res.status(200).json({ success: true, probe: p, hostFreeBytes: free });
  } catch (e: any) {
    res.status(200).json({ success: false, error: e?.message || 'Probe failed', hostFreeBytes: await hostFreeBytes().catch(() => null) });
  }
}

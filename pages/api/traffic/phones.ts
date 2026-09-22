// Android phones plugged into the SimTool host over USB, and whether each has
// iperf3 at /data/local/tmp/iperf3 (needed for uplink and TCP tests).
import type { NextApiRequest, NextApiResponse } from 'next';
import { listPhones, PHONE_IPERF3 } from '@/modules/traffic/server/traffic.server';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const phones = await listPhones();
    res.status(200).json({ success: true, phones, iperf3Path: PHONE_IPERF3 });
  } catch (e: any) {
    const missing = e?.code === 'ENOENT';
    res.status(200).json({
      success: false,
      phones: [],
      iperf3Path: PHONE_IPERF3,
      error: missing ? 'adb is not installed on the SimTool host' : (e?.message || 'adb failed'),
    });
  }
}

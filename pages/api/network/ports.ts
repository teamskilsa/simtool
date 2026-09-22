// A callbox's ethernet ports, and changing one port's IPv4 address.
//   POST { action: 'list',   creds }                                → { ports }
//   POST { action: 'set',    creds, device, method, address, … }    → { checkpoint, rollbackAt, ports }
//   POST { action: 'commit', creds, checkpoint, keep: true|false }  → { ports }
import type { NextApiRequest, NextApiResponse } from 'next';
import { commitCheckpoint, listPorts, setIp } from '@/modules/network/server/ports.server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action, creds, checkpoint, keep, ...rest } = req.body ?? {};
  try {
    if (action === 'list') return res.status(200).json({ success: true, ports: await listPorts(creds) });
    if (action === 'set') return res.status(200).json({ success: true, ...(await setIp({ creds, ...rest })) });
    if (action === 'commit') {
      return res.status(200).json({ success: true, ports: await commitCheckpoint(creds, checkpoint, keep !== false) });
    }
    res.status(400).json({ success: false, error: 'action must be list, set or commit' });
  } catch (e: any) {
    res.status(200).json({ success: false, error: e?.message || 'Request failed' });
  }
}

// Inspect an Amarisoft tar on a remote system — returns what components, TRX
// drivers, licenses, version, and target arch are available.
// Called BEFORE the install step to auto-configure the install form.
import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';
import { parseTarListing } from '@/modules/sw-management/lib/inspectTar';
import type { TargetArch } from '@/modules/sw-management/types/detection';

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    host, port = 22, username, password, privateKey, passphrase,
    tarPath,            // Remote-path mode: we run `tar tzf` over SSH
    entries,            // Upload mode: client already parsed the tar locally
  } = req.body ?? {};

  if (!host || !username) return res.status(400).json({ error: 'host and username are required' });
  if (!password && !privateKey) return res.status(400).json({ error: 'password or privateKey is required' });
  if (!tarPath && !entries) return res.status(400).json({ error: 'tarPath or entries is required' });

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: String(host),
      port: Number(port),
      username: String(username),
      ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
      readyTimeout: 8000,
    });

    // Detect target arch (always done — whether input is path or pre-parsed)
    const archRes = await ssh.execCommand('uname -m');
    const machine = archRes.stdout.trim();
    let targetArch: TargetArch = 'unknown';
    if (machine === 'x86_64' || machine === 'amd64') targetArch = 'linux';
    else if (machine === 'aarch64' || machine === 'arm64') targetArch = 'aarch64';

    // ── Path A: Client provided pre-parsed entries (upload mode) ───────────
    if (Array.isArray(entries)) {
      const result = parseTarListing(entries as string[], targetArch);
      return res.status(200).json(result);
    }

    // ── Path B: Remote path on target — run `tar tzf` via SSH ──────────────
    const existsRes = await ssh.execCommand(`test -f '${tarPath}' && echo ok`);
    if (existsRes.stdout.trim() !== 'ok') {
      return res.status(200).json({
        success: false,
        error: `Tar not found at ${tarPath}`,
        components: [], trxDrivers: [], licenses: 0, targetArch,
      });
    }

    const listRes = await ssh.execCommand(`tar tzf '${tarPath}' 2>&1 | head -500`);
    if (listRes.code !== 0) {
      return res.status(200).json({
        success: false,
        error: `tar tzf failed: ${listRes.stderr || listRes.stdout}`.slice(-300),
        components: [], trxDrivers: [], licenses: 0, targetArch,
      });
    }

    const parsedEntries = listRes.stdout.split('\n').filter(Boolean);
    const result = parseTarListing(parsedEntries, targetArch);

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: err?.message || 'Inspection failed',
      components: [], trxDrivers: [], licenses: 0, targetArch: 'unknown',
    });
  } finally {
    ssh.dispose();
  }
}

// Inspect an Amarisoft tar on a remote system — returns what components, TRX
// drivers, licenses, version, and target arch are available.
// Called BEFORE the install step to auto-configure the install form.
import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';
import { parseTarListing } from '@/modules/sw-management/lib/inspectTar';
import type { DetectionResult, TargetArch } from '@/modules/sw-management/types/detection';
import { collectSystemState } from '@/modules/sw-management/server/systemState.server';

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    host, port = 22, username, password, privateKey, passphrase,
    tarPath,            // Remote-path mode: we run `tar tzf` over SSH
    entries,            // Upload mode: client already parsed the tar locally
  } = req.body ?? {};

  const hasCreds = !!username && !!(password || privateKey);
  if (!host) return res.status(400).json({ error: 'host is required' });
  if (!tarPath && !entries) return res.status(400).json({ error: 'tarPath or entries is required' });
  // Remote-path mode lists the tar over SSH, so it needs credentials. Upload
  // mode parsed the tar in the browser; SSH is only used to read the target's
  // current state, with the SimTool agent as a credential-less fallback.
  if (tarPath && !entries && !hasCreds) {
    return res.status(400).json({ error: 'username and password/privateKey are required to inspect a tar on the target (remote path mode)' });
  }

  const ssh = new NodeSSH();

  /**
   * Best-effort arch fallback for upload mode when the SSH probe fails.
   * Looks at the suffixed component tarballs in the package — if every
   * suffixed entry is `-aarch64-` we infer aarch64; if every suffixed
   * entry is `-linux-` we infer linux; mixed/none → 'unknown'. Lets
   * detection still produce something useful when SSH is broken.
   */
  const archFromEntries = (es: string[]): TargetArch => {
    let sawLinux = false, sawAarch = false;
    for (const f of es) {
      const base = f.split('/').pop() ?? '';
      if (!base.endsWith('.tar.gz')) continue;
      if (base.includes('-aarch64-')) sawAarch = true;
      else if (base.includes('-linux-')) sawLinux = true;
    }
    if (sawLinux && !sawAarch) return 'linux';
    if (sawAarch && !sawLinux) return 'aarch64';
    return 'unknown';
  };

  try {
    let targetArch: TargetArch = 'unknown';
    let sshOk = false;
    let sshError: string | undefined;
    try {
      if (!hasCreds) throw new Error('no SSH credentials stored for this system');
      await ssh.connect({
        host: String(host),
        port: Number(port),
        username: String(username),
        ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
        readyTimeout: 8000,
      });
      sshOk = true;
      const archRes = await ssh.execCommand('uname -m');
      const machine = archRes.stdout.trim();
      if (machine === 'x86_64' || machine === 'amd64') targetArch = 'linux';
      else if (machine === 'aarch64' || machine === 'arm64') targetArch = 'aarch64';
    } catch (e: any) {
      // Upload mode doesn't strictly need SSH — we already have the
      // entries and can guess arch from them. Remote-path mode does
      // need SSH (we run `tar tzf` over it), so re-throw there.
      if (!Array.isArray(entries)) throw e;
      sshError = e?.message || String(e);
    }

    /** Read-only snapshot of what the target runs now (SSH, else agent). */
    const withSystemState = async (result: DetectionResult): Promise<DetectionResult> => {
      const state = await collectSystemState({
        host: String(host),
        ssh: sshOk ? ssh : null,
        password: password ? String(password) : undefined,
        packageVersion: result.version,
      });
      if (!sshOk && sshError) state.error = `SSH unavailable (${sshError}) — ${state.ok ? 'state read via SimTool agent' : state.error}`;
      return { ...result, systemState: state };
    };

    // ── Path A: Client provided pre-parsed entries (upload mode) ───────────
    if (Array.isArray(entries)) {
      let archWarning: string | undefined;
      let result = parseTarListing(entries as string[], targetArch);
      result = await withSystemState(result);
      if (targetArch === 'unknown') {
        // No SSH: take the arch the agent read (/proc/sys/kernel/arch), else
        // guess from the package, and re-evaluate availability for it.
        const stateArch = result.systemState?.arch;
        targetArch = stateArch && stateArch !== 'unknown' ? stateArch : archFromEntries(entries as string[]);
        if (!stateArch || stateArch === 'unknown') archWarning = 'SSH probe failed — target arch guessed from package contents.';
        result = { ...parseTarListing(entries as string[], targetArch), systemState: result.systemState };
      }
      if (archWarning) result.warning = archWarning;
      return res.status(200).json(result);
    }

    // ── Path B: Remote path on target — run `tar tzf` via SSH ──────────────
    // Single-quote for the shell: a path containing ' must not break out.
    const qTar = `'${String(tarPath).replace(/'/g, `'\\''`)}'`;
    const existsRes = await ssh.execCommand(`test -f ${qTar} && echo ok`);
    if (existsRes.stdout.trim() !== 'ok') {
      return res.status(200).json({
        success: false,
        error: `Tar not found at ${tarPath}`,
        components: [], trxDrivers: [], licenses: 0, targetArch,
      });
    }

    // Drop doc/ entries BEFORE capping: component and TRX tarballs can be
    // listed after doc/ (amarisoft.2026-09-11.tar.gz has 570 entries and
    // trx_sdr-linux near the end), so a plain `head -500` hid them.
    const listRes = await ssh.execCommand(`tar tzf ${qTar} 2>&1 | grep -v '/doc/' | head -2000`);
    if (listRes.code !== 0) {
      return res.status(200).json({
        success: false,
        error: `tar tzf failed: ${listRes.stderr || listRes.stdout}`.slice(-300),
        components: [], trxDrivers: [], licenses: 0, targetArch,
      });
    }

    const parsedEntries = listRes.stdout.split('\n').filter(Boolean);
    const result = await withSystemState(parseTarListing(parsedEntries, targetArch));

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

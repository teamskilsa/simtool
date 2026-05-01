// Remove a specific license tag from a target's license_server.cfg.
//
// Usage from the UI: each entry in the License Status panel gets a
// "Remove" button next to it; clicking sends the tag (and the cfg path
// it was found in) here. We read the cfg, drop the matching block, and
// write it back. If the cfg ends up empty we remove the file entirely
// so a stale empty cfg doesn't confuse Amarisoft on next start.
//
// Useful when retiring a licensed component (e.g. you no longer need
// IMS so freeing up that tag-slot on the license server) or when fixing
// a mis-typed tag without reinstalling everything.
import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';

export const config = { api: { bodyParser: true } };

// license-deploy.ts mirrors the cfg into both /root/.simnovus and
// /root/.amarisoft. Removal needs to fan out to the same set so a
// stale entry doesn't linger in one location after the user deletes
// it from another. We keep the user-clicked cfgPath as the primary
// (it's where check-license found the entry) and union it with the
// standard mirror dirs for the rewrite.
const MIRROR_DIRS = ['/root/.simnovus', '/root/.amarisoft'] as const;

interface RemoveStep {
  name: string;
  ok: boolean;
  detail?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    host, port = 22, username, password, privateKey, passphrase,
    cfgPath, tag,
  } = req.body ?? {};

  if (!host || !username) return res.status(400).json({ error: 'host and username are required' });
  if (!password && !privateKey) return res.status(400).json({ error: 'password or privateKey is required' });
  if (!cfgPath) return res.status(400).json({ error: 'cfgPath is required' });
  if (!tag) return res.status(400).json({ error: 'tag is required' });

  const ssh = new NodeSSH();
  const steps: RemoveStep[] = [];

  try {
    await ssh.connect({
      host: String(host),
      port: Number(port),
      username: String(username),
      ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
      readyTimeout: 8000,
    });
    steps.push({ name: 'ssh-connect', ok: true });

    const pwd = password ? String(password) : '';
    const sudoPrefix = pwd
      ? `echo '${pwd.replace(/'/g, "'\\''")}' | sudo -S -p ''`
      : 'sudo';

    // Resolve the dir part of the user-clicked cfgPath (the cfg that
    // surfaced the tag in the License Status panel) and merge with the
    // canonical mirror dirs. Each gets the same edit so we don't leave
    // a stale entry in another mirror location.
    const cfgDir = cfgPath.replace(/\/[^/]+$/, '');
    const allDirs = Array.from(new Set([cfgDir, ...MIRROR_DIRS]));
    const allCfgPaths = allDirs.map((d) => `${d}/license_server.cfg`);

    // Read the user-clicked cfg as the source of truth for what to
    // keep. If the same tag also exists in another mirror dir but
    // its entries differ otherwise, we still rewrite all mirrors to
    // match the primary's "tag X removed" state — an inconsistency
    // between mirrors would mean the user already had drift, and
    // converging them to the primary's view is the right answer.
    const readRes = await ssh.execCommand(`${sudoPrefix} cat '${cfgPath}' 2>/dev/null`);
    if (readRes.code !== 0) {
      steps.push({ name: 'read-cfg', ok: false, detail: `Could not read ${cfgPath}` });
      return res.status(200).json({ success: false, steps, error: `${cfgPath} not found or unreadable` });
    }
    steps.push({ name: 'read-cfg', ok: true, detail: cfgPath });

    // Parse + filter blocks. We rebuild the cfg as the entries we want
    // to keep (everything whose tag != the target tag), serialised with
    // the same one-line format the deploy emits — keeps the file shape
    // stable across deploys and removes.
    const text = readRes.stdout;
    const blockRe = /license_server\s*:\s*\{([^}]*)\}\s*,?/g;
    const kept: string[] = [];
    let removedCount = 0;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(text)) !== null) {
      const inner = m[1];
      const tg = inner.match(/tag\s*:\s*"([^"]+)"/);
      if (tg && tg[1] === String(tag)) {
        removedCount++;
        continue;
      }
      const sa = inner.match(/server_addr\s*:\s*"([^"]+)"/);
      if (sa && tg) {
        kept.push(`license_server: {server_addr:"${sa[1]}",tag:"${tg[1]}"},`);
      }
    }

    if (removedCount === 0) {
      steps.push({ name: 'filter', ok: false, detail: `No entry matching tag="${tag}" found` });
      return res.status(200).json({
        success: false,
        steps,
        error: `No license_server entry with tag="${tag}" in ${cfgPath}`,
      });
    }
    steps.push({
      name: 'filter',
      ok: true,
      detail: `removed ${removedCount} entry(ies); ${kept.length} remaining`,
    });

    // Apply to every mirror cfg path. Two outcomes per path:
    //   • kept.length > 0 → rewrite cfg with remaining entries.
    //   • kept.length === 0 → remove the cfg (Amarisoft sees "no
    //     license-server config" rather than an empty file).
    //
    // We tolerate per-path failures (e.g. a mirror dir that's read-only
    // or missing the cfg) and surface them in the step detail so the
    // user knows which copies were touched.
    const results: { path: string; ok: boolean; detail: string }[] = [];

    if (kept.length === 0) {
      // Remove from each mirror path.
      for (const p of allCfgPaths) {
        const rm = await ssh.execCommand(`${sudoPrefix} rm -f '${p}'`);
        results.push({
          path: p,
          ok: rm.code === 0,
          detail: rm.code === 0 ? `${p} removed` : (rm.stderr || rm.stdout).slice(-200),
        });
      }
      steps.push({
        name: 'remove-empty-cfg',
        ok: results.every((r) => r.ok),
        detail: results.map((r) => `${r.ok ? '✓' : '✗'} ${r.detail}`).join(' | '),
      });
    } else {
      // Stage the new content once, fan out via sudo-cp.
      const newContent = kept.join('\n') + '\n';
      const encoded = Buffer.from(newContent).toString('base64');
      const tempRemote = `/tmp/license_server_${Date.now()}.cfg`;
      const writeTempRes = await ssh.execCommand(`echo '${encoded}' | base64 -d > '${tempRemote}'`);
      if (writeTempRes.code !== 0) {
        steps.push({ name: 'rewrite-cfg', ok: false, detail: writeTempRes.stderr.slice(-200) });
        return res.status(200).json({ success: false, steps, error: 'Failed to stage new cfg' });
      }
      for (const p of allCfgPaths) {
        const cp = await ssh.execCommand(
          `${sudoPrefix} cp '${tempRemote}' '${p}' && ${sudoPrefix} chmod 644 '${p}'`,
        );
        results.push({
          path: p,
          ok: cp.code === 0,
          detail: cp.code === 0 ? `${p} rewritten` : (cp.stderr || cp.stdout).slice(-200),
        });
      }
      await ssh.execCommand(`rm -f '${tempRemote}'`);
      steps.push({
        name: 'rewrite-cfg',
        ok: results.every((r) => r.ok),
        detail: `${kept.length} entry(ies) remaining; ` +
          results.map((r) => `${r.ok ? '✓' : '✗'} ${r.detail}`).join(' | '),
      });
    }

    const success = steps.every((s) => s.ok);
    return res.status(200).json({ success, steps });
  } catch (error: any) {
    return res.status(200).json({ success: false, error: error?.message || 'license-remove failed', steps });
  } finally {
    ssh.dispose();
  }
}

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

    // Read the cfg.
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

    // Two outcomes: either we still have entries (rewrite the cfg) or
    // we're empty (remove the file so Amarisoft sees no license-server
    // config rather than an empty one — different behaviour).
    if (kept.length === 0) {
      const rmRes = await ssh.execCommand(`${sudoPrefix} rm -f '${cfgPath}'`);
      steps.push({
        name: 'remove-empty-cfg',
        ok: rmRes.code === 0,
        detail: rmRes.code === 0 ? `${cfgPath} removed (no entries left)` : rmRes.stderr.slice(-200),
      });
    } else {
      // Write via /tmp + sudo cp, same pattern as license-deploy to
      // dodge the broken `echo | sudo tee` race.
      const newContent = kept.join('\n') + '\n';
      const encoded = Buffer.from(newContent).toString('base64');
      const tempRemote = `/tmp/license_server_${Date.now()}.cfg`;
      const writeTempRes = await ssh.execCommand(`echo '${encoded}' | base64 -d > '${tempRemote}'`);
      if (writeTempRes.code !== 0) {
        steps.push({ name: 'rewrite-cfg', ok: false, detail: writeTempRes.stderr.slice(-200) });
        return res.status(200).json({ success: false, steps, error: 'Failed to stage new cfg' });
      }
      const installRes = await ssh.execCommand(
        `${sudoPrefix} cp '${tempRemote}' '${cfgPath}' && ${sudoPrefix} chmod 644 '${cfgPath}' && rm -f '${tempRemote}'`,
      );
      steps.push({
        name: 'rewrite-cfg',
        ok: installRes.code === 0,
        detail: installRes.code === 0
          ? `${cfgPath} rewritten with ${kept.length} entry(ies)`
          : (installRes.stderr || installRes.stdout).slice(-200),
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

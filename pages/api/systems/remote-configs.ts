// Read Amarisoft config files from a remote callbox directly over SSH.
// This bypasses the agent entirely — the agent runs as a non-root user and
// cannot access /root/enb/config etc. SSH uses the configured credentials.
//
// POST /api/systems/remote-configs
//   Body (list):    { host, port, username, password|privateKey, module }
//   Body (content): { host, port, username, password|privateKey, module, filename }

import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';

// ── Module → Amarisoft config directory + file glob patterns ─────────────────
const MODULE_DIRS: Record<string, { dir: string; pattern: string }> = {
  enb:   { dir: '/root/enb/config',  pattern: '*.cfg' },
  gnb:   { dir: '/root/enb/config',  pattern: '*.cfg' },
  mme:   { dir: '/root/mme/config',  pattern: '*.cfg' },
  ims:   { dir: '/root/mme/config',  pattern: 'ims*.cfg' },
  ue:    { dir: '/root/ue/config',   pattern: '*.cfg' },
  ue_db: { dir: '/root/mme/config',  pattern: '*.db' },
};

// Shell-quote safely
function q(s: string) { return `'${String(s).replace(/'/g, "'\\''")}'`; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { host, port = 22, username, password, privateKey, passphrase, module, filename } = req.body ?? {};

  if (!host || !username) return res.status(400).json({ error: 'host and username are required' });
  if (!password && !privateKey) return res.status(400).json({ error: 'password or privateKey required' });
  if (!module) return res.status(400).json({ error: 'module is required' });

  const mapping = MODULE_DIRS[String(module)];
  if (!mapping) return res.status(400).json({ error: `Unknown module: ${module}` });

  /**
   * Bulk mode: take a list of filenames, return them all in one round-trip.
   * Used when importing a main cfg + its drb.cfg + sib*.asn dependencies.
   */
  const bulkFiles: string[] | undefined = Array.isArray(req.body?.bulkFiles) ? req.body.bulkFiles : undefined;

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: String(host),
      port: Number(port),
      username: String(username),
      ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
      readyTimeout: 8000,
    });

    // Build sudo prefix — needed if the SSH user isn't root (e.g. sysadmin)
    const pwd = password ? String(password) : '';
    const sudoPrefix = pwd ? `echo '${pwd.replace(/'/g, "'\\''")}' | sudo -S -p '' ` : 'sudo ';

    // ── Bulk mode: read N files in one round-trip ─────────────────────────
    if (bulkFiles && bulkFiles.length > 0) {
      const results: any[] = [];
      for (const f of bulkFiles) {
        const filePath = f.startsWith('/') ? f : `${mapping.dir}/${f}`;
        let catRes = await ssh.execCommand(`cat ${q(filePath)} 2>/dev/null`);
        if (catRes.code !== 0 || !catRes.stdout) {
          catRes = await ssh.execCommand(`${sudoPrefix}cat ${q(filePath)} 2>&1`);
        }
        if (catRes.code !== 0) {
          results.push({ name: f, path: filePath, error: catRes.stderr || catRes.stdout || 'not found' });
          continue;
        }
        let statOut = (await ssh.execCommand(`${sudoPrefix}stat -c '%Y %s' ${q(filePath)} 2>/dev/null`)).stdout.trim();
        const [mtimeStr, sizeStr] = (statOut || '0 0').split(' ');
        const mtime = new Date(parseInt(mtimeStr, 10) * 1000);
        results.push({
          name: f.split('/').pop() || f,
          path: filePath,
          content: catRes.stdout,
          modifiedAt: mtime.toISOString(),
          size: parseInt(sizeStr, 10) || 0,
        });
      }
      return res.status(200).json({ files: results });
    }

    if (filename) {
      // ── Read a single file ─────────────────────────────────────────────────
      const filePath = `${mapping.dir}/${String(filename)}`;

      // Try without sudo first; fall back to sudo for /root/* paths
      let catRes = await ssh.execCommand(`cat ${q(filePath)} 2>/dev/null`);
      if (catRes.code !== 0 || !catRes.stdout) {
        catRes = await ssh.execCommand(`${sudoPrefix}cat ${q(filePath)} 2>&1`);
      }
      if (catRes.code !== 0) {
        return res.status(404).json({ error: `Cannot read: ${filePath}`, detail: catRes.stdout || catRes.stderr });
      }

      // File stats via stat(1)
      let statOut = (await ssh.execCommand(`stat -c '%Y %s' ${q(filePath)} 2>/dev/null`)).stdout.trim();
      if (!statOut) {
        statOut = (await ssh.execCommand(`${sudoPrefix}stat -c '%Y %s' ${q(filePath)} 2>/dev/null`)).stdout.trim();
      }
      const [mtimeStr, sizeStr] = (statOut || '0 0').split(' ');
      const mtime = new Date(parseInt(mtimeStr, 10) * 1000);

      return res.status(200).json({
        name: String(filename),
        module,
        path: filePath,
        content: catRes.stdout,
        createdAt: mtime.toISOString(),
        modifiedAt: mtime.toISOString(),
        size: parseInt(sizeStr, 10) || 0,
      });
    } else {
      // ── List files in the config directory ────────────────────────────────
      // Use find + stat for reliable, parseable output regardless of locale/ls format
      const ext = mapping.pattern.replace('*', '');
      const findCmd = `find ${q(mapping.dir)} -maxdepth 1 -type f -name ${q('*' + ext)} -printf '%f\t%s\t%T@\n' 2>/dev/null | sort`;

      let findRes = await ssh.execCommand(findCmd);
      if (findRes.code !== 0 || !findRes.stdout.trim()) {
        // Retry with sudo (directory may require root)
        findRes = await ssh.execCommand(`${sudoPrefix}bash -c ${q(`find ${mapping.dir} -maxdepth 1 -type f -name '*${ext}' -printf '%f\\t%s\\t%T@\\n' 2>/dev/null | sort`)}`);
      }

      if (!findRes.stdout.trim()) {
        // Directory doesn't exist or no matching files — not an error
        return res.status(200).json([]);
      }

      const entries: any[] = [];
      for (const line of findRes.stdout.split('\n')) {
        const parts = line.trim().split('\t');
        if (parts.length < 2) continue;
        const [name, size, tsRaw] = parts;
        if (!name) continue;
        const mtime = tsRaw ? new Date(parseFloat(tsRaw) * 1000) : new Date();
        entries.push({
          id: name,
          name,
          module,
          path: `${mapping.dir}/${name}`,
          createdAt: mtime.toISOString(),
          modifiedAt: mtime.toISOString(),
          size: parseInt(size, 10) || 0,
        });
      }

      return res.status(200).json(entries);
    }
  } catch (error: any) {
    return res.status(503).json({ error: error?.message || 'SSH connection failed' });
  } finally {
    ssh.dispose();
  }
}

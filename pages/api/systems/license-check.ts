import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';

export const config = { api: { bodyParser: true } };

// Directories to search for license files (in priority order)
const LICENSE_DIRS = ['/root/.simnovus', '/root/.amarisoft', '/mnt/.simnovus'];
// Known license file names (one per Amarisoft product)
const LICENSE_FILES = ['lteenb.key', 'ltemme.key', 'lteue.key', 'lteims.key', 'ltembmsgw.key'];
// Fields we want to extract from the key file's tail (everything after the binary ciphering blob)
const LICENSE_FIELDS = [
  'host_id', 'product_id', 'product_ids', 'user_name', 'label',
  'ciphering', 'version', 'rat', 'ntn', 'bandwidth_max',
  'license_uid', 'dongle_id', 'expiry',
  'ue_nr', 'ue_nb', 'ue_lte', 'ue_max',
];

interface LicenseInfo {
  path: string;
  product: string;
  fields: Record<string, string>;
}

interface LicenseServerConfig {
  path: string;
  serverAddr: string;
  tag: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { host, port = 22, username, password, privateKey, passphrase } = req.body ?? {};
  if (!host || !username) return res.status(400).json({ error: 'host and username are required' });
  if (!password && !privateKey) return res.status(400).json({ error: 'password or privateKey is required' });

  const ssh = new NodeSSH();
  const licenses: LicenseInfo[] = [];
  const serverConfigs: LicenseServerConfig[] = [];
  const searchedDirs: { dir: string; exists: boolean }[] = [];

  try {
    await ssh.connect({
      host: String(host),
      port: Number(port),
      username: String(username),
      ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
      readyTimeout: 8000,
    });

    // Use sudo -S only if password is available (root-owned files)
    const pwd = password ? String(password) : '';
    const sudoPrefix = pwd ? `echo '${pwd.replace(/'/g, "'\\''")}' | sudo -S -p ''` : 'sudo';

    // Check each directory for license files
    for (const dir of LICENSE_DIRS) {
      const existsRes = await ssh.execCommand(`${sudoPrefix} test -d '${dir}' && echo yes`);
      const exists = existsRes.stdout.trim() === 'yes';
      searchedDirs.push({ dir, exists });
      if (!exists) continue;

      // List key files in this directory
      const lsRes = await ssh.execCommand(`${sudoPrefix} ls '${dir}' 2>/dev/null`);
      const files = lsRes.stdout.split('\n').map((s) => s.trim()).filter(Boolean);

      for (const file of files) {
        const fullPath = `${dir}/${file}`;

        // License keys — extract metadata
        if (LICENSE_FILES.includes(file) || file.endsWith('.key')) {
          const grepPattern = LICENSE_FIELDS.join('|');
          // Use `strings` to extract printable text, then grep for our fields
          const extractRes = await ssh.execCommand(
            `${sudoPrefix} strings '${fullPath}' 2>/dev/null | grep -E '^(${grepPattern})=' | head -40`
          );
          const fields: Record<string, string> = {};
          for (const line of extractRes.stdout.split('\n')) {
            const match = line.match(/^([a-z_]+)=(.*)$/);
            if (match) fields[match[1]] = match[2];
          }
          licenses.push({
            path: fullPath,
            product: fields.product_id || file.replace(/\.key$/, ''),
            fields,
          });
        }

        // License server config file. The cfg can contain multiple
        // license_server: { server_addr:"X", tag:"Y" } entries — one
        // per Amarisoft component being licensed (e.g. on a callbox you
        // typically have one each for cs-enb, cs-mme, cs-ims). The
        // older single-regex match returned only the first; we now
        // emit one serverConfig per entry so the UI can list/remove
        // them individually.
        if (file === 'license_server.cfg' || file.endsWith('.cfg')) {
          const catRes = await ssh.execCommand(`${sudoPrefix} cat '${fullPath}' 2>/dev/null`);
          const text = catRes.stdout;
          // Match each license_server: { ... } block; inside, pull
          // server_addr and tag. We tolerate any field order and
          // variable whitespace because hand-edited cfgs are common.
          const blockRe = /license_server\s*:\s*\{([^}]*)\}/g;
          let m: RegExpExecArray | null;
          let matched = false;
          while ((m = blockRe.exec(text)) !== null) {
            matched = true;
            const inner = m[1];
            const sa = inner.match(/server_addr\s*:\s*"([^"]+)"/);
            const tg = inner.match(/tag\s*:\s*"([^"]+)"/);
            if (sa) {
              serverConfigs.push({
                path: fullPath,
                serverAddr: sa[1],
                tag: tg ? tg[1] : '',
              });
            }
          }
          // Fallback: cfg without `{...}` blocks (rare, but seen on
          // some hand-rolled installs) — keep the legacy single-match
          // behaviour so we don't silently drop them.
          if (!matched) {
            const sa = text.match(/server_addr\s*:\s*"([^"]+)"/);
            const tg = text.match(/tag\s*:\s*"([^"]+)"/);
            if (sa) {
              serverConfigs.push({
                path: fullPath,
                serverAddr: sa[1],
                tag: tg ? tg[1] : '',
              });
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      searchedDirs,
      licenses,
      serverConfigs,
      found: licenses.length > 0 || serverConfigs.length > 0,
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: error?.message || 'License check failed',
      searchedDirs,
      licenses,
      serverConfigs,
    });
  } finally {
    ssh.dispose();
  }
}

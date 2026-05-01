import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs/promises';
import * as os from 'os';
import formidable from 'formidable';

export const config = { api: { bodyParser: false } };

type DeployMode = 'system' | 'server' | 'dongle';

interface DeployStep {
  name: string;
  ok: boolean;
  detail?: string;
}

async function parseRequest(req: NextApiRequest): Promise<{
  fields: Record<string, string>;
  filePath?: string;
  fileName?: string;
}> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10 MB — license files are tiny
      uploadDir: os.tmpdir(),
      keepExtensions: true,
    });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields)) {
        flat[k] = Array.isArray(v) ? v[0] : String(v);
      }
      const file = files.file;
      const uploaded = Array.isArray(file) ? file[0] : file;
      resolve({ fields: flat, filePath: uploaded?.filepath, fileName: uploaded?.originalFilename || undefined });
    });
  });
}

// Standard Amarisoft license directories that simtool ALWAYS mirrors
// the cfg/key into. Different installs / daemons look in different
// places — Amarisoft 2024+ uses /root/.amarisoft by default, older /
// Simnovus-branded packages used /root/.simnovus. Writing to both
// removes the "is the daemon looking somewhere else?" guesswork from
// the user's lap.
const MIRROR_DIRS = ['/root/.simnovus', '/root/.amarisoft'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let parsed;
  try {
    parsed = await parseRequest(req);
  } catch (e: any) {
    return res.status(400).json({ error: `Invalid request: ${e?.message}` });
  }
  const { fields, filePath: uploadedFile, fileName } = parsed;

  const {
    host, port = '22', username, password, privateKey, passphrase,
    mode, targetDir = '/root/.simnovus',
    serverAddr, tag,
  } = fields;

  if (!host || !username) return res.status(400).json({ error: 'host and username are required' });
  if (!password && !privateKey) return res.status(400).json({ error: 'password or privateKey is required' });
  if (!mode) return res.status(400).json({ error: 'mode is required (system | server | dongle)' });

  const ssh = new NodeSSH();
  const steps: DeployStep[] = [];

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
    const escapedPwd = pwd.replace(/'/g, "'\\''");
    const sudoPrefix = pwd ? `echo '${escapedPwd}' | sudo -S -p ''` : 'sudo';

    // Always mirror to /root/.simnovus AND /root/.amarisoft, plus the
    // user-selected targetDir if it's something else (e.g. /mnt/.simnovus
    // on appliances with separate root partitioning). Deduped to avoid
    // double-writes when the user picks one of the standard dirs.
    const allDirs = Array.from(new Set([targetDir, ...MIRROR_DIRS]));

    // Ensure each target dir exists.
    for (const d of allDirs) {
      const mkdirRes = await ssh.execCommand(`${sudoPrefix} mkdir -p '${d}'`);
      steps.push({ name: 'mkdir-target', ok: mkdirRes.code === 0, detail: d });
      if (mkdirRes.code !== 0) {
        return res.status(200).json({ success: false, steps, error: `Could not create ${d}` });
      }
    }

    const deployMode = mode as DeployMode;

    if (deployMode === 'system') {
      // Upload .key file
      if (!uploadedFile || !fileName) {
        return res.status(400).json({ error: 'file is required for system mode' });
      }
      const remoteTmp = `/tmp/${fileName}`;
      await ssh.putFile(uploadedFile, remoteTmp);
      steps.push({ name: 'scp-upload', ok: true, detail: remoteTmp });

      // Copy the key to every mirror dir, then remove the staging file.
      // Using cp (not mv) preserves the staged copy until all dirs have
      // it; the final rm cleans up. If any cp fails we surface that
      // dir's error but still try the rest — partial install is better
      // than no install.
      const installResults: { dir: string; ok: boolean; detail: string }[] = [];
      for (const d of allDirs) {
        const dst = `${d}/${fileName}`;
        const r = await ssh.execCommand(
          `${sudoPrefix} cp '${remoteTmp}' '${dst}' && ${sudoPrefix} chmod 644 '${dst}'`,
        );
        installResults.push({
          dir: d,
          ok: r.code === 0,
          detail: r.code === 0 ? dst : (r.stderr || r.stdout).slice(-200),
        });
      }
      await ssh.execCommand(`rm -f '${remoteTmp}'`);
      const allOk = installResults.every((x) => x.ok);
      steps.push({
        name: 'install-key',
        ok: allOk,
        detail: installResults.map((x) => `${x.ok ? '✓' : '✗'} ${x.detail}`).join(' | '),
      });

      await fs.unlink(uploadedFile).catch(() => {});
    } else if (deployMode === 'server') {
      // Write license_server.cfg. Supports either:
      //   • Single tag — legacy `tag` field (back-compat with old UI)
      //   • Multiple tags — new `tags` field, JSON array of strings
      // For Callbox a typical multi-tag deploy is ['cs-enb','cs-mme','cs-ims'];
      // for UESim it's just ['cs-ue']. Each becomes its own
      //   license_server: {server_addr:"X",tag:"Y"},
      // line in the cfg (Amarisoft's parser accepts repeated entries).
      if (!serverAddr) {
        return res.status(400).json({ error: 'serverAddr is required for server mode' });
      }
      let tagList: string[] = [];
      if (fields.tags) {
        try {
          const parsed = JSON.parse(fields.tags);
          if (Array.isArray(parsed)) tagList = parsed.map(String).filter((t) => t.trim());
        } catch {
          return res.status(400).json({ error: 'tags must be a JSON array of strings' });
        }
      } else if (tag) {
        tagList = [String(tag).trim()].filter(Boolean);
      }
      if (tagList.length === 0) {
        return res.status(400).json({ error: 'at least one tag is required for server mode' });
      }
      const cfgContent = tagList
        .map((t) => `license_server: {server_addr:"${serverAddr}",tag:"${t}"},`)
        .join('\n') + '\n';

      // Stage the cfg in /tmp, then sudo-cp it into every mirror dir.
      // /tmp is user-writable so we don't need sudo for the stage; the
      // base64 encode-then-decode dodges the broken `echo | sudo tee`
      // pattern that ate trailing content on previous attempts.
      const tempRemote = `/tmp/license_server_${Date.now()}.cfg`;
      const encoded = Buffer.from(cfgContent).toString('base64');
      const writeTempRes = await ssh.execCommand(`echo '${encoded}' | base64 -d > '${tempRemote}'`);
      if (writeTempRes.code !== 0) {
        steps.push({ name: 'write-server-config', ok: false, detail: writeTempRes.stderr.slice(-200) });
      } else {
        // Fan out to every mirror dir. Same staged-cfg, copied N times
        // — guarantees the daemons find it regardless of which
        // location their build looks in (.simnovus vs .amarisoft).
        const writeResults: { path: string; ok: boolean; detail: string }[] = [];
        for (const d of allDirs) {
          const cfgPath = `${d}/license_server.cfg`;
          const r = await ssh.execCommand(
            `${sudoPrefix} cp '${tempRemote}' '${cfgPath}' && ${sudoPrefix} chmod 644 '${cfgPath}'`,
          );
          writeResults.push({
            path: cfgPath,
            ok: r.code === 0,
            detail: r.code === 0 ? cfgPath : (r.stderr || r.stdout).slice(-200),
          });
        }
        await ssh.execCommand(`rm -f '${tempRemote}'`);
        const allOk = writeResults.every((x) => x.ok);
        steps.push({
          name: 'write-server-config',
          ok: allOk,
          detail: allOk
            ? `${writeResults.map((x) => x.path).join(', ')} → ${serverAddr} [${tagList.join(', ')}]`
            : writeResults.map((x) => `${x.ok ? '✓' : '✗'} ${x.detail}`).join(' | '),
        });
      }
    } else if (deployMode === 'dongle') {
      // Dongle-based — just verify the USB dongle is present
      const dongleRes = await ssh.execCommand(
        `lsusb 2>/dev/null | grep -iE '(aladdin|sentinel|hasp|dongle|safenet)' || ${sudoPrefix} lsusb 2>/dev/null | grep -iE '(aladdin|sentinel|hasp|dongle|safenet)'`
      );
      const dongleFound = dongleRes.stdout.trim().length > 0;
      steps.push({
        name: 'detect-dongle',
        ok: dongleFound,
        detail: dongleFound
          ? dongleRes.stdout.trim().split('\n')[0]
          : 'No USB license dongle detected. Plug in the dongle and retry.',
      });
    }

    // Verify each mirror dir got the file. We tolerate dongle mode
    // here (no files to verify) and report the summary so the user
    // sees one line per dir in the deploy log.
    if (deployMode !== 'dongle') {
      const verifyParts: string[] = [];
      let anyMissing = false;
      for (const d of allDirs) {
        const verifyRes = await ssh.execCommand(`${sudoPrefix} ls -la '${d}' 2>/dev/null | head -8`);
        const ok = verifyRes.code === 0 && verifyRes.stdout.trim().length > 0;
        if (!ok) anyMissing = true;
        verifyParts.push(`[${d}] ${verifyRes.stdout.trim().slice(-200)}`);
      }
      steps.push({
        name: 'verify',
        ok: !anyMissing,
        detail: verifyParts.join('\n'),
      });
    }

    const success = steps.every((s) => s.ok);
    return res.status(200).json({ success, steps });
  } catch (error: any) {
    return res.status(200).json({ success: false, error: error?.message || 'License deploy failed', steps });
  } finally {
    ssh.dispose();
  }
}

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

    // Ensure target directory exists
    const mkdirRes = await ssh.execCommand(`${sudoPrefix} mkdir -p '${targetDir}'`);
    steps.push({ name: 'mkdir-target', ok: mkdirRes.code === 0, detail: targetDir });
    if (mkdirRes.code !== 0) {
      return res.status(200).json({ success: false, steps, error: `Could not create ${targetDir}` });
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

      // Move to target dir with sudo, fix ownership/perms
      const mvRes = await ssh.execCommand(
        `${sudoPrefix} mv '${remoteTmp}' '${targetDir}/${fileName}' && ${sudoPrefix} chmod 644 '${targetDir}/${fileName}'`
      );
      steps.push({
        name: 'install-key',
        ok: mvRes.code === 0,
        detail: mvRes.code === 0 ? `${targetDir}/${fileName}` : mvRes.stderr.slice(-200),
      });

      await fs.unlink(uploadedFile).catch(() => {});
    } else if (deployMode === 'server') {
      // Write license_server.cfg with server_addr and tag
      if (!serverAddr || !tag) {
        return res.status(400).json({ error: 'serverAddr and tag are required for server mode' });
      }
      const cfgContent = `license_server: {server_addr:"${serverAddr}",tag:"${tag}"},\n`;
      const cfgPath = `${targetDir}/license_server.cfg`;

      // Write to a temp file as the SSH user first (no pipeline conflict with sudo),
      // then sudo-move it to the target directory. This avoids the broken pipeline
      // `echo content | echo pwd | sudo tee` which ate the content.
      const tempRemote = `/tmp/license_server_${Date.now()}.cfg`;
      const encoded = Buffer.from(cfgContent).toString('base64');

      // Step A: write the temp file (no sudo needed — /tmp is writable)
      const writeTempRes = await ssh.execCommand(`echo '${encoded}' | base64 -d > '${tempRemote}'`);
      if (writeTempRes.code !== 0) {
        steps.push({ name: 'write-server-config', ok: false, detail: writeTempRes.stderr.slice(-200) });
      } else {
        // Step B: sudo-move the temp file to the target
        const installRes = await ssh.execCommand(
          `${sudoPrefix} cp '${tempRemote}' '${cfgPath}' && ${sudoPrefix} chmod 644 '${cfgPath}' && rm -f '${tempRemote}'`
        );
        steps.push({
          name: 'write-server-config',
          ok: installRes.code === 0,
          detail: installRes.code === 0
            ? `${cfgPath} → ${serverAddr} (${tag})`
            : (installRes.stderr || installRes.stdout).slice(-200),
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

    // Verify by listing the target dir
    const verifyRes = await ssh.execCommand(`${sudoPrefix} ls -la '${targetDir}' 2>/dev/null`);
    steps.push({
      name: 'verify',
      ok: verifyRes.code === 0,
      detail: verifyRes.stdout.trim().slice(-400),
    });

    const success = steps.every((s) => s.ok);
    return res.status(200).json({ success, steps });
  } catch (error: any) {
    return res.status(200).json({ success: false, error: error?.message || 'License deploy failed', steps });
  } finally {
    ssh.dispose();
  }
}

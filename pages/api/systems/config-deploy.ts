// Deploy a generated config file to a remote system and restart the Amarisoft service.
// Used by the test execution flow: write config → restart service → verify port.
import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

// ── Module → remote config path + service name + verification port ───────────
const MODULE_MAP: Record<string, { configPath: string; service: string; checkPort: number }> = {
  enb:   { configPath: '/root/enb/config/enb.cfg',   service: 'lte',    checkPort: 9001 },
  mme:   { configPath: '/root/mme/config/mme.cfg',   service: 'ltemme', checkPort: 9000 },
  ue:    { configPath: '/root/ue/config/ue.cfg',      service: 'lteue',  checkPort: 9002 },
  ue_db: { configPath: '/root/mme/config/ue_db.cfg',  service: '',       checkPort: 0    },
};

// Shell-quote a single string value safely
function q(s: string): string {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    host, port = 22, username, password, privateKey, passphrase,
    module, configContent,
  } = req.body ?? {};

  if (!host || !username) return res.status(400).json({ error: 'host and username are required' });
  if (!password && !privateKey) return res.status(400).json({ error: 'password or privateKey is required' });
  if (!module) return res.status(400).json({ error: 'module is required' });
  if (configContent === undefined) return res.status(400).json({ error: 'configContent is required' });

  const mapping = MODULE_MAP[module];
  if (!mapping) return res.status(400).json({ error: `Unknown module: ${module}` });

  // Write config to a local temp file so we can SCP it cleanly (no shell quoting issues)
  const localTmp = path.join(os.tmpdir(), `simtool-cfg-${Date.now()}.cfg`);
  await fs.writeFile(localTmp, String(configContent), 'utf8');

  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host: String(host),
      port: Number(port),
      username: String(username),
      ...(privateKey
        ? { privateKey: String(privateKey), passphrase }
        : { password: String(password) }),
      readyTimeout: 10000,
    });

    const pwd = password ? String(password) : '';
    const escapedPwd = pwd.replace(/'/g, "'\\''");
    const sudo = pwd ? `echo '${escapedPwd}' | sudo -S -p ''` : 'sudo';

    // 1. SCP to a user-writable temp path, then sudo mv to destination
    const remoteTmp = `/tmp/simtool-cfg-${Date.now()}.cfg`;
    await ssh.putFile(localTmp, remoteTmp);
    await fs.unlink(localTmp).catch(() => {});

    const mvRes = await ssh.execCommand(
      `${sudo} mv ${q(remoteTmp)} ${q(mapping.configPath)} && echo ok || echo fail`
    );
    if (mvRes.stdout.trim() !== 'ok') {
      return res.status(200).json({
        copySuccess: false,
        copyMessage: `Failed to write to ${mapping.configPath}: ${mvRes.stderr || mvRes.stdout}`,
        restartSuccess: false,
        portStatus: false,
        output: mvRes.stderr || '',
      });
    }

    const copyMessage = `Config written to ${mapping.configPath}`;

    // 2. Restart service (skip for ue_db — loaded at runtime by MME)
    let restartSuccess = true;
    let restartError: string | undefined;
    let output = '';

    if (mapping.service) {
      const restartRes = await ssh.execCommand(
        `${sudo} systemctl restart ${mapping.service} 2>&1 || ${sudo} service ${mapping.service} restart 2>&1`
      );
      output = (restartRes.stdout + '\n' + restartRes.stderr).trim().slice(-500);
      restartSuccess = restartRes.code === 0;
      if (!restartSuccess) restartError = output || `Failed to restart ${mapping.service}`;
    }

    // 3. Poll until port is listening (up to ~10 s)
    let portStatus = false;
    if (mapping.checkPort > 0 && restartSuccess) {
      for (let i = 0; i < 5; i++) {
        const portRes = await ssh.execCommand(
          `ss -ltn | grep -q ':${mapping.checkPort} ' && echo open || echo closed`
        );
        if (portRes.stdout.trim() === 'open') { portStatus = true; break; }
        if (i < 4) await new Promise(r => setTimeout(r, 2000));
      }
    } else if (mapping.checkPort === 0) {
      portStatus = true; // ue_db has no port to check
    }

    return res.status(200).json({
      copySuccess: true,
      copyMessage,
      restartSuccess,
      restartError,
      portStatus,
      output,
    });
  } catch (error: any) {
    await fs.unlink(localTmp).catch(() => {});
    return res.status(200).json({
      copySuccess: false,
      copyMessage: error?.message || 'SSH connection failed',
      restartSuccess: false,
      portStatus: false,
      output: '',
    });
  } finally {
    ssh.dispose();
  }
}

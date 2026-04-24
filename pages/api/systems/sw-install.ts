import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs/promises';
import * as os from 'os';
import formidable from 'formidable';

export const config = { api: { bodyParser: false, responseLimit: false } };

interface InstallStep {
  name: string;
  ok: boolean;
  detail?: string;
}

// Map TRX driver name to the numeric option in Amarisoft install.sh
const TRX_OPTION_MAP: Record<string, string> = {
  sdr: '1', n2x0: '2', b2x0: '3', x3x0: '4', n3x0: '5', s72: '6',
};

async function parseRequest(req: NextApiRequest): Promise<{
  fields: Record<string, string>;
  filePath?: string;
}> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 2 * 1024 * 1024 * 1024,
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
      resolve({ fields: flat, filePath: uploaded?.filepath });
    });
  });
}

/**
 * Build the answer stream for Amarisoft install.sh based on user selections.
 * Questions are asked in this order (from the real script):
 *   1. Install LTE automatic service? [Yn]
 *      if y: package install [Yn], enable service? [Yn], NAT IPv4? [Yn], IPv6? [Yn]
 *   2. Install EPC? [Yn]
 *      if y: package install [Yn], install IMS? [Yn], install sim server? [yN]
 *   3. Install eNB? [Yn]
 *      if y: package install [Yn] (conditional), TRX selection (1-6), MIMO? [Yn]
 *   4. Install UE simulator? [yN]
 *   5. Install Satellite utilities? [yN]
 *   6. Install MBMS gateway? [Yn]
 *      if y: package install [Yn]
 *   7. Install Web interface? [Yn]
 *      if y: package install [Yn]
 *   8. Install license server? [yN]
 */
function buildAnswerStream(opts: {
  components: any;
  trxDriver: string;
  mimo: boolean;
  useNat: boolean;
  useIPv6: boolean;
}): string {
  const { components: c, trxDriver, mimo, useNat, useIPv6 } = opts;
  const answers: string[] = [];
  const yn = (b: boolean) => (b ? 'y' : 'n');

  // 1. LTE automatic service
  answers.push(yn(c.ltService));
  if (c.ltService) {
    answers.push('y'); // accept package install (screen, zlib)
    answers.push(yn(c.ltServiceEnable));
    answers.push(yn(useNat));
    answers.push(yn(useIPv6));
  }

  // 2. EPC
  answers.push(yn(c.epc));
  if (c.epc) {
    answers.push('y'); // accept lksctp-tools
    answers.push(yn(c.ims));
    answers.push(yn(c.simServer));
  }

  // 3. eNB
  answers.push(yn(c.enb));
  if (c.enb) {
    // Package prompt only fires if lksctp wasn't already installed above
    if (!c.epc) answers.push('y');
    // TRX selection
    answers.push(TRX_OPTION_MAP[trxDriver] || '1');
    answers.push(yn(mimo));
  }

  // 4. UE simulator
  answers.push(yn(c.ueSimulator));

  // 5. Satellite
  answers.push(yn(c.satellite));

  // 6. MBMS
  answers.push(yn(c.mbms));
  if (c.mbms) answers.push('y'); // accept package install

  // 7. Web interface
  answers.push(yn(c.webInterface));
  if (c.webInterface) answers.push('y'); // accept apache, php package install

  // 8. License server
  answers.push(yn(c.licenseServer));

  return answers.join('\n') + '\n';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let parsed;
  try {
    parsed = await parseRequest(req);
  } catch (e: any) {
    return res.status(400).json({ error: `Invalid request: ${e?.message}` });
  }
  const { fields, filePath: uploadedFile } = parsed;

  const {
    host, port = '22', username, password, privateKey, passphrase,
    source, remotePath, trxDriver = 'sdr', ruIpAddress,
  } = fields;

  if (!host || !username) return res.status(400).json({ error: 'host and username are required' });
  if (!password && !privateKey) return res.status(400).json({ error: 'password or privateKey is required' });
  if (source === 'remote-path' && !remotePath) return res.status(400).json({ error: 'remotePath is required' });
  if (source === 'upload' && !uploadedFile) return res.status(400).json({ error: 'no file uploaded' });

  // Parse components + booleans from form fields (they come as strings)
  const components = {
    enb: fields.enb === 'true',
    epc: fields.epc === 'true',
    ims: fields.ims === 'true',
    simServer: fields.simServer === 'true',
    mbms: fields.mbms === 'true',
    ueSimulator: fields.ueSimulator === 'true',
    satellite: fields.satellite === 'true',
    webInterface: fields.webInterface === 'true',
    licenseServer: fields.licenseServer === 'true',
    ltService: fields.ltService === 'true',
    ltServiceEnable: fields.ltServiceEnable === 'true',
  };
  const mimo = fields.mimo === 'true';
  const useNat = fields.useNat === 'true';
  const useIPv6 = fields.useIPv6 === 'true';

  const steps: InstallStep[] = [];
  let installLog = '';
  const ssh = new NodeSSH();

  try {
    // Step 1: SSH connect
    await ssh.connect({
      host: String(host),
      port: Number(port),
      username: String(username),
      ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
      readyTimeout: 10000,
    });
    steps.push({ name: 'ssh-connect', ok: true });

    // Step 2: Upload file if needed
    let tarPath = remotePath || '';
    if (source === 'upload' && uploadedFile) {
      const remoteTmp = `/tmp/amarisoft-upload-${Date.now()}.tar.gz`;
      await ssh.putFile(uploadedFile, remoteTmp);
      tarPath = remoteTmp;
      steps.push({ name: 'scp-upload', ok: true, detail: remoteTmp });
    }

    // Step 3: Verify tar exists
    const verifyRes = await ssh.execCommand(`test -f '${tarPath}' && echo ok`);
    if (verifyRes.stdout.trim() !== 'ok') {
      steps.push({ name: 'verify-tar', ok: false, detail: `File not found: ${tarPath}` });
      return res.status(200).json({ success: false, steps, error: `Tar file not found at ${tarPath}` });
    }
    steps.push({ name: 'verify-tar', ok: true, detail: tarPath });

    // Step 4: Create workspace
    const mkdirRes = await ssh.execCommand('mktemp -d /tmp/amarisoft-install-XXXXX');
    const workspace = mkdirRes.stdout.trim();
    if (!workspace || mkdirRes.code !== 0) {
      steps.push({ name: 'create-workspace', ok: false, detail: mkdirRes.stderr });
      return res.status(200).json({ success: false, steps, error: 'Failed to create workspace' });
    }
    steps.push({ name: 'create-workspace', ok: true, detail: workspace });

    // Step 5: Extract main archive
    const extractRes = await ssh.execCommand(`tar xf '${tarPath}' -C '${workspace}'`);
    if (extractRes.code !== 0) {
      steps.push({ name: 'extract-main', ok: false, detail: extractRes.stderr });
      return res.status(200).json({ success: false, steps, error: 'Failed to extract archive' });
    }
    steps.push({ name: 'extract-main', ok: true });

    // Step 6: Locate install.sh (usually inside a versioned subdirectory)
    const findRes = await ssh.execCommand(`find '${workspace}' -maxdepth 3 -name 'install.sh' -type f | head -1`);
    const installScript = findRes.stdout.trim();
    if (!installScript) {
      steps.push({ name: 'locate-installer', ok: false, detail: 'install.sh not found in archive' });
      return res.status(200).json({ success: false, steps, error: 'install.sh not found in extracted archive' });
    }
    steps.push({ name: 'locate-installer', ok: true, detail: installScript });

    // Step 7: Run install.sh with piped answers (requires sudo/root)
    const answerStream = buildAnswerStream({ components, trxDriver, mimo, useNat, useIPv6 });
    const installDir = installScript.replace(/\/install\.sh$/, '');

    // Write answers to a heredoc file on the remote, then pipe to install.sh
    // Using a file avoids shell escaping issues with the newlines
    const answerFile = `${workspace}/install-answers.txt`;
    const encodedAnswers = Buffer.from(answerStream).toString('base64');
    await ssh.execCommand(`echo '${encodedAnswers}' | base64 -d > '${answerFile}'`);

    // Run install.sh as root via sudo -i (login shell — needed for proper PATH/env).
    // Password is sent first to sudo's stdin, then the install answers flow in.
    // This avoids the conflict of piping password AND redirecting stdin.
    const passwordForSudo = password ? String(password) : '';
    const escapedPwd = passwordForSudo.replace(/'/g, "'\\''");
    const escapedInstallDir = installDir.replace(/'/g, "'\\''");
    const escapedAnswerFile = answerFile.replace(/'/g, "'\\''");

    // (echo password; cat answers) | sudo -S -i bash -c "cd dir && bash install.sh"
    // sudo consumes the first line for auth, then the rest becomes stdin for install.sh
    const installCmd = passwordForSudo
      ? `(echo '${escapedPwd}'; cat '${escapedAnswerFile}') | sudo -S -i -p '' bash -c "cd '${escapedInstallDir}' && bash install.sh" 2>&1`
      : `sudo -i bash -c "cd '${escapedInstallDir}' && bash install.sh < '${escapedAnswerFile}'" 2>&1`;

    const installRes = await ssh.execCommand(installCmd, { execOptions: { pty: false } });
    installLog = (installRes.stdout + '\n' + installRes.stderr).slice(-4000); // last 4KB
    const installOk = installRes.code === 0;
    steps.push({
      name: 'run-installer',
      ok: installOk,
      detail: installOk ? 'install.sh completed' : `exit code ${installRes.code}. See log below.`,
    });

    // Step 8: If s72 (DU) selected, note RU IP config needed
    if (trxDriver === 's72' && ruIpAddress) {
      steps.push({
        name: 'note-trx-ip',
        ok: true,
        detail: `DU mode selected. Update /root/enb/config/<cfg>.cfg rf_driver to: { name: "ip", trx_ip: "${ruIpAddress}" }`,
      });
    }

    // Step 9: Restart service (if installed)
    if (components.ltService && installOk) {
      const restartSudo = passwordForSudo
        ? `echo '${escapedPwd}' | sudo -S -p ''`
        : 'sudo';
      const restartRes = await ssh.execCommand(
        `${restartSudo} service lte restart 2>&1 || ${restartSudo} systemctl restart lte 2>&1`
      );
      steps.push({
        name: 'restart-service',
        ok: restartRes.code === 0,
        detail: restartRes.code === 0 ? 'LTE service restarted' : (restartRes.stdout || restartRes.stderr).slice(-200),
      });
    }

    // Step 10: Cleanup workspace
    await ssh.execCommand(`rm -rf '${workspace}'`);
    steps.push({ name: 'cleanup', ok: true });

    // Cleanup uploaded temp file
    if (source === 'upload' && uploadedFile) {
      await fs.unlink(uploadedFile).catch(() => {});
    }

    const criticalStepsOk = steps
      .filter((s) => ['ssh-connect', 'extract-main', 'locate-installer', 'run-installer'].includes(s.name))
      .every((s) => s.ok);

    return res.status(200).json({ success: criticalStepsOk, steps, installLog });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: error?.message || 'Installation failed',
      steps,
      installLog,
    });
  } finally {
    ssh.dispose();
  }
}

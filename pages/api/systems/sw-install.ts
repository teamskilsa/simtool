// Run the Amarisoft installer non-interactively using the install.sh CLI flags.
// The new approach: build a --<comp> / --no-<comp> / --trx / --target command line
// based on what the user selected (after auto-detection). No more fragile
// answer-stream piping.
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

// Shell-quote a single value safely for inclusion in a command line.
function q(s: string | undefined | null): string {
  if (s === undefined || s === null) return "''";
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

/** Build the install.sh CLI from user selections + detected components.
 *
 * Key constraint: install.sh validates every --[no-]<comp> flag against its
 * runtime COMP_LIST (which only contains components available for the target
 * arch). Passing --no-ue on a linux-only package that has no lteue-linux
 * causes install.sh to print usage() and exit 1.
 *
 * Solution: use --no-all to disable everything, then only add --<comp> for
 * each component the user explicitly enabled. Never emit --no-<comp>.
 */
function buildInstallCmd(opts: {
  installScript: string;      // absolute remote path to install.sh
  components: Record<string, boolean>;  // id → install?
  trx?: string;
  targetArch?: string;        // 'aarch64' | 'linux' | undefined
  mimo?: boolean;
  nat?: boolean;
  ipv6?: boolean;
  autostart?: boolean;
  licenseUpdate?: boolean;
}): string {
  const flags: string[] = [
    '--default',  // use built-in defaults for anything we don't set explicitly
    '--no-all',   // disable all components first; we'll re-enable the ones the user picked
  ];

  // Only emit --<comp> for things the user enabled.
  // Never emit --no-<comp>: components absent from the target-arch COMP_LIST
  // cause install.sh to print usage() and exit 1.
  for (const [id, on] of Object.entries(opts.components)) {
    if (on) flags.push(`--${id}`);
  }

  // TRX driver (only if the user picked one — install.sh validates against TRX_FE)
  if (opts.trx) flags.push('--trx', q(opts.trx));

  // NOTE: --target is intentionally omitted. install.sh auto-detects arch via
  // `uname -m` in ExpandArgs. Passing --target causes "Invalid argument" in
  // ParseArgs on some package versions because it isn't registered there.

  // Feature flags — these are always valid regardless of COMP_LIST
  if (opts.mimo !== undefined) flags.push(opts.mimo ? '--mimo' : '--no-mimo');
  if (opts.nat  !== undefined) flags.push(opts.nat  ? '--nat'  : '--no-nat');
  if (opts.ipv6 !== undefined) flags.push(opts.ipv6 ? '--ipv6' : '--no-ipv6');
  if (opts.autostart !== undefined) flags.push(opts.autostart ? '--srv' : '--no-srv');
  if (opts.licenseUpdate === false) flags.push('--no-license-update');

  // Don't prompt for removal of old versions
  flags.push('--no-clean');

  return `bash ${q(opts.installScript)} ${flags.join(' ')}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let parsed;
  try { parsed = await parseRequest(req); }
  catch (e: any) { return res.status(400).json({ error: `Invalid request: ${e?.message}` }); }

  const { fields, filePath: uploadedFile } = parsed;

  const {
    host, port = '22', username, password, privateKey, passphrase,
    source, remotePath, installScript,
    trxDriver, targetArch,
  } = fields;

  if (!host || !username) return res.status(400).json({ error: 'host and username are required' });
  if (!password && !privateKey) return res.status(400).json({ error: 'password or privateKey is required' });
  if (source === 'remote-path' && !remotePath) return res.status(400).json({ error: 'remotePath is required' });
  if (source === 'upload' && !uploadedFile) return res.status(400).json({ error: 'no file uploaded' });

  // Parse component map from form fields (they all come as strings)
  const components: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k.startsWith('comp_')) components[k.slice(5)] = v === 'true';
  }

  const mimo = fields.mimo === 'true';
  const nat  = fields.nat  === 'true';
  const ipv6 = fields.ipv6 === 'true';
  const autostart = fields.autostart === 'true';
  const licenseUpdate = fields.licenseUpdate !== 'false';

  const steps: InstallStep[] = [];
  let installLog = '';
  const ssh = new NodeSSH();

  try {
    // 1. SSH
    await ssh.connect({
      host: String(host), port: Number(port), username: String(username),
      ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
      readyTimeout: 10000,
    });
    steps.push({ name: 'ssh-connect', ok: true });

    const pwd = password ? String(password) : '';
    const escapedPwd = pwd.replace(/'/g, "'\\''");
    const sudoPrefix = pwd ? `echo '${escapedPwd}' | sudo -S -p ''` : 'sudo';

    // 2. Upload if needed
    let tarPath = remotePath || '';
    if (source === 'upload' && uploadedFile) {
      const remoteTmp = `/tmp/amarisoft-upload-${Date.now()}.tar.gz`;
      await ssh.putFile(uploadedFile, remoteTmp);
      tarPath = remoteTmp;
      steps.push({ name: 'scp-upload', ok: true, detail: remoteTmp });
    }

    // 3. Verify tar
    const verifyRes = await ssh.execCommand(`test -f ${q(tarPath)} && echo ok`);
    if (verifyRes.stdout.trim() !== 'ok') {
      steps.push({ name: 'verify-tar', ok: false, detail: `File not found: ${tarPath}` });
      return res.status(200).json({ success: false, steps, error: `Tar file not found at ${tarPath}` });
    }
    steps.push({ name: 'verify-tar', ok: true, detail: tarPath });

    // 4. Create workspace + extract
    const mkdirRes = await ssh.execCommand('mktemp -d /tmp/amarisoft-install-XXXXX');
    const workspace = mkdirRes.stdout.trim();
    if (!workspace || mkdirRes.code !== 0) {
      steps.push({ name: 'create-workspace', ok: false, detail: mkdirRes.stderr });
      return res.status(200).json({ success: false, steps, error: 'Failed to create workspace' });
    }
    steps.push({ name: 'create-workspace', ok: true, detail: workspace });

    const extractRes = await ssh.execCommand(`tar xf ${q(tarPath)} -C ${q(workspace)}`);
    if (extractRes.code !== 0) {
      steps.push({ name: 'extract', ok: false, detail: extractRes.stderr });
      return res.status(200).json({ success: false, steps, error: 'Failed to extract archive' });
    }
    steps.push({ name: 'extract', ok: true });

    // 5. Locate install.sh
    let resolvedInstallScript = installScript;
    if (!resolvedInstallScript) {
      const findRes = await ssh.execCommand(`find ${q(workspace)} -maxdepth 3 -name 'install.sh' -type f | head -1`);
      resolvedInstallScript = findRes.stdout.trim();
    } else if (!resolvedInstallScript.startsWith('/')) {
      // A relative path from the tar — prepend workspace
      resolvedInstallScript = `${workspace}/${resolvedInstallScript}`;
    }

    if (!resolvedInstallScript) {
      steps.push({ name: 'locate-installer', ok: false, detail: 'install.sh not found' });
      return res.status(200).json({ success: false, steps, error: 'install.sh not found in extracted archive' });
    }
    steps.push({ name: 'locate-installer', ok: true, detail: resolvedInstallScript });

    // 6. Build the non-interactive install command
    const cmd = buildInstallCmd({
      installScript: resolvedInstallScript,
      components,
      trx: trxDriver,
      targetArch,
      mimo, nat, ipv6, autostart, licenseUpdate,
    });
    steps.push({ name: 'build-cmd', ok: true, detail: cmd });

    // 7. Run installer (as root). Pass the sudo password via stdin; install.sh
    //    is now non-interactive so stdin isn't consumed further.
    const fullCmd = `(echo ${q(pwd)}) | ${sudoPrefix} -i bash -c ${q(`cd ${q(workspace)} && ${cmd}`)} 2>&1`;
    const runRes = await ssh.execCommand(fullCmd, { execOptions: { pty: false } });
    installLog = (runRes.stdout + '\n' + runRes.stderr).slice(-8000);
    const installOk = runRes.code === 0;
    steps.push({
      name: 'run-installer',
      ok: installOk,
      detail: installOk ? 'install.sh completed' : `exit code ${runRes.code}`,
    });

    // 8. Optional: restart service if LTE auto service was installed
    if (components.ots && installOk) {
      const restartRes = await ssh.execCommand(
        `${sudoPrefix} service lte restart 2>&1 || ${sudoPrefix} systemctl restart lte 2>&1`
      );
      steps.push({
        name: 'restart-service',
        ok: restartRes.code === 0,
        detail: restartRes.code === 0 ? 'LTE service restarted' : (restartRes.stdout || restartRes.stderr).slice(-200),
      });
    }

    // 9. Cleanup
    await ssh.execCommand(`rm -rf ${q(workspace)}`);
    steps.push({ name: 'cleanup', ok: true });

    if (source === 'upload' && uploadedFile) {
      await fs.unlink(uploadedFile).catch(() => {});
    }

    const criticalOk = steps
      .filter(s => ['ssh-connect', 'extract', 'locate-installer', 'run-installer'].includes(s.name))
      .every(s => s.ok);

    return res.status(200).json({ success: criticalOk, steps, installLog });
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

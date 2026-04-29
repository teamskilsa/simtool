// Inspect Amarisoft services running on a remote target via SSH.
//
// GET (status): list every known unit, mark active/inactive/missing,
//   pull the version string from the corresponding binary, expose
//   "auto-start on boot" (systemctl is-enabled) so the UI can offer to
//   disable it.
//
// POST (action): perform start / stop / restart / disable / enable on
//   one named unit.
//
// Both paths run in a single SSH session for speed.
import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';

interface ServiceUnit {
  /** systemd unit name, e.g. "lte" */
  unit: string;
  /** UI-friendly label */
  label: string;
  /** Components this unit hosts (eNB+gNB share lteenb / lte unit, etc.) */
  components: string[];
  /** Path to the daemon binary, used to read --version */
  binary: string;
}

const KNOWN_UNITS: ServiceUnit[] = [
  { unit: 'lte',        label: 'eNB / gNB (lteenb)',  components: ['enb', 'gnb'], binary: '/root/enb/lteenb' },
  { unit: 'ltemme',     label: 'MME / IMS (ltemme)',  components: ['mme', 'ims'], binary: '/root/mme/ltemme' },
  { unit: 'lteue',      label: 'UE Simulator',         components: ['ue'],         binary: '/root/ue/lteue' },
  { unit: 'ltembmsgw',  label: 'MBMS Gateway',         components: ['mbmsgw'],     binary: '/root/mbmsgw/ltembmsgw' },
  { unit: 'lten3iwf',   label: 'N3IWF',                components: ['n3iwf'],      binary: '/root/n3iwf/lten3iwf' },
  { unit: 'ltelicense', label: 'License Server',       components: ['license'],    binary: '/root/license/ltelicense' },
  { unit: 'lteprobe',   label: 'Probe',                components: ['probe'],      binary: '/root/probe/lteprobe' },
  { unit: 'ltesat',     label: 'Satellite Utilities',  components: ['sat'],        binary: '/root/sat/ltesat' },
];

interface ServiceStatus {
  unit: string;
  label: string;
  components: string[];
  /** 'active' | 'inactive' | 'failed' | 'missing' (not installed) | 'unknown' */
  state: 'active' | 'inactive' | 'failed' | 'missing' | 'unknown';
  /** True when systemctl is-enabled returns 'enabled' (autostart on boot). */
  enabled: boolean;
  /** Version string from the daemon's --version output, when readable. */
  version?: string;
  /** Process count via pgrep — sometimes shows multi-cell as multiple procs. */
  procCount?: number;
}

interface StatusResponse {
  success: boolean;
  error?: string;
  uname?: string;
  services: ServiceStatus[];
}

interface ActionRequest {
  host: string; port?: number; username: string;
  password?: string; privateKey?: string; passphrase?: string;
  unit: string;
  /** start / stop / restart / enable / disable */
  action: 'start' | 'stop' | 'restart' | 'enable' | 'disable';
}

interface ActionResponse {
  success: boolean;
  error?: string;
  unit: string;
  action: string;
  output?: string;
  newStatus?: ServiceStatus;
}

const q = (s: string) => `'${String(s).replace(/'/g, "'\\''")}'`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body ?? {};
  const action = body.action as ActionRequest['action'] | undefined;
  if (action) return handleAction(req, res);
  return handleStatus(req, res);
}

async function handleStatus(req: NextApiRequest, res: NextApiResponse) {
  const { host, port = 22, username, password, privateKey, passphrase } = req.body ?? {};
  if (!host || !username) {
    return res.status(200).json({ success: false, error: 'host and username are required', services: [] } satisfies StatusResponse);
  }
  if (!password && !privateKey) {
    return res.status(200).json({ success: false, error: 'password or privateKey is required', services: [] } satisfies StatusResponse);
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: String(host),
      port: Number(port),
      username: String(username),
      ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
      readyTimeout: 8000,
    });

    const sudoPwd = password ? String(password) : '';
    const sudo = sudoPwd ? `echo '${sudoPwd.replace(/'/g, "'\\''")}' | sudo -S -p ''` : 'sudo';

    // Build one chained command per unit, comma-separated, so we make one
    // round-trip per unit: is-active|is-enabled|version|pgrep.
    const services: ServiceStatus[] = [];
    let uname: string | undefined;

    const unameRes = await ssh.execCommand('uname -a');
    if (unameRes.code === 0) uname = unameRes.stdout.trim();

    for (const u of KNOWN_UNITS) {
      const cmd = [
        // is-active prints "active" / "inactive" / "failed" / "unknown"
        `systemctl is-active ${q(u.unit)} 2>/dev/null || true`,
        // is-enabled prints "enabled" / "disabled" / "static" / "masked" / error
        `systemctl is-enabled ${q(u.unit)} 2>/dev/null || true`,
        // Test if the binary exists; if so, capture --version. Sudo because
        // /root/* is not readable by sysadmin.
        `(${sudo} test -x ${q(u.binary)} && ${sudo} ${q(u.binary)} --version 2>&1 | head -3 || echo NO_BIN)`,
        // Process count
        `pgrep -fc ${q(u.binary)} 2>/dev/null || echo 0`,
      ].join('; echo "---"; ');
      const r = await ssh.execCommand(cmd);
      const parts = r.stdout.split(/\n---\n/);
      const isActive  = (parts[0] ?? '').trim();
      const isEnabled = (parts[1] ?? '').trim();
      const verBlock  = (parts[2] ?? '').trim();
      const procRaw   = (parts[3] ?? '0').trim();

      let state: ServiceStatus['state'] = 'unknown';
      if (isActive === 'active')   state = 'active';
      else if (isActive === 'inactive') state = 'inactive';
      else if (isActive === 'failed')   state = 'failed';
      // No unit on the box: is-active outputs "inactive" or "unknown" with
      // exit code; if the binary is also missing we treat the whole entry
      // as not-installed.
      if (verBlock === 'NO_BIN' && state !== 'active') state = 'missing';

      let version: string | undefined;
      if (verBlock !== 'NO_BIN' && verBlock) {
        // Pick the first non-empty line that looks like a version. Amarisoft
        // tools print things like "Amarisoft Inc. lteenb 2026-04-22".
        const m = verBlock.match(/(\d{4}-\d{2}-\d{2}|\d+\.\d+\.\d+)/);
        version = m ? m[0] : verBlock.split('\n')[0].slice(0, 80);
      }

      const procCount = parseInt(procRaw, 10) || 0;

      services.push({
        unit: u.unit,
        label: u.label,
        components: u.components,
        state,
        enabled: isEnabled === 'enabled',
        version,
        procCount,
      });
    }

    return res.status(200).json({ success: true, uname, services } satisfies StatusResponse);
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: err?.message || 'SSH failed',
      services: [],
    } satisfies StatusResponse);
  } finally {
    ssh.dispose();
  }
}

async function handleAction(req: NextApiRequest, res: NextApiResponse) {
  const {
    host, port = 22, username, password, privateKey, passphrase,
    unit, action,
  } = (req.body ?? {}) as ActionRequest;

  if (!host || !username || !unit || !action) {
    return res.status(200).json({
      success: false, unit, action,
      error: 'host, username, unit, action all required',
    } satisfies ActionResponse);
  }
  if (!KNOWN_UNITS.some(u => u.unit === unit)) {
    return res.status(200).json({
      success: false, unit, action,
      error: `Unknown unit "${unit}" — refusing to act on arbitrary services`,
    } satisfies ActionResponse);
  }
  if (!['start', 'stop', 'restart', 'enable', 'disable'].includes(action)) {
    return res.status(200).json({
      success: false, unit, action,
      error: `Unknown action "${action}"`,
    } satisfies ActionResponse);
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: String(host),
      port: Number(port),
      username: String(username),
      ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
      readyTimeout: 8000,
    });
    const sudoPwd = password ? String(password) : '';
    const sudo = sudoPwd ? `echo '${sudoPwd.replace(/'/g, "'\\''")}' | sudo -S -p ''` : 'sudo';

    const r = await ssh.execCommand(`${sudo} systemctl ${action} ${q(unit)} 2>&1`);
    const ok = r.code === 0;
    const output = (r.stdout + r.stderr).trim().slice(-500);

    // Read back fresh status so the UI doesn't have to round-trip again.
    const after = await ssh.execCommand(
      `systemctl is-active ${q(unit)} 2>/dev/null; echo '---'; systemctl is-enabled ${q(unit)} 2>/dev/null`,
    );
    const [activeRaw = '', enabledRaw = ''] = after.stdout.split(/\n---\n/).map(s => s.trim());
    const u = KNOWN_UNITS.find(x => x.unit === unit)!;
    const newStatus: ServiceStatus = {
      unit: u.unit,
      label: u.label,
      components: u.components,
      state: activeRaw === 'active' ? 'active'
           : activeRaw === 'inactive' ? 'inactive'
           : activeRaw === 'failed' ? 'failed'
           : 'unknown',
      enabled: enabledRaw === 'enabled',
    };

    return res.status(200).json({
      success: ok, unit, action,
      output,
      error: ok ? undefined : (output || `systemctl ${action} ${unit} failed`),
      newStatus,
    } satisfies ActionResponse);
  } catch (err: any) {
    return res.status(200).json({
      success: false, unit, action,
      error: err?.message || 'SSH failed',
    } satisfies ActionResponse);
  } finally {
    ssh.dispose();
  }
}

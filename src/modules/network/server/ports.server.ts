// Server-only: list a callbox's network ports and change a port's IPv4
// address over SSH with NetworkManager (Amarisoft callboxes run Fedora).
//
// Every change runs inside a NetworkManager checkpoint with a rollback timer:
// NM restores the previous state on its own unless SimTool commits the
// checkpoint in time. So a wrong address can't strand the box, even if the
// user closes the page halfway.
import { NodeSSH } from 'node-ssh';

export interface SshCreds { host: string; port?: number; username?: string; password?: string; privateKey?: string }

export interface NetPort {
  device: string;
  type: string;
  state: string;             // NM device state: connected / disconnected / unavailable …
  connection: string;        // NM profile name bound to it ('' when none)
  mac: string;
  carrier: boolean;
  speedMbps: number | null;
  ipv4: string[];            // CIDR, e.g. 192.168.1.80/24
  method: string;            // ipv4.method of the profile: manual / auto / …
  gateway: string;
  /** True when SimTool's own SSH session runs through this port. */
  inUse: boolean;
}

export const isIface = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_.:-]{1,15}$/.test(s);
export const isIPv4 = (s: unknown): s is string =>
  typeof s === 'string' && /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s);
const isCheckpoint = (s: unknown): s is string =>
  typeof s === 'string' && /^\/org\/freedesktop\/NetworkManager\/Checkpoint\/\d+$/.test(s);
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export async function withSsh<T>(creds: SshCreds, fn: (ssh: NodeSSH) => Promise<T>): Promise<T> {
  if (!creds?.host || !creds.username || (!creds.password && !creds.privateKey)) {
    throw new Error('This system has no SSH login saved. Add the username and password (or key) in Test Systems.');
  }
  const ssh = new NodeSSH();
  await ssh.connect({
    host: creds.host,
    port: Number(creds.port ?? 22),
    username: creds.username,
    ...(creds.privateKey ? { privateKey: creds.privateKey } : { password: creds.password }),
    readyTimeout: 8000,
  });
  try {
    return await fn(ssh);
  } finally {
    ssh.dispose();
  }
}

const run = async (ssh: NodeSSH, cmd: string) => {
  const r = await ssh.execCommand(cmd);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || `command failed: ${cmd}`).trim());
  return r.stdout;
};

export async function listPorts(creds: SshCreds): Promise<NetPort[]> {
  return withSsh(creds, async ssh => {
    const nm = await ssh.execCommand('command -v nmcli');
    if (!nm.stdout.trim()) throw new Error('nmcli not found — this system does not use NetworkManager');

    // $SSH_CONNECTION is "client_ip client_port server_ip server_port": the
    // server_ip tells us which port this session came in on.
    const sessionIp = (await ssh.execCommand('echo $SSH_CONNECTION')).stdout.trim().split(/\s+/)[2] ?? creds.host;

    const status = await run(ssh, 'nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status');
    const devices = status.split('\n').filter(Boolean).map(l => {
      // -t escapes ':' inside fields as '\:'
      const [device, type, state, ...conn] = l.split(/(?<!\\):/).map(f => f.replace(/\\:/g, ':'));
      return { device, type, state, connection: conn.join(':') };
    }).filter(d => d.type === 'ethernet');

    const ports: NetPort[] = [];
    for (const d of devices) {
      if (!isIface(d.device)) continue;
      const show = await run(ssh, `nmcli -t -f GENERAL.HWADDR,IP4.ADDRESS,IP4.GATEWAY device show ${q(d.device)}`);
      const fields = show.split('\n').map(l => {
        const i = l.indexOf(':');
        return [l.slice(0, i), l.slice(i + 1).replace(/\\:/g, ':')] as const;
      });
      const ipv4 = fields.filter(([k]) => k.startsWith('IP4.ADDRESS')).map(([, v]) => v).filter(Boolean);
      const sys = (await ssh.execCommand(
        `cat /sys/class/net/${d.device}/carrier /sys/class/net/${d.device}/speed 2>/dev/null`,
      )).stdout.split('\n');
      const method = d.connection && d.connection !== '--'
        ? (await ssh.execCommand(`nmcli -g ipv4.method connection show ${q(d.connection)}`)).stdout.trim()
        : '';
      const speed = Number(sys[1]);
      ports.push({
        device: d.device,
        type: d.type,
        state: d.state,
        connection: d.connection === '--' ? '' : d.connection,
        mac: fields.find(([k]) => k === 'GENERAL.HWADDR')?.[1] ?? '',
        carrier: sys[0]?.trim() === '1',
        speedMbps: Number.isFinite(speed) && speed > 0 ? speed : null,
        ipv4,
        method,
        gateway: fields.find(([k]) => k === 'IP4.GATEWAY')?.[1] ?? '',
        inUse: ipv4.some(a => a.split('/')[0] === sessionIp),
      });
    }
    return ports;
  });
}

export interface SetIpRequest {
  creds: SshCreds;
  device: string;
  method: 'manual' | 'auto';
  address?: string;          // manual only
  prefix?: number;           // manual only
  gateway?: string;          // manual, optional
  rollbackSec?: number;
  /** Explicit opt-in to change the port SimTool's session is using. */
  allowInUse?: boolean;
}

export interface SetIpResult {
  checkpoint: string;
  rollbackAt: number;
  connection: string;
  ports: NetPort[];
}

export async function setIp(req: SetIpRequest): Promise<SetIpResult> {
  if (!isIface(req.device)) throw new Error('Invalid interface name');
  const method = req.method === 'auto' ? 'auto' : 'manual';
  const prefix = Math.round(Number(req.prefix ?? 24));
  if (method === 'manual') {
    if (!isIPv4(req.address)) throw new Error('Address must be an IPv4 address');
    if (!(prefix >= 1 && prefix <= 32)) throw new Error('Prefix must be 1–32');
    if (req.gateway && !isIPv4(req.gateway)) throw new Error('Gateway must be an IPv4 address');
  }
  const rollbackSec = Math.min(600, Math.max(20, Math.round(Number(req.rollbackSec ?? 60))));

  const before = await listPorts(req.creds);
  const port = before.find(p => p.device === req.device);
  if (!port) throw new Error(`No ethernet port named ${req.device}`);
  if (port.inUse && !req.allowInUse) {
    throw new Error(`${req.device} carries SimTool's connection to this box. Changing it would cut SimTool off; connect through another port first.`);
  }

  const result = await withSsh(req.creds, async ssh => {
    const devPath = (await run(ssh,
      `busctl call org.freedesktop.NetworkManager /org/freedesktop/NetworkManager ` +
      `org.freedesktop.NetworkManager GetDeviceByIpIface s ${q(req.device)}`,
    )).trim().match(/"([^"]+)"/)?.[1];
    if (!devPath) throw new Error(`NetworkManager doesn't manage ${req.device}`);

    // CheckpointCreate(devices, rollback_timeout, flags). Roll back only the
    // listed device, leave others alone. Flag 2 (DELETE_NEW_CONNECTIONS)
    // removes the simtool-<dev> profile we may add below, so a rollback can't
    // leave it behind to autoconnect later.
    // NM's timer starts now, not when the change finishes; report that.
    const rollbackAt = Date.now() + rollbackSec * 1000;
    const cp = (await run(ssh,
      `busctl call org.freedesktop.NetworkManager /org/freedesktop/NetworkManager ` +
      `org.freedesktop.NetworkManager CheckpointCreate aouu 1 ${q(devPath)} ${rollbackSec} 2`,
    )).trim().match(/"([^"]+)"/)?.[1];
    if (!isCheckpoint(cp)) throw new Error('Could not create a NetworkManager checkpoint, so nothing was changed');

    let connection = port.connection;
    try {
      if (!connection) {
        connection = `simtool-${req.device}`;
        await run(ssh, `nmcli connection add type ethernet ifname ${q(req.device)} con-name ${q(connection)}`);
      }
      const settings = method === 'auto'
        ? `ipv4.method auto ipv4.addresses '' ipv4.gateway ''`
        : `ipv4.method manual ipv4.addresses ${q(`${req.address}/${prefix}`)} ipv4.gateway ${q(req.gateway ?? '')}`;
      await run(ssh, `nmcli connection modify ${q(connection)} ${settings}`);
      // An unplugged port can't activate; the profile is saved either way and
      // applies when a cable goes in.
      if (port.carrier) await run(ssh, `nmcli connection up ${q(connection)} ifname ${q(req.device)}`);
    } catch (e) {
      // Undo now rather than waiting for the timer.
      await ssh.execCommand(
        `busctl call org.freedesktop.NetworkManager /org/freedesktop/NetworkManager ` +
        `org.freedesktop.NetworkManager CheckpointRollback o ${q(cp)}`,
      );
      throw e;
    }
    return { checkpoint: cp, rollbackAt, connection };
  });

  return { ...result, ports: await listPorts(req.creds) };
}

export async function commitCheckpoint(creds: SshCreds, checkpoint: string, keep: boolean) {
  if (!isCheckpoint(checkpoint)) throw new Error('Invalid checkpoint');
  await withSsh(creds, ssh => run(ssh,
    `busctl call org.freedesktop.NetworkManager /org/freedesktop/NetworkManager ` +
    `org.freedesktop.NetworkManager ${keep ? 'CheckpointDestroy' : 'CheckpointRollback'} o ${q(checkpoint)}`,
  ));
  return listPorts(creds);
}

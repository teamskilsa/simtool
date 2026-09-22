// Server-only: find Amarisoft callboxes the SimTool host can reach.
//
// A browser can't open raw TCP or see local interfaces, so this runs in the
// Next API layer on the laptop. Two methods:
//   • Subnet sweep — every directly attached private IPv4 network of /24 or
//     smaller, TCP-connect on the remote-API ports, then confirm each hit by
//     the WebSocket "ready" banner ({"product":"CBX","type":"ENB",…}).
//   • Direct cable (IPv6 link-local) — ping the all-nodes group on each
//     wired interface and probe responders. Finds a box whose IPv4 address is
//     unknown or on another subnet, as long as it's on the same wire.
import * as os from 'os';
import * as net from 'net';
import * as http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';
import WebSocket from 'ws';

const execFileAsync = promisify(execFile);

const PROBE_PORTS = [9001, 9000, 9050];
const CONNECT_TIMEOUT_MS = 350;
const CONCURRENCY = 64;

export interface Banner { port: number; type?: string; name?: string; product?: string; version?: string }

export interface FoundBox {
  address: string;          // IPv4, or fe80::…%iface for link-local finds
  family: 'ipv4' | 'ipv6-link-local';
  iface: string;            // laptop interface it was seen on
  openPorts: number[];
  banners: Banner[];
  agent: boolean;           // SimTool agent answering on 9050
  product?: string;
  version?: string;
}

export interface ScanResult {
  found: FoundBox[];
  scanned: { iface: string; cidr: string; hosts: number }[];
  linkLocalIfaces: string[];
  ms: number;
}

const isPrivate = (ip: string) =>
  /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

const ipToInt = (ip: string) => ip.split('.').reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
const intToIp = (n: number) => [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');

/** Directly attached private IPv4 networks, capped at /24 so an automatic
 *  scan never sweeps more than 254 hosts per interface. */
export function attachedSubnets() {
  const out: { iface: string; cidr: string; self: string; hosts: string[] }[] = [];
  for (const [iface, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal || !isPrivate(a.address)) continue;
      const prefix = Number(a.cidr?.split('/')[1] ?? 0);
      const effective = Math.max(prefix, 24);
      const mask = effective === 32 ? 0xffffffff : (~((1 << (32 - effective)) - 1)) >>> 0;
      const network = (ipToInt(a.address) & mask) >>> 0;
      const size = 2 ** (32 - effective);
      const hosts: string[] = [];
      for (let i = 1; i < size - 1; i++) {
        const ip = intToIp(network + i);
        if (ip !== a.address) hosts.push(ip);
      }
      out.push({ iface, cidr: `${intToIp(network)}/${effective}`, self: a.address, hosts });
    }
  }
  return out;
}

function tcpOpen(host: string, port: number, timeoutMs = CONNECT_TIMEOUT_MS): Promise<boolean> {
  return new Promise(resolve => {
    const sock = net.connect({ host, port });
    const done = (ok: boolean) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
  });
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

/** Amarisoft remote API greets every connection; the server rejects clients
 *  without an Origin header, so one is always sent. */
function readBanner(host: string, port: number, timeoutMs = 2500): Promise<Banner | null> {
  return new Promise(resolve => {
    let settled = false;
    // URLs can't carry an IPv6 zone (fe80::1%en9), so the socket is opened
    // directly and handed to ws; the URL host is only a placeholder.
    const ws = new WebSocket(`ws://callbox:${port}/`, {
      handshakeTimeout: timeoutMs,
      origin: 'http://simtool',
      createConnection: () => net.connect({ host, port }),
    } as WebSocket.ClientOptions);
    const finish = (b: Banner | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.terminate(); } catch { /* closed */ }
      resolve(b);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    ws.on('message', raw => {
      try {
        const m = JSON.parse(String(raw));
        if (m.message === 'ready') finish({ port, type: m.type, name: m.name, product: m.product, version: m.version });
      } catch { finish(null); }
    });
    ws.on('error', () => finish(null));
  });
}

function agentAlive(host: string): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.request({
      method: 'GET', path: '/api/health', headers: { host: 'callbox' }, timeout: 1500,
      createConnection: () => net.connect({ host, port: 9050 }),
    } as http.RequestOptions, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve(res.statusCode === 200 && JSON.parse(body)?.status === 'ok'); } catch { resolve(false); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function identify(address: string, family: FoundBox['family'], iface: string, openPorts: number[]): Promise<FoundBox | null> {
  const wsPorts = openPorts.filter(p => p !== 9050);
  const banners = (await Promise.all(wsPorts.map(p => readBanner(address, p)))).filter((b): b is Banner => !!b);
  const agent = openPorts.includes(9050) && await agentAlive(address);
  // Something else can listen on 9000/9001; only report what identified itself.
  if (banners.length === 0 && !agent) return null;
  return {
    address, family, iface, openPorts, banners, agent,
    product: banners.find(b => b.product)?.product,
    version: banners.find(b => b.version)?.version,
  };
}

async function sweepIPv4() {
  const subnets = attachedSubnets();
  const found: FoundBox[] = [];
  for (const s of subnets) {
    // First pass on the eNB port alone keeps a /24 to ~2–3 s; hosts that
    // answer get the remaining ports checked.
    const firstPort = await mapLimit(s.hosts, CONCURRENCY, async h => {
      const open: number[] = [];
      for (const p of [PROBE_PORTS[0], PROBE_PORTS[2]]) if (await tcpOpen(h, p)) open.push(p);
      return { h, open };
    });
    const candidates = firstPort.filter(x => x.open.length > 0);
    for (const c of candidates) {
      if (!c.open.includes(9000) && await tcpOpen(c.h, 9000)) c.open.push(9000);
      const box = await identify(c.h, 'ipv4', s.iface, c.open.sort());
      if (box) found.push(box);
    }
  }
  return { found, scanned: subnets.map(s => ({ iface: s.iface, cidr: s.cidr, hosts: s.hosts.length })) };
}

/** Wired-looking interfaces with an IPv6 link-local address. */
function linkLocalIfaces() {
  return Object.entries(os.networkInterfaces())
    .filter(([name, addrs]) =>
      !/^(lo|utun|awdl|llw|bridge|anpi|ap\d|gif|stf|docker|veth|virbr|tun|tap)/.test(name) &&
      (addrs ?? []).some(a => a.family === 'IPv6' && a.address.startsWith('fe80:')))
    .map(([name]) => name);
}

async function sweepLinkLocal(knownV4: FoundBox[]) {
  const ifaces = linkLocalIfaces();
  const found: FoundBox[] = [];
  for (const iface of ifaces) {
    let stdout = '';
    try {
      const isMac = process.platform === 'darwin';
      const cmd = isMac ? 'ping6' : 'ping';
      const args = isMac ? ['-c', '2', '-i', '1', `ff02::1%${iface}`] : ['-6', '-c', '2', '-w', '3', `ff02::1%${iface}`];
      ({ stdout } = await execFileAsync(cmd, args, { timeout: 6000 }));
    } catch (e: any) {
      stdout = e?.stdout ?? '';
    }
    const own = new Set((os.networkInterfaces()[iface] ?? []).map(a => a.address.split('%')[0]));
    const responders = [...new Set([...stdout.matchAll(/from (fe80:[0-9a-f:]+)/gi)].map(m => m[1]))]
      .filter(a => !own.has(a));
    for (const r of responders) {
      const address = `${r}%${iface}`;
      const open: number[] = [];
      for (const p of PROBE_PORTS) if (await tcpOpen(address, p, 800)) open.push(p);
      if (open.length === 0) continue;
      const box = await identify(address, 'ipv6-link-local', iface, open);
      if (box) found.push(box);
    }
  }
  // A box already found over IPv4 on the same interface is the same box when
  // its banners match; keep only the IPv4 row in that case.
  const dupe = (b: FoundBox) => knownV4.some(v =>
    v.iface === b.iface && v.product === b.product && v.version === b.version &&
    v.banners.map(x => x.type).sort().join() === b.banners.map(x => x.type).sort().join());
  return { found: found.filter(b => !dupe(b)), ifaces };
}

export async function discover(opts: { linkLocal?: boolean } = {}): Promise<ScanResult> {
  const t0 = Date.now();
  const v4 = await sweepIPv4();
  const ll = opts.linkLocal ? await sweepLinkLocal(v4.found) : { found: [], ifaces: [] as string[] };
  return { found: [...v4.found, ...ll.found], scanned: v4.scanned, linkLocalIfaces: ll.ifaces, ms: Date.now() - t0 };
}

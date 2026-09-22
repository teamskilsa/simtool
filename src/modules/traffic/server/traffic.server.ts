// Server-only helpers behind the Traffic tab (pages/api/traffic/*).
//
// Three moving parts, each on the host that can actually reach it:
//   • UE discovery + measured throughput — the MME remote API (ws :9000).
//     `ue_get` returns per-bearer dl/ul byte counters, so diffing two polls
//     gives what really crossed the core, independent of the generator.
//   • Callbox-side generators — SSH to the callbox with the system's stored
//     login, the same way Services / SW Management already work.
//   • Phone-side generators — adb on the SimTool host, for a handset plugged
//     in over USB. Uplink can only come from the phone.
import WebSocket from 'ws';
import { NodeSSH } from 'node-ssh';
import { spawn, execFile, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execFileAsync = promisify(execFile);

/** Where the iperf3 binary is expected on the phone. Pushed there with
 *  `adb push iperf3 /data/local/tmp/` — /data/local/tmp is the one place the
 *  adb shell user may execute files from without root. */
export const PHONE_IPERF3 = '/data/local/tmp/iperf3';
export const IPERF3_PORT = 5201;

// ─── Validation ─────────────────────────────────────────────────────────────
// Every value below ends up in a shell command on the callbox or the phone,
// so nothing is interpolated unless it matches one of these.
export const isIPv4 = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s);
export const isSerial = (s: unknown): s is string =>
  typeof s === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(s);
export const clampNum = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

// ─── Amarisoft remote API ──────────────────────────────────────────────────
export function remoteApi<T = any>(host: string, port: number, message: object, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${host}:${port}/`, {
      handshakeTimeout: Math.min(timeoutMs, 4000),
      origin: 'http://simtool',
    });
    let sent = false;
    const timer = setTimeout(() => { ws.terminate(); reject(new Error(`No answer from ${host}:${port}`)); }, timeoutMs);
    const finish = (err: Error | null, data?: T) => {
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      if (err) reject(err); else resolve(data as T);
    };
    ws.on('message', raw => {
      let msg: any;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      // The server greets with {message:"ready"} before it accepts requests.
      if (!sent && msg.message === 'ready') {
        sent = true;
        ws.send(JSON.stringify({ ...message, message_id: 'simtool-traffic' }));
        return;
      }
      if (msg.message_id === 'simtool-traffic') {
        if (msg.error) finish(new Error(String(msg.error)));
        else finish(null, msg);
      }
    });
    ws.on('error', err => finish(new Error(`Remote API ${host}:${port}: ${err.message}`)));
  });
}

export interface UeBearer { apn: string; ip?: string; ipv6?: string; dlBytes: number; ulBytes: number }
export interface UeInfo { imsi: string; rat: string; registered: boolean; bearers: UeBearer[]; /** Joins to the eNB's ue_get. */ mmeUeId?: number }

export async function listUes(host: string, mmePort = 9000): Promise<UeInfo[]> {
  const res = await remoteApi<any>(host, mmePort, { message: 'ue_get' });
  return (res.ue_list ?? []).map((u: any) => ({
    imsi: String(u.imsi ?? ''),
    rat: String(u.rat_type ?? '?'),
    registered: !!u.registered,
    mmeUeId: typeof u.mme_ue_id === 'number' ? u.mme_ue_id : undefined,
    bearers: (u.bearers ?? []).map((b: any) => ({
      apn: String(b.apn ?? ''),
      ip: b.ip,
      ipv6: b.ipv6,
      dlBytes: Number(b.dl_total_bytes ?? 0),
      ulBytes: Number(b.ul_total_bytes ?? 0),
    })),
  }));
}

/** What the radio actually carried, from the eNB/gNB (lteenb) `ue_get`.
 *  The MME counters above count what the core forwarded, which for a UDP
 *  blast is the offered load — well above what a cell can deliver.
 *
 *  Caveat: lteenb resets ue_get's bitrate/tx/retx window on every ue_get from
 *  any client, so another poller (e.g. Stats → UE) shortens this window. */
export interface RadioUe {
  /** Same id the MME reports, so a radio entry can be matched to an IMSI. */
  mmeUeId?: number;
  dlBps: number;
  ulBps: number;
  /** PCell id and the SCells used for carrier aggregation. */
  cellId?: number;
  scellIds: number[];
  /** PCell radio quality: MCS/CQI/rank are per carrier and don't add up. */
  dlMcs?: number;
  ulMcs?: number;
  cqi?: number;
  ri?: number;
  /** Retransmitted / transmitted DL transport blocks, summed over all cells. */
  dlRetxPct?: number;
  dlTx: number;
}
export interface RadioSnapshot {
  ueCount: number;
  dlBps: number;
  ulBps: number;
  ues: RadioUe[];
}

export async function radioSnapshot(host: string, enbPort = 9001): Promise<RadioSnapshot> {
  const res = await remoteApi<any>(host, enbPort, { message: 'ue_get', stats: true });
  const list: any[] = res.ue_list ?? [];
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const ues: RadioUe[] = list.map(u => {
    const cells: any[] = u.cells ?? [];
    const sum = (k: string) => cells.reduce((a, c) => a + n(c[k]), 0);
    const p = cells[0] ?? {};
    const dlTx = sum('dl_tx');
    return {
      mmeUeId: typeof u.mme_ue_id === 'number' ? u.mme_ue_id : undefined,
      dlBps: sum('dl_bitrate'),
      ulBps: sum('ul_bitrate'),
      cellId: p.cell_id,
      scellIds: cells.slice(1).map(c => c.cell_id).filter((v: unknown): v is number => typeof v === 'number'),
      dlMcs: p.dl_mcs, ulMcs: p.ul_mcs, cqi: p.cqi, ri: p.ri,
      dlRetxPct: dlTx > 0 ? (100 * sum('dl_retx')) / dlTx : undefined,
      dlTx,
    };
  });
  return {
    ueCount: ues.length,
    dlBps: ues.reduce((a, u) => a + u.dlBps, 0),
    ulBps: ues.reduce((a, u) => a + u.ulBps, 0),
    ues,
  };
}

// ─── Phones over adb ───────────────────────────────────────────────────────
export interface PhoneInfo { serial: string; model: string; state: string; hasIperf3: boolean; iperf3Version?: string }

export async function adb(args: string[], timeoutMs = 8000) {
  return execFileAsync('adb', args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
}

export async function listPhones(): Promise<PhoneInfo[]> {
  const { stdout } = await adb(['devices', '-l']);
  const rows = stdout.split('\n').slice(1).map(l => l.trim()).filter(Boolean);
  const phones: PhoneInfo[] = [];
  for (const row of rows) {
    const [serial, state, ...rest] = row.split(/\s+/);
    // Emulators can't reach a callbox over the air; don't offer them.
    if (!serial || serial.startsWith('emulator-')) continue;
    const model = rest.find(t => t.startsWith('model:'))?.slice(6) ?? '';
    let hasIperf3 = false;
    let iperf3Version: string | undefined;
    if (state === 'device') {
      try {
        const { stdout: v } = await adb(['-s', serial, 'shell', `${PHONE_IPERF3} --version 2>&1 | head -1`]);
        hasIperf3 = /^iperf 3/.test(v.trim());
        if (hasIperf3) iperf3Version = v.trim();
      } catch { /* not installed or not executable */ }
    }
    phones.push({ serial, model, state, hasIperf3, iperf3Version });
  }
  return phones;
}

// ─── Traffic jobs ──────────────────────────────────────────────────────────
export type Direction = 'dl' | 'ul';
export type Generator = 'callbox' | 'phone';
export type Protocol = 'udp' | 'tcp';

export interface SshCreds { host: string; port?: number; username?: string; password?: string; privateKey?: string }

export interface StartRequest {
  creds: SshCreds;
  direction: Direction;
  generator: Generator;
  protocol: Protocol;
  ueIp: string;
  /** Callbox address on the UE's PDN (iperf3 server for phone generators). */
  serverIp: string;
  phoneSerial?: string;
  bitrateMbps: number;
  durationSec: number;
}

export interface JobView {
  id: string;
  label: string;
  direction: Direction;
  generator: Generator;
  protocol: Protocol;
  ueIp: string;
  bitrateMbps: number;
  durationSec: number;
  startedAt: number;
  endedAt?: number;
  state: 'starting' | 'running' | 'done' | 'stopped' | 'failed';
  error?: string;
  output: string[];
  command: string;
}

interface Job extends JobView {
  stop: () => Promise<void>;
}

// Survives Next dev hot reloads, which re-evaluate this module.
const g = globalThis as unknown as { __simtoolTrafficJobs?: Map<string, Job> };
const jobs: Map<string, Job> = g.__simtoolTrafficJobs ?? (g.__simtoolTrafficJobs = new Map());

const MAX_LINES = 300;
const pushOutput = (job: Job, chunk: string) => {
  for (const line of chunk.split(/\r?\n/)) {
    if (line.trim()) job.output.push(line);
  }
  if (job.output.length > MAX_LINES) job.output.splice(0, job.output.length - MAX_LINES);
};

const view = ({ stop: _stop, ...rest }: Job): JobView => ({ ...rest, output: [...rest.output] });

export function listJobs(): JobView[] {
  // Drop finished jobs after 30 minutes so the list doesn't grow forever.
  const cutoff = Date.now() - 30 * 60_000;
  for (const [id, j] of jobs) if (j.endedAt && j.endedAt < cutoff) jobs.delete(id);
  return [...jobs.values()].sort((a, b) => b.startedAt - a.startedAt).map(view);
}

/** Stop every tracked job, then sweep the callbox and any phone for traffic
 *  processes this app started but lost track of (a crash, a restart, or a job
 *  whose stop never reached the box). Safe: it only matches simtool's own tag
 *  plus iperf runs aimed at a UE address. */
export async function stopAllTraffic(creds?: SshCreds, phoneSerials: string[] = []) {
  const stopped: string[] = [];
  for (const [id, j] of jobs) {
    if (j.state === 'running' || j.state === 'starting') {
      try { await j.stop(); j.state = 'stopped'; j.endedAt = Date.now(); stopped.push(id); } catch { /* keep going */ }
    }
  }
  let swept = 0;
  if (creds?.host && creds.username && (creds.password || creds.privateKey)) {
    try {
      const ssh = await sshConnect(creds);
      try {
        const r = await ssh.execCommand(
          `pkill -f simtool-traffic- ; pkill -f "iperf -u -c" ; pkill -f "iperf3 -c" ; ` +
          `sleep 1; pgrep -fc "iperf" || true`,
        );
        swept = Number((r.stdout || '0').trim()) || 0;
      } finally { ssh.dispose(); }
    } catch { /* no SSH login saved — tracked jobs were still stopped */ }
  }
  for (const serial of phoneSerials) {
    if (isSerial(serial)) await adb(['-s', serial, 'shell', `pkill -f ${PHONE_IPERF3}`]).catch(() => {});
  }
  return { stopped, remainingOnBox: swept };
}

export async function stopJob(id: string) {
  const job = jobs.get(id);
  if (!job) throw new Error('No such traffic job');
  if (job.state === 'running' || job.state === 'starting') {
    await job.stop();
    job.state = 'stopped';
    job.endedAt = Date.now();
  }
  return view(job);
}

async function sshConnect(creds: SshCreds) {
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
  return ssh;
}

export async function startJob(req: StartRequest): Promise<JobView> {
  const direction: Direction = req.direction === 'ul' ? 'ul' : 'dl';
  const generator: Generator = req.generator === 'phone' ? 'phone' : 'callbox';
  const protocol: Protocol = req.protocol === 'tcp' ? 'tcp' : 'udp';
  const bitrateMbps = clampNum(req.bitrateMbps, 0.1, 5000, 10);
  const durationSec = Math.round(clampNum(req.durationSec, 1, 3600, 30));

  if (!isIPv4(req.ueIp)) throw new Error('UE IP must be an IPv4 address');
  if (!isIPv4(req.creds?.host)) throw new Error('System IP must be an IPv4 address');
  if (direction === 'ul' && generator !== 'phone') {
    throw new Error('Uplink traffic has to be generated on the phone');
  }
  if (generator === 'callbox' && protocol === 'tcp') {
    throw new Error('TCP needs an endpoint on the phone — use the phone generator, or UDP from the callbox');
  }

  const id = crypto.randomBytes(4).toString('hex');
  const rate = `${bitrateMbps}M`;
  const base = {
    id, direction, generator, protocol, ueIp: req.ueIp, bitrateMbps, durationSec,
    startedAt: Date.now(), state: 'starting' as const, output: [] as string[],
  };

  if (generator === 'callbox') {
    // iperf2 in UDP mode sends without needing anything listening on the UE,
    // so downlink works on a stock phone. The UE just drops the datagrams; the
    // MME byte counters show what actually got through.
    // `exec -a` renames the process to simtool-traffic-<id>, so a stop can kill
    // it by name when the pid was never captured (a dropped SSH connection used
    // to leave iperf blasting the UE with no way to stop it from the UI).
    const tag = `simtool-traffic-${id}`;
    const command = `iperf -u -c ${req.ueIp} -b ${rate} -t ${durationSec} -l 1400 -i 1`;
    const job: Job = {
      ...base,
      label: `DL UDP ${rate} callbox → ${req.ueIp}`,
      command: `ssh ${req.creds.host}: ${command}`,
      stop: async () => {},
    };
    jobs.set(id, job);

    const ssh = await sshConnect(req.creds).catch(e => {
      job.state = 'failed'; job.error = e.message; job.endedAt = Date.now();
      throw e;
    });
    let pid: string | null = null;
    job.stop = async () => {
      if (pid) await ssh.execCommand(`kill ${pid}`).catch(() => {});
      // Belt and braces: the tagged name survives a lost pid or a dead channel.
      await ssh.execCommand(`pkill -f ${tag}`).catch(() => {});
      await sshConnect(req.creds)
        .then(async s2 => { await s2.execCommand(`pkill -f ${tag}`).catch(() => {}); s2.dispose(); })
        .catch(() => {});
    };
    job.state = 'running';
    // `echo $$; exec …` prints the shell's pid, which exec hands to iperf —
    // that's the pid Stop kills.
    ssh.execCommand(`echo "PID $$"; exec -a ${tag} ${command}`, {
      onStdout: buf => {
        const s = buf.toString();
        const m = !pid && s.match(/PID (\d+)/);
        if (m) pid = m[1];
        pushOutput(job, s.replace(/PID \d+\n?/, ''));
      },
      onStderr: buf => pushOutput(job, buf.toString()),
    }).then(r => {
      if (job.state === 'running') {
        const out = job.output.join('\n');
        // iperf exits 0 even when every send fails, e.g. when `service lte
        // restart` tears down the tun interface that routes to the UE.
        const unreachable = (out.match(/Network is unreachable/g) ?? []).length;
        job.state = (r.code === 0 || r.code === null) && unreachable === 0 ? 'done' : 'failed';
        if (job.state === 'failed') {
          job.error = /command not found/.test(r.stderr) ? 'iperf is not installed on the callbox'
            : unreachable > 0 ? `Lost the route to ${req.ueIp} mid-run (${unreachable} failed sends) — the lte service restarted or the UE detached`
            : `iperf exited with code ${r.code}`;
        }
        job.endedAt = Date.now();
      }
    }).catch(e => {
      if (job.state === 'running') { job.state = 'failed'; job.error = e.message; job.endedAt = Date.now(); }
    }).finally(() => ssh.dispose());
    return view(job);
  }

  // ── Phone generator: iperf3 client on the handset, iperf3 server on the callbox.
  if (!isSerial(req.phoneSerial)) throw new Error('Pick the phone to run iperf3 on');
  if (!isIPv4(req.serverIp)) throw new Error('Callbox PDN address must be an IPv4 address');

  const args = [
    '-c', req.serverIp, '-p', String(IPERF3_PORT), '-t', String(durationSec), '-i', '1', '--forceflush',
    ...(direction === 'dl' ? ['-R'] : []),
    ...(protocol === 'udp' ? ['-u', '-b', rate, '-l', '1400'] : bitrateMbps ? ['-b', rate] : []),
  ];
  const remote = `${PHONE_IPERF3} ${args.join(' ')}`;
  const job: Job = {
    ...base,
    label: `${direction.toUpperCase()} ${protocol.toUpperCase()} ${rate} phone ${direction === 'dl' ? '←' : '→'} ${req.serverIp}`,
    command: `adb -s ${req.phoneSerial} shell ${remote}`,
    stop: async () => {},
  };
  jobs.set(id, job);

  try {
    // Make sure an iperf3 server is listening on the callbox. -D daemonises,
    // so it keeps serving later runs; -1 is not used for that reason.
    const ssh = await sshConnect(req.creds);
    try {
      const r = await ssh.execCommand(
        `command -v iperf3 >/dev/null || { echo NO_IPERF3; exit 3; }; ` +
        `pgrep -f "iperf3 -s -p ${IPERF3_PORT}" >/dev/null || iperf3 -s -p ${IPERF3_PORT} -D; sleep 0.5; ` +
        `pgrep -f "iperf3 -s -p ${IPERF3_PORT}" >/dev/null && echo SERVER_UP`,
      );
      if (/NO_IPERF3/.test(r.stdout)) throw new Error('iperf3 is not installed on the callbox');
      if (!/SERVER_UP/.test(r.stdout)) throw new Error(`Could not start iperf3 server on the callbox: ${r.stderr || r.stdout}`);
      pushOutput(job, `iperf3 server listening on ${req.creds.host} (PDN ${req.serverIp}):${IPERF3_PORT}`);
    } finally {
      ssh.dispose();
    }
  } catch (e: any) {
    job.state = 'failed'; job.error = e.message; job.endedAt = Date.now();
    throw e;
  }

  const child: ChildProcess = spawn('adb', ['-s', req.phoneSerial, 'shell', remote], { stdio: ['ignore', 'pipe', 'pipe'] });
  job.state = 'running';
  child.stdout?.on('data', b => pushOutput(job, b.toString()));
  child.stderr?.on('data', b => pushOutput(job, b.toString()));
  child.on('error', e => {
    if (job.state === 'running') { job.state = 'failed'; job.error = `adb: ${e.message}`; job.endedAt = Date.now(); }
  });
  child.on('close', code => {
    if (job.state === 'running') {
      const out = job.output.join('\n');
      const iperfError = out.match(/iperf3: error - (.*)/)?.[1];
      job.state = code === 0 && !iperfError ? 'done' : 'failed';
      if (job.state === 'failed') job.error = iperfError ?? `adb exited with code ${code}`;
      job.endedAt = Date.now();
    }
  });
  job.stop = async () => {
    // Killing adb doesn't always kill the process on the handset.
    child.kill();
    await adb(['-s', req.phoneSerial!, 'shell', 'pkill -f /data/local/tmp/iperf3']).catch(() => {});
  };
  return view(job);
}

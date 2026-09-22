// Capture jobs behind the Capture tab (pages/api/capture/*).
//
//   • IQ      — lteenb/lteue `trx_iq_dump` over the remote API writes float32
//               I/Q files to the box's /tmp; SimTool reads their sizes, then
//               fetches them over SSH into data/captures/<id>/ and deletes the
//               temp files it created.
//   • Log     — a persistent remote API session: raise the chosen layers with
//               config_set, long-poll log_get for N seconds into a .log file,
//               then put the previous levels back.
//   • Pcap    — the documented remote API has no pcap message (eNB MAC-LTE
//               pcap is config-file `pcap` or the console `pcap` command, LTE
//               only; ltemme documents none). So:
//                 - tcpdump on the callbox over SSH for S1AP/NGAP/GTP (a real
//                   network capture, not an Amarisoft API), or
//                 - console import: the user runs the console `pcap` command
//                   with a SimTool file name and SimTool fetches that file.
import * as fs from 'fs';
import * as path from 'path';
import {
  BOX_TMP_MARGIN, DEFAULT_API_PORT, IQ_MAX_DURATION_MS, IQ_MAX_TOTAL_BYTES, IQ_WARN_BYTES, LOG_LAYERS, LOG_LEVELS,
  LOG_MAX_BYTES, LOG_MAX_DURATION_SEC, PCAP_FILTERS, PCAP_MAX_BYTES, PCAP_MAX_DURATION_SEC, fmtBytes, iqEstimate,
} from '../lib/limits';
import { assertFetchable, openBox, type Box } from './box';
import { portsFromConfig, logLevelsFromConfig, type RfPortInfo } from './probe';
import { RemoteApiSession, remoteApiOnce } from './remoteApi';
import {
  assertHostSpace, captureDir, captureFile, writeManifest, type CaptureType, type Manifest, type ManifestFile,
} from './store';
import {
  boxIqPattern, boxPcapPath, cleanLabel, clampInt, isIfName, newCaptureId, parseCreds, shq, toPort, type SshCreds,
} from './validate';

export type JobState = 'starting' | 'capturing' | 'ready' | 'fetching' | 'done' | 'failed' | 'stopped' | 'discarded';

export interface RemoteFile { path: string; bytes: number | null; localName: string; meta: Omit<ManifestFile, 'name' | 'bytes'> }

export interface CaptureJobView {
  id: string;
  type: CaptureType;
  label: string;
  system: { name: string; host: string };
  startedAt: number;
  endedAt?: number;
  /** When the capture itself should end (for a progress bar). */
  captureEndsAt?: number;
  state: JobState;
  error?: string;
  warnings: string[];
  output: string[];
  command: string;
  remoteFiles: { path: string; bytes: number | null }[];
  totalBytes?: number;
  fetchedBytes?: number;
  /** Files are on the box and wait for Fetch or Discard. */
  awaitingFetch: boolean;
  /** Present for console pcap: what the user must type in the lteenb console. */
  consoleCommand?: string;
}

interface Job extends Omit<CaptureJobView, 'remoteFiles' | 'awaitingFetch'> {
  creds: SshCreds;
  remote: RemoteFile[];
  manifest: Manifest;
  stopRequested: boolean;
  stop: () => Promise<void>;
}

const g = globalThis as unknown as { __simtoolCaptureJobs?: Map<string, Job> };
const jobs: Map<string, Job> = g.__simtoolCaptureJobs ?? (g.__simtoolCaptureJobs = new Map());

const MAX_LINES = 200;
const say = (job: Job, chunk: string) => {
  for (const line of chunk.split(/\r?\n/)) if (line.trim()) job.output.push(line);
  if (job.output.length > MAX_LINES) job.output.splice(0, job.output.length - MAX_LINES);
};

const view = (j: Job): CaptureJobView => ({
  id: j.id, type: j.type, label: j.label, system: j.system, startedAt: j.startedAt, endedAt: j.endedAt,
  captureEndsAt: j.captureEndsAt, state: j.state, error: j.error, warnings: [...j.warnings], output: [...j.output],
  command: j.command, totalBytes: j.totalBytes, fetchedBytes: j.fetchedBytes, consoleCommand: j.consoleCommand,
  remoteFiles: j.remote.map(f => ({ path: f.path, bytes: f.bytes })),
  awaitingFetch: j.state === 'ready',
});

const live = (j: Job) => j.state === 'starting' || j.state === 'capturing' || j.state === 'fetching' || j.state === 'ready';

export function listJobs(): CaptureJobView[] {
  const cutoff = Date.now() - 60 * 60_000;
  for (const [id, j] of jobs) if (j.endedAt && j.endedAt < cutoff && !live(j)) jobs.delete(id);
  return [...jobs.values()].sort((a, b) => b.startedAt - a.startedAt).map(view);
}

const fail = (job: Job, e: unknown) => {
  job.state = 'failed';
  job.error = String((e as any)?.message ?? e);
  job.endedAt = Date.now();
};

function newJob(type: CaptureType, creds: SshCreds, systemName: string, label: string): Job {
  const id = newCaptureId();
  const system = { name: systemName || creds.host, host: creds.host };
  const job: Job = {
    id, type, label, system, creds, startedAt: Date.now(), state: 'starting', warnings: [], output: [], command: '',
    remote: [], stopRequested: false, stop: async () => {},
    manifest: {
      version: 1, id, type, label, system, createdAt: new Date().toISOString(), state: 'partial', files: [], notes: [],
    },
  };
  jobs.set(id, job);
  return job;
}

// ─── IQ ──────────────────────────────────────────────────────────────────────

export interface IqStartRequest {
  creds: SshCreds;
  systemName?: string;
  apiPort?: number;
  rfPorts: number[];
  directions: ('rx' | 'tx')[];
  durationMs: number;
  /** Fetch straight away when the files are under IQ_WARN_BYTES. */
  autoFetch?: boolean;
}

export async function startIq(req: IqStartRequest): Promise<CaptureJobView> {
  const creds = parseCreds(req.creds);
  const apiPort = toPort(req.apiPort, DEFAULT_API_PORT.enb);
  const directions = (['rx', 'tx'] as const).filter(d => Array.isArray(req.directions) && req.directions.includes(d));
  if (directions.length === 0) throw new Error('Pick RX, TX or both');
  if (!Array.isArray(req.rfPorts) || req.rfPorts.length === 0) throw new Error('Pick at least one RF port');
  const rfPorts = [...new Set(req.rfPorts.map(Number))];
  if (rfPorts.some(p => !Number.isInteger(p) || p < 0 || p > 63)) throw new Error('RF port must be an integer 0–63');
  const durationMs = clampInt(req.durationMs, 1, IQ_MAX_DURATION_MS, 1000);
  assertFetchable(creds);

  const busy = [...jobs.values()].find(j => j.type === 'iq' && j.system.host === creds.host && live(j));
  if (busy) throw new Error(`An IQ capture is already ${busy.state === 'ready' ? 'waiting to be fetched' : busy.state} on ${creds.host} (${busy.id}). Fetch or discard it first.`);

  const job = newJob('iq', creds, cleanLabel(req.systemName), `IQ ${directions.join('+').toUpperCase()} · port ${rfPorts.join(',')} · ${durationMs} ms`);
  const rxName = `/tmp/simtool-iq-${job.id}-rx-%d.bin`;
  const txName = `/tmp/simtool-iq-${job.id}-tx-%d.bin`;
  const msg: Record<string, unknown> = {
    message: 'trx_iq_dump',
    duration: durationMs,
    rf_port: rfPorts.length === 1 ? rfPorts[0] : rfPorts,
    ...(directions.includes('rx') ? { rx_filename: rxName } : {}),
    ...(directions.includes('tx') ? { tx_filename: txName } : {}),
  };
  job.command = `ws://${creds.host}:${apiPort} ${JSON.stringify(msg)}`;

  // Everything that can refuse runs before the dump, synchronously for the
  // caller, so a bad request comes back as an error instead of a failed job.
  let box: Box | null = null;
  try {
    const cfg = await remoteApiOnce<any>(creds.host, apiPort, { message: 'config_get' }, 6000);
    const ports = portsFromConfig(cfg);
    const missing = rfPorts.filter(p => !ports.some(x => x.port === p));
    if (missing.length) throw new Error(`RF port ${missing.join(', ')} is not configured on ${creds.host}:${apiPort}`);
    const est = iqEstimate(ports, rfPorts, directions, durationMs);
    say(job, `Estimated ${fmtBytes(est.bytes)} across ${est.channels} channel file(s)`);
    if (est.bytes > IQ_MAX_TOTAL_BYTES) {
      throw new Error(`That capture would be ~${fmtBytes(est.bytes)}, over the ${fmtBytes(IQ_MAX_TOTAL_BYTES)} limit. Use ${est.maxDurationMs} ms or less, fewer ports, or one direction.`);
    }
    await assertHostSpace(est.bytes);
    box = await openBox(creds);
    const boxFree = await box.freeBytes('/tmp');
    if (boxFree < est.bytes * BOX_TMP_MARGIN) {
      throw new Error(`Not enough space in /tmp on the callbox: need ~${fmtBytes(est.bytes * BOX_TMP_MARGIN)}, ${fmtBytes(boxFree)} free`);
    }
    box.dispose(); box = null;

    job.manifest.iq = {
      format: 'float32le-iq-interleaved', fullScale: 1, durationMs, directions: [...directions], rfPorts,
      sampleRates: Object.fromEntries(ports.filter(p => rfPorts.includes(p.port)).map(p => [String(p.port), p.sampleRate])),
      antennaCount: 0, cells: ports.filter(p => rfPorts.includes(p.port)).flatMap(p => p.cells),
      remoteApi: { port: apiPort, response: null },
    };
    runIq(job, creds, apiPort, msg, ports, rfPorts, directions, durationMs, req.autoFetch !== false);
    return view(job);
  } catch (e) {
    box?.dispose();
    jobs.delete(job.id);
    throw e;
  }
}

function runIq(job: Job, creds: SshCreds, apiPort: number, msg: Record<string, unknown>, ports: RfPortInfo[], rfPorts: number[],
  directions: ('rx' | 'tx')[], durationMs: number, autoFetch: boolean) {
  job.state = 'capturing';
  job.captureEndsAt = Date.now() + durationMs;
  // trx_iq_dump cannot be aborted through the documented API. Stop marks the
  // job; the files are discarded as soon as the dump returns.
  job.stop = async () => { job.stopRequested = true; say(job, 'Stop requested — trx_iq_dump cannot be cancelled; files will be discarded when it returns'); };
  say(job, `Sending trx_iq_dump to ${creds.host}:${apiPort}`);

  (async () => {
    // Initialisation (memory allocation, file creation) comes before the
    // capture; allow a generous margin on top of the duration.
    const res = await remoteApiOnce<any>(creds.host, apiPort, msg, durationMs + 90_000, n => {
      if (n.notification === 'started') {
        job.captureEndsAt = Date.now() + durationMs;
        say(job, `Dump started${n.time !== undefined ? ` (time ${n.time})` : ''}`);
      }
    });
    job.manifest.iq!.remoteApi.response = res;
    const pattern = boxIqPattern(job.id);
    const remote: RemoteFile[] = [];
    const channelsFor = (dir: 'rx' | 'tx') =>
      ports.filter(p => rfPorts.includes(p.port)).flatMap(p => (dir === 'rx' ? p.rxChannels : p.txChannels).map(c => ({ ...c, port: p.port })));
    const rateFor = (port?: number) => {
      const hit = (res.rf_ports ?? []).find((r: any) => r.index === port) ?? (res.rf_ports?.length === 1 ? res.rf_ports[0] : undefined);
      return typeof hit?.sample_rate === 'number' ? hit.sample_rate : ports.find(p => p.port === port)?.sampleRate;
    };
    for (const dir of directions) {
      const listed: string[] = Array.isArray(res[`${dir}_files`]) ? res[`${dir}_files`] : [];
      const chans = channelsFor(dir);
      const sorted = listed.filter(f => {
        if (typeof f === 'string' && pattern.test(f)) return true;
        job.warnings.push(`Ignoring unexpected file from trx_iq_dump: ${String(f).slice(0, 120)}`);
        return false;
      }).sort((a, b) => Number(a.match(/-(\d+)\.bin$/)![1]) - Number(b.match(/-(\d+)\.bin$/)![1]));
      sorted.forEach((f, pos) => {
        const d = Number(f.match(/-(\d+)\.bin$/)![1]);
        // %d is the channel number; match it to config_get's global channel
        // index when possible, otherwise by position among the chosen ports.
        const ch = chans.find(c => c.index === d) ?? chans[pos];
        remote.push({
          path: f, bytes: null, localName: `iq-${dir}-${d}.bin`,
          meta: { kind: 'iq', direction: dir, channel: d, rfPort: ch?.port, sampleRate: rateFor(ch?.port), centerFreqHz: ch?.freqHz },
        });
      });
    }
    if (remote.length === 0) throw new Error('trx_iq_dump returned no files (is the RF port active?)');
    job.remote = remote;
    const iq = job.manifest.iq!;
    for (const r of res.rf_ports ?? []) if (typeof r?.index === 'number' && typeof r?.sample_rate === 'number') iq.sampleRates[String(r.index)] = r.sample_rate;
    iq.antennaCount = Math.max(remote.filter(f => f.meta.direction === 'rx').length, remote.filter(f => f.meta.direction === 'tx').length);
    iq.dumpUtc = res.dump_utc; iq.rxTimestamp0 = res.rx_timestamp0; iq.txTimestamp0 = res.tx_timestamp0;
    iq.rxOverflows = res.rx_overflows; iq.txOverflows = res.tx_overflows;
    if (res.rx_overflows || res.tx_overflows) job.warnings.push(`Samples lost during capture: rx_overflows=${res.rx_overflows ?? 0}, tx_overflows=${res.tx_overflows ?? 0}`);
    say(job, `Dump finished: ${remote.length} file(s)`);

    await refreshSizes(job);
    if (job.stopRequested) { await discard(job.id, 'stopped'); return; }
    if ((job.totalBytes ?? 0) > IQ_MAX_TOTAL_BYTES) {
      await discard(job.id, 'failed');
      job.error = `Files are ${fmtBytes(job.totalBytes!)}, over the ${fmtBytes(IQ_MAX_TOTAL_BYTES)} limit — discarded on the box`;
      return;
    }
    job.state = 'ready';
    if (autoFetch && (job.totalBytes ?? 0) <= IQ_WARN_BYTES) await fetchJob(job.id);
    else say(job, `Files total ${fmtBytes(job.totalBytes ?? 0)} — press Fetch to copy them to SimTool, or Discard`);
  })().catch(async e => {
    fail(job, e);
    // Best effort: remove any partial dump files we created.
    if (job.remote.length) await removeRemote(job).catch(() => {});
  });
}

async function refreshSizes(job: Job) {
  const box = await openBox(job.creds);
  try {
    const sizes = await box.sizeOf(job.remote.map(f => f.path));
    for (const f of job.remote) f.bytes = sizes[f.path];
    job.totalBytes = job.remote.reduce((a, f) => a + (f.bytes ?? 0), 0);
    say(job, job.remote.map(f => `${f.path}: ${f.bytes === null ? 'missing' : fmtBytes(f.bytes)}`).join('\n'));
  } finally {
    box.dispose();
  }
}

async function removeRemote(job: Job) {
  const box = await openBox(job.creds);
  try {
    const left = await box.remove(job.remote.map(f => f.path));
    if (left.length) job.warnings.push(`Could not delete on the box (permission?): ${left.join(', ')}`);
    else say(job, `Removed ${job.remote.length} temp file(s) from the box`);
  } finally {
    box.dispose();
  }
}

// ─── Fetch / discard (all types) ─────────────────────────────────────────────

export async function fetchJob(id: string): Promise<CaptureJobView> {
  const job = jobs.get(id);
  if (!job) throw new Error('No such capture job');
  if (job.state !== 'ready') throw new Error(`Capture is ${job.state}, not waiting to be fetched`);
  job.state = 'fetching';
  job.fetchedBytes = 0;
  const run = async () => {
    await refreshSizes(job);
    const present = job.remote.filter(f => f.bytes !== null);
    if (present.length === 0) {
      job.state = 'ready';
      throw new Error(job.type === 'pcap' ? `Nothing at ${job.remote.map(f => f.path).join(', ')} yet — run the console command first` : 'The capture files are gone from the box');
    }
    const limit = job.type === 'iq' ? IQ_MAX_TOTAL_BYTES : PCAP_MAX_BYTES;
    if ((job.totalBytes ?? 0) > limit) throw new Error(`Files are ${fmtBytes(job.totalBytes!)}, over the ${fmtBytes(limit)} limit`);
    await assertHostSpace(job.totalBytes ?? 0);
    await fs.promises.mkdir(captureDir(job.id), { recursive: true });
    const box = await openBox(job.creds);
    let done = 0;
    try {
      for (const f of present) {
        const local = captureFile(job.id, f.localName);
        say(job, `Fetching ${f.path} (${fmtBytes(f.bytes ?? 0)}) over ${box.kind === 'ssh' ? 'SSH' : 'loopback (QA)'}`);
        await box.fetch(f.path, local, n => { job.fetchedBytes = done + n; });
        const got = (await fs.promises.stat(local)).size;
        if (got !== f.bytes) throw new Error(`${f.localName}: fetched ${got} bytes, expected ${f.bytes}`);
        done += got;
        job.fetchedBytes = done;
        job.manifest.files.push({ name: f.localName, bytes: got, ...f.meta });
        await writeManifest(job.manifest);
      }
    } finally {
      box.dispose();
    }
    await removeRemote(job).catch(e => job.warnings.push(`Cleanup on the box failed: ${e.message}`));
    job.manifest.state = 'complete';
    job.manifest.finishedAt = new Date().toISOString();
    job.manifest.notes.push(...job.warnings);
    await writeManifest(job.manifest);
    job.state = 'done';
    job.endedAt = Date.now();
    say(job, `Saved to data/captures/${job.id}/`);
  };
  // Console pcap: a missing file is a user-facing error, not a failed job.
  if (job.type === 'pcap' && job.consoleCommand) {
    try { await run(); } catch (e: any) {
      // Nothing copied yet (file not there, SSH down): stay fetchable.
      if (job.manifest.files.length === 0) { job.state = 'ready'; throw e; }
      fail(job, e);
      await writeManifest({ ...job.manifest, notes: [...job.manifest.notes, `Fetch failed: ${e.message}`] }).catch(() => {});
    }
    return view(job);
  }
  run().catch(async e => {
    fail(job, e);
    if (job.manifest.files.length) {
      await writeManifest({ ...job.manifest, state: 'partial', notes: [...job.manifest.notes, `Fetch failed: ${job.error}`] }).catch(() => {});
    }
  });
  return view(job);
}

export async function discard(id: string, final: JobState = 'discarded'): Promise<CaptureJobView> {
  const job = jobs.get(id);
  if (!job) throw new Error('No such capture job');
  if (job.state === 'capturing' || job.state === 'fetching') throw new Error(`Capture is ${job.state}; stop it first`);
  if (job.remote.length) await removeRemote(job).catch(e => job.warnings.push(`Cleanup on the box failed: ${e.message}`));
  job.state = final;
  job.endedAt = Date.now();
  return view(job);
}

export async function stopJob(id: string): Promise<CaptureJobView> {
  const job = jobs.get(id);
  if (!job) throw new Error('No such capture job');
  if (job.state === 'ready') return discard(id, 'stopped');
  if (job.state === 'starting' || job.state === 'capturing') await job.stop();
  return view(job);
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export interface LogStartRequest {
  creds: SshCreds;
  systemName?: string;
  component: 'enb' | 'mme' | 'ue';
  apiPort?: number;
  layers: Record<string, string>;
  durationSec: number;
}

const two = (n: number, w = 2) => String(n).padStart(w, '0');
const logTime = (ms: number) => { const d = new Date(ms); return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${two(d.getMilliseconds(), 3)}`; };

/** One log_get entry in Amarisoft's text log layout. */
export function formatLogEntry(l: any): string {
  const ts = typeof l.timestamp === 'number' ? l.timestamp : typeof l.timestamp_us === 'number' ? l.timestamp_us / 1000 : Date.now();
  const lines: string[] = Array.isArray(l.data) ? l.data.map(String) : [String(l.data ?? '')];
  const head = [
    logTime(ts), `[${String(l.layer ?? '?').toUpperCase()}]`, l.dir ?? '-',
    l.ue_id !== undefined ? two(Number(l.ue_id), 4) : '-',
    ...(l.cell !== undefined ? [`cell=${l.cell}`] : []), ...(l.rnti !== undefined ? [`rnti=0x${Number(l.rnti).toString(16)}`] : []),
    ...(l.channel ? [String(l.channel)] : []),
    lines[0] ?? '',
  ].join(' ');
  return [head, ...lines.slice(1).map(s => `  ${s}`)].join('\n') + '\n';
}

export async function startLog(req: LogStartRequest): Promise<CaptureJobView> {
  const creds = parseCreds(req.creds);
  const component = (['enb', 'mme', 'ue'] as const).find(c => c === req.component);
  if (!component) throw new Error('component must be enb, mme or ue');
  const apiPort = toPort(req.apiPort, DEFAULT_API_PORT[component]);
  const layers: Record<string, string> = {};
  for (const [layer, level] of Object.entries(req.layers ?? {})) {
    if (!LOG_LAYERS[component].includes(layer)) throw new Error(`Unknown ${component} log layer: ${layer.slice(0, 20)}`);
    if (!(LOG_LEVELS as readonly string[]).includes(level)) throw new Error(`Invalid log level for ${layer}: ${String(level).slice(0, 10)}`);
    layers[layer] = level;
  }
  if (Object.keys(layers).length === 0) throw new Error('Pick at least one log layer');
  const durationSec = clampInt(req.durationSec, 1, LOG_MAX_DURATION_SEC, 30);

  const job = newJob('log', creds, cleanLabel(req.systemName),
    `Log ${component.toUpperCase()} · ${Object.entries(layers).map(([k, v]) => `${k}=${v}`).join(' ')} · ${durationSec}s`);
  job.command = `ws://${creds.host}:${apiPort} config_set logs.layers + log_get loop`;
  job.manifest.log = { component, port: apiPort, durationSec, layers, lines: 0, discontinuities: 0, restored: false };

  const session = new RemoteApiSession(creds.host, apiPort);
  let cfg: any;
  try {
    await session.ready();
    cfg = await session.request({ message: 'config_get' }, 6000);
    await assertHostSpace(64 * 1024 * 1024);
  } catch (e) {
    session.close();
    jobs.delete(job.id);
    throw e;
  }
  runLog(job, session, cfg, layers, durationSec).catch(e => fail(job, e));
  return view(job);
}

async function runLog(job: Job, session: RemoteApiSession, cfg: any, layers: Record<string, string>, durationSec: number) {
  const meta = job.manifest.log!;
  const original = logLevelsFromConfig(cfg);
  const locked = !!cfg?.logs?.locked;
  const file = captureFile(job.id, 'capture.log');
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const out = fs.createWriteStream(file);
  let bytes = 0;
  const write = (s: string) => { bytes += Buffer.byteLength(s); return out.write(s) ? null : new Promise(r => out.once('drain', r)); };

  const changed: Record<string, { level: string }> = {};
  for (const [l, lvl] of Object.entries(layers)) if (original[l] !== lvl) changed[l] = { level: lvl };

  job.stop = async () => { job.stopRequested = true; say(job, 'Stopping…'); };
  try {
    if (locked) job.warnings.push('Log configuration is locked on this component; capturing at its current levels');
    else if (Object.keys(changed).length) {
      const r = await session.request<any>({ message: 'config_set', logs: { layers: changed } }, 6000);
      if (r?.logs === 'locked') job.warnings.push('Log configuration is locked; levels were not changed');
      else say(job, `Raised: ${Object.entries(changed).map(([k, v]) => `${k} ${original[k] ?? '?'}→${v.level}`).join(', ')}`);
    }
    const startMs = Date.now();
    job.state = 'capturing';
    job.captureEndsAt = startMs + durationSec * 1000;
    await write(`# SimTool log capture ${job.id} from ${job.system.host}:${meta.port} (${meta.component}) started ${new Date(startMs).toISOString()}\n# layers ${JSON.stringify(layers)}\n`);
    let first = true;
    while (!job.stopRequested && Date.now() < job.captureEndsAt) {
      const r = await session.request<any>({
        message: 'log_get', min: 1, max: 4096, timeout: 1, allow_empty: true, start_timestamp: startMs, layers,
        ...(first ? { headers: true } : {}),
      }, 15_000);
      if (first && Array.isArray(r.headers)) await write(r.headers.map((h: string) => `# ${h}`).join('\n') + '\n');
      first = false;
      if (r.discontinuity) { meta.discontinuities++; await write(`# discontinuity: ${r.discontinuity} log(s) discarded by the log buffer\n`); }
      for (const l of r.logs ?? []) { await write(formatLogEntry(l)); meta.lines++; }
      if (bytes > LOG_MAX_BYTES) { job.warnings.push(`Stopped at the ${fmtBytes(LOG_MAX_BYTES)} log size limit`); break; }
    }
    say(job, `Captured ${meta.lines} log entries (${fmtBytes(bytes)})`);
  } finally {
    await new Promise(r => out.end(r));
    // Put back what we changed, even when the capture failed.
    const restore: Record<string, { level: string }> = {};
    for (const l of Object.keys(changed)) if (original[l]) restore[l] = { level: original[l] };
    if (Object.keys(restore).length) {
      // The capture socket may have dropped mid-run; the raised levels are
      // global on the box, so restore over a fresh connection in that case.
      const restoreSession = session.isClosed ? new RemoteApiSession(job.system.host, meta.port) : session;
      try {
        await restoreSession.request({ message: 'config_set', logs: { layers: restore } }, 6000);
        meta.restored = true;
        say(job, `Restored: ${Object.entries(restore).map(([k, v]) => `${k}=${v.level}`).join(', ')}`);
      } catch (e: any) {
        job.warnings.push(`Could not restore log levels (${e.message}). Previous levels: ${JSON.stringify(restore)}`);
      } finally {
        if (restoreSession !== session) restoreSession.close();
      }
    } else meta.restored = Object.keys(changed).length === 0;
    session.close();
    job.manifest.files = [{ name: 'capture.log', bytes, kind: 'log' }];
    job.manifest.notes.push(...job.warnings);
    job.manifest.finishedAt = new Date().toISOString();
    job.manifest.state = job.state === 'capturing' ? 'complete' : 'partial';
    await writeManifest(job.manifest).catch(() => {});
    if (job.state === 'capturing') {
      job.state = job.stopRequested ? 'stopped' : 'done';
      job.endedAt = Date.now();
    }
  }
}

// ─── Pcap ────────────────────────────────────────────────────────────────────

export interface PcapStartRequest {
  creds: SshCreds;
  systemName?: string;
  method: 'tcpdump' | 'console';
  filter?: string;
  iface?: string;
  durationSec: number;
}

export async function startPcap(req: PcapStartRequest): Promise<CaptureJobView> {
  const creds = parseCreds(req.creds);
  const durationSec = clampInt(req.durationSec, 1, PCAP_MAX_DURATION_SEC, 30);
  assertFetchable(creds);

  if (req.method === 'console') {
    const job = newJob('pcap', creds, cleanLabel(req.systemName), `eNB MAC-LTE pcap (console) · ${durationSec}s`);
    const p = `/tmp/simtool-enbpcap-${job.id}.pcap`;
    job.consoleCommand = `pcap -d ${durationSec * 1000} -w ${p}`;
    job.command = `lteenb console: ${job.consoleCommand}`;
    job.remote = [{ path: p, bytes: null, localName: 'enb-mac-lte.pcap', meta: { kind: 'pcap' } }];
    job.manifest.pcap = { method: 'console-import', durationSec, linkType: 'DLT 147 (User 0) mac-lte-framed' };
    job.manifest.notes.push('eNB pcap is not available through the remote API; it was recorded with the lteenb console `pcap` command (LTE cells only).');
    job.state = 'ready';
    say(job, 'The remote API has no pcap message. In the lteenb console (screen) run the command below, wait for it to finish, then press Fetch.');
    return view(job);
  }

  if (req.method !== 'tcpdump') throw new Error('method must be tcpdump or console');
  const filterKey = String(req.filter ?? 'control');
  const preset = Object.prototype.hasOwnProperty.call(PCAP_FILTERS, filterKey) ? PCAP_FILTERS[filterKey] : undefined;
  if (!preset) throw new Error('Unknown pcap filter preset');
  const iface = req.iface ?? 'any';
  if (!isIfName(iface)) throw new Error('Invalid interface name');

  const busy = [...jobs.values()].find(j => j.type === 'pcap' && !j.consoleCommand && j.system.host === creds.host && live(j));
  if (busy) throw new Error(`A pcap is already ${busy.state} on ${creds.host} (${busy.id})`);

  const job = newJob('pcap', creds, cleanLabel(req.systemName), `tcpdump ${preset.label} · ${iface} · ${durationSec}s`);
  const remotePath = boxPcapPath(job.id);
  job.remote = [{ path: remotePath, bytes: null, localName: 'capture.pcap', meta: { kind: 'pcap' } }];
  job.manifest.pcap = { method: 'tcpdump', filter: preset.filter, iface, durationSec, linkType: iface === 'any' ? 'Linux cooked (SLL)' : 'Ethernet' };
  const tcpdump = `timeout ${durationSec} tcpdump -i ${shq(iface)} -U -s 0 -w ${shq(remotePath)}${preset.filter ? ` ${shq(preset.filter)}` : ''}`;
  job.command = `ssh ${creds.host}: ${tcpdump}`;

  let box: Box;
  try {
    box = await openBox(creds);
    if (box.kind !== 'ssh') throw new Error('tcpdump needs an SSH login to the callbox');
    const pre = await box.exec('command -v tcpdump >/dev/null && echo HAVE; [ "$(id -u)" = 0 ] && echo ROOT; sudo -n true 2>/dev/null && echo SUDO; true');
    if (!/HAVE/.test(pre.stdout)) throw new Error('tcpdump is not installed on the callbox');
    if (!/ROOT|SUDO/.test(pre.stdout)) throw new Error('tcpdump needs root: log in as root or give the SSH user passwordless sudo');
    const free = await box.freeBytes('/tmp');
    if (free < 256 * 1024 * 1024) throw new Error(`Only ${fmtBytes(free)} free in /tmp on the callbox`);
  } catch (e) {
    jobs.delete(job.id);
    throw e;
  }

  job.state = 'capturing';
  job.captureEndsAt = Date.now() + durationSec * 1000;
  let pid: string | null = null;
  const sudo = '$([ "$(id -u)" = 0 ] || echo "sudo -n")';
  job.stop = async () => {
    job.stopRequested = true;
    // SIGINT makes tcpdump flush and close the file cleanly.
    await box.exec(`${sudo} pkill -INT -f ${shq(`[s]imtool-pcap-${job.id}`)}; true`).catch(() => {});
    if (pid) await box.exec(`kill ${pid} 2>/dev/null; true`).catch(() => {});
  };
  box.exec(`echo "PID $$"; exec ${sudo} ${tcpdump}`, s => {
    const m = !pid && s.match(/PID (\d+)/);
    if (m) pid = m[1];
    say(job, s.replace(/PID \d+\n?/, ''));
  }).then(async r => {
    say(job, r.stderr);
    // timeout exits 124 when the duration elapsed; that is the normal end.
    if (![0, 124, 130, 143, null].includes(r.code)) throw new Error(`tcpdump exited with code ${r.code}: ${r.stderr.split('\n').slice(-2).join(' ')}`);
    box.dispose();
    await refreshSizes(job);
    if (job.remote[0].bytes === null) throw new Error('tcpdump produced no file');
    job.state = 'ready';
    if ((job.totalBytes ?? 0) <= IQ_WARN_BYTES) await fetchJob(job.id);
  }).catch(async e => {
    box.dispose();
    fail(job, e);
    await removeRemote(job).catch(() => {});
  });
  return view(job);
}

export async function startCapture(body: any): Promise<CaptureJobView> {
  switch (body?.type) {
    case 'iq': return startIq(body);
    case 'log': return startLog(body);
    case 'pcap': return startPcap(body);
    default: throw new Error('type must be iq, log or pcap');
  }
}

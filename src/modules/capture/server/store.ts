// On-disk capture store on the SimTool host: data/captures/<id>/ holding the
// fetched files and a manifest.json describing them.
import * as fs from 'fs';
import * as path from 'path';
import { HOST_DISK_RESERVE_BYTES, fmtBytes } from '../lib/limits';
import { isCaptureId, isLocalFileName } from './validate';

/** data/captures under the app root. SIMTOOL_CAPTURES_DIR overrides it (QA). */
export const capturesRoot = () => process.env.SIMTOOL_CAPTURES_DIR || path.join(process.cwd(), 'data', 'captures');

export type CaptureType = 'iq' | 'pcap' | 'log';

export interface ManifestFile {
  name: string;
  bytes: number;
  kind: 'iq' | 'pcap' | 'log' | 'other';
  direction?: 'rx' | 'tx';
  /** Channel index as numbered by trx_iq_dump's %d. */
  channel?: number;
  rfPort?: number;
  sampleRate?: number;
  centerFreqHz?: number;
}

export interface IqCellInfo {
  id: string; rat: 'lte' | 'nr' | 'nbiot'; label?: string; band?: number; pci?: number;
  rfPort: number; dlFreqHz?: number; ulFreqHz?: number; nRbDl?: number; nAntennaDl?: number; nAntennaUl?: number;
}

export interface Manifest {
  version: 1;
  id: string;
  type: CaptureType;
  label: string;
  system: { name: string; host: string };
  createdAt: string;
  finishedAt?: string;
  state: 'complete' | 'partial' | 'failed';
  files: ManifestFile[];
  notes: string[];
  iq?: {
    format: 'float32le-iq-interleaved';
    fullScale: 1;
    durationMs: number;
    directions: ('rx' | 'tx')[];
    rfPorts: number[];
    /** Real rate per port from the trx_iq_dump response. */
    sampleRates: Record<string, number>;
    antennaCount: number;
    dumpUtc?: number;
    rxTimestamp0?: number;
    txTimestamp0?: number;
    rxOverflows?: number;
    txOverflows?: number;
    cells: IqCellInfo[];
    remoteApi: { port: number; response: unknown };
  };
  log?: { component: 'enb' | 'mme' | 'ue'; port: number; durationSec: number; layers: Record<string, string>; lines: number; discontinuities: number; restored: boolean };
  pcap?: { method: 'tcpdump' | 'console-import'; filter?: string; iface?: string; durationSec?: number; linkType?: string };
}

export async function ensureCapturesDir() {
  await fs.promises.mkdir(capturesRoot(), { recursive: true });
}

export function captureDir(id: string): string {
  if (!isCaptureId(id)) throw new Error('Invalid capture id');
  return path.join(capturesRoot(), id);
}

/** Absolute path of a file inside a capture, refusing anything that could
 *  escape data/captures/<id>/. */
export function captureFile(id: string, name: string): string {
  if (!isLocalFileName(name)) throw new Error('Invalid file name');
  const dir = captureDir(id);
  const full = path.resolve(dir, name);
  if (path.dirname(full) !== dir) throw new Error('Invalid file name');
  return full;
}

export async function writeManifest(m: Manifest) {
  const dir = captureDir(m.id);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, '.manifest.json.tmp');
  await fs.promises.writeFile(tmp, JSON.stringify(m, null, 2));
  await fs.promises.rename(tmp, path.join(dir, 'manifest.json'));
}

export async function readManifest(id: string): Promise<Manifest | null> {
  try {
    return JSON.parse(await fs.promises.readFile(path.join(captureDir(id), 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

export interface CaptureSummary extends Manifest { totalBytes: number }

export async function listCaptures(): Promise<CaptureSummary[]> {
  await ensureCapturesDir();
  const entries = await fs.promises.readdir(capturesRoot(), { withFileTypes: true });
  const out: CaptureSummary[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || !isCaptureId(e.name)) continue;
    const m = await readManifest(e.name);
    if (!m) continue;
    // Sizes on disk are the truth (a fetch may have been interrupted).
    let totalBytes = 0;
    for (const f of m.files) {
      try { f.bytes = (await fs.promises.stat(captureFile(m.id, f.name))).size; } catch { f.bytes = 0; }
      totalBytes += f.bytes;
    }
    out.push({ ...m, totalBytes });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteCapture(id: string) {
  const dir = captureDir(id);
  // Only remove directories that look like ours.
  const st = await fs.promises.stat(path.join(dir, 'manifest.json')).catch(() => null);
  if (!st) throw new Error('No such capture');
  await fs.promises.rm(dir, { recursive: true, force: true });
}

export async function hostFreeBytes(): Promise<number> {
  await ensureCapturesDir();
  const s = await fs.promises.statfs(capturesRoot());
  return Number(s.bavail) * Number(s.bsize);
}

/** Throws a user-facing error when `bytes` would not fit with the reserve. */
export async function assertHostSpace(bytes: number) {
  const free = await hostFreeBytes();
  if (free - bytes < HOST_DISK_RESERVE_BYTES) {
    throw new Error(`Not enough disk space on the SimTool host: need ${fmtBytes(bytes)} + ${fmtBytes(HOST_DISK_RESERVE_BYTES)} reserve, ${fmtBytes(free)} free`);
  }
  return free;
}

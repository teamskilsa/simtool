// Quick inspect of a fetched IQ file on the SimTool host. Reads bounded
// slices with positioned reads — never the whole file — so a multi-GiB
// capture costs a few tens of MiB of I/O per request.
import * as fs from 'fs';
import { SpectrumAccumulator, blockPower, decodeFloat32LE, isPow2, type PowerPoint, type Spectrum } from './dsp';
import { captureFile, readManifest } from './store';

export const INSPECT_LIMITS = {
  fftSizes: [256, 512, 1024, 2048, 4096, 8192],
  maxFrames: 256,
  /** Upper bound on bytes read for the spectrum (8192 × 256 × 8 = 16 MiB). */
  maxSpectrumBytes: 8192 * 256 * 8,
  timelinePoints: 300,
  /** Samples per timeline block (≤ 8 MiB total for 300 points). */
  maxTimelineBlock: 4096,
};

export interface InspectRequest {
  id: string;
  file: string;
  /** Where the spectrum slice starts, seconds into the file. */
  offsetSec?: number;
  fftSize?: number;
  frames?: number;
}

export interface InspectResult {
  file: string;
  sampleRate: number;
  sampleRateKnown: boolean;
  centerFreqHz?: number;
  totalSamples: number;
  durationSec: number;
  spectrum: Spectrum & { offsetSec: number; spanSec: number };
  timeline: { blockSamples: number; points: PowerPoint[] };
}

async function readPairs(fd: fs.promises.FileHandle, pairOffset: number, pairs: number): Promise<Float32Array> {
  const bytes = pairs * 8;
  const buf = Buffer.allocUnsafe(bytes);
  const { bytesRead } = await fd.read(buf, 0, bytes, pairOffset * 8);
  return decodeFloat32LE(buf, bytesRead - (bytesRead % 8));
}

export async function inspectIq(req: InspectRequest): Promise<InspectResult> {
  const manifest = await readManifest(req.id);
  if (!manifest) throw new Error('No such capture');
  const entry = manifest.files.find(f => f.name === req.file);
  if (!entry || entry.kind !== 'iq') throw new Error('Not an IQ file of this capture');
  const full = captureFile(req.id, req.file);
  const size = (await fs.promises.stat(full)).size;
  const sampleRate = entry.sampleRate ?? manifest.iq?.sampleRates?.[String(entry.rfPort ?? '')] ?? 0;
  const rate = sampleRate > 0 ? sampleRate : 1; // unknown rate: axis in bins
  const totalSamples = Math.floor(size / 8);
  if (totalSamples < 256) throw new Error('File too short to inspect');

  const fftSize = isPow2(Number(req.fftSize)) && INSPECT_LIMITS.fftSizes.includes(Number(req.fftSize)) ? Number(req.fftSize) : 2048;
  const wantFrames = Math.max(1, Math.min(INSPECT_LIMITS.maxFrames, Math.round(Number(req.frames) || 64)));
  const frames = Math.max(1, Math.min(wantFrames, Math.floor(totalSamples / fftSize)));
  const startSample = Math.max(0, Math.min(totalSamples - fftSize * frames, Math.floor((Number(req.offsetSec) || 0) * rate)));

  const fd = await fs.promises.open(full, 'r');
  try {
    // Spectrum: consecutive frames from the requested offset (Welch, no overlap).
    const acc = new SpectrumAccumulator(fftSize);
    const chunkFrames = 16;
    for (let f = 0; f < frames; f += chunkFrames) {
      const n = Math.min(chunkFrames, frames - f);
      const iq = await readPairs(fd, startSample + f * fftSize, n * fftSize);
      for (let k = 0; k < n && (k + 1) * fftSize * 2 <= iq.length; k++) acc.addFrame(iq, k * fftSize);
    }
    const spectrum = acc.result(rate, 1024);

    // Timeline: evenly spaced ~1 ms blocks across the whole file.
    const blockSamples = Math.max(64, Math.min(INSPECT_LIMITS.maxTimelineBlock, Math.round(rate / 1000)));
    const nPoints = Math.max(1, Math.min(INSPECT_LIMITS.timelinePoints, Math.floor(totalSamples / blockSamples)));
    const stride = (totalSamples - blockSamples) / Math.max(1, nPoints - 1);
    const points: PowerPoint[] = [];
    for (let i = 0; i < nPoints; i++) {
      const at = Math.floor(i * stride);
      const iq = await readPairs(fd, at, blockSamples);
      points.push({ t: at / rate, ...blockPower(iq) });
    }

    return {
      file: req.file,
      sampleRate: rate,
      sampleRateKnown: sampleRate > 0,
      centerFreqHz: entry.centerFreqHz,
      totalSamples,
      durationSec: totalSamples / rate,
      spectrum: { ...spectrum, offsetSec: startSample / rate, spanSec: (frames * fftSize) / rate },
      timeline: { blockSamples, points },
    };
  } finally {
    await fd.close();
  }
}

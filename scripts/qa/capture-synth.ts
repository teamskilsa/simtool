// Synthetic IQ for Capture QA: complex tones plus Gaussian noise, written as
// little-endian float32 interleaved I/Q — the trx_iq_dump file format.
import * as fs from 'fs';

export interface Tone { offsetHz: number; amplitude: number }

/** Deterministic PRNG so failures reproduce. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

export function synthIq(sampleRate: number, samples: number, tones: Tone[], noiseRms = 0.01, seed = 1): Buffer {
  const buf = Buffer.alloc(samples * 8);
  const r = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
  // Per-component sigma so the complex noise has the requested RMS.
  const sigma = noiseRms / Math.SQRT2;
  for (let n = 0; n < samples; n++) {
    let i = 0, q = 0;
    for (const t of tones) {
      const ph = (2 * Math.PI * t.offsetHz * n) / sampleRate;
      i += t.amplitude * Math.cos(ph);
      q += t.amplitude * Math.sin(ph);
    }
    buf.writeFloatLE(i + sigma * gauss(), n * 8);
    buf.writeFloatLE(q + sigma * gauss(), n * 8 + 4);
  }
  return buf;
}

export function writeSynthIq(file: string, sampleRate: number, samples: number, tones: Tone[], noiseRms = 0.01, seed = 1) {
  // Write in chunks so large files never sit in memory at once.
  const fd = fs.openSync(file, 'w');
  try {
    const chunk = 1 << 18;
    for (let off = 0; off < samples; off += chunk) {
      const n = Math.min(chunk, samples - off);
      // Phase-continuous: synthesise from the absolute sample index.
      const b = Buffer.alloc(n * 8);
      const r = rng(seed + off);
      const gauss = () => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
      const sigma = noiseRms / Math.SQRT2;
      for (let k = 0; k < n; k++) {
        let i = 0, q = 0;
        for (const t of tones) {
          const ph = (2 * Math.PI * t.offsetHz * (off + k)) / sampleRate;
          i += t.amplitude * Math.cos(ph);
          q += t.amplitude * Math.sin(ph);
        }
        b.writeFloatLE(i + sigma * gauss(), k * 8);
        b.writeFloatLE(q + sigma * gauss(), k * 8 + 4);
      }
      fs.writeSync(fd, b);
    }
  } finally {
    fs.closeSync(fd);
  }
}

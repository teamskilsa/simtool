// Quick-look DSP for IQ captures: averaged power spectrum and a power
// timeline. Pure functions over float32 I/Q pairs, so the QA script can run
// them on synthetic signals without touching files.
//
// Scaling: dBFS with full scale = 1.0 (Amarisoft float samples sit in
// [-1, 1]). A complex tone A·e^{jωt} reads 20·log10(A) dBFS at its bin, which
// is what the spectrum peak should show for a clean carrier.

export interface SpectrumPoint { /** Offset from the capture centre, Hz. */ f: number; /** dBFS. */ p: number }
export interface Spectrum {
  fftSize: number;
  frames: number;
  sampleRate: number;
  binHz: number;
  /** Display points (max-hold downsampled from fftSize bins). */
  points: SpectrumPoint[];
  /** Strongest bins at full resolution, most powerful first. */
  peaks: SpectrumPoint[];
  /** Median bin power — a rough noise floor. */
  noiseFloorDb: number;
}

const floorDb = (x: number) => 10 * Math.log10(Math.max(x, 1e-20));

/** In-place iterative radix-2 FFT. n must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export const isPow2 = (n: number) => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;

/** Accumulates Hann-windowed |FFT|² over frames of interleaved I/Q. */
export class SpectrumAccumulator {
  readonly acc: Float64Array;
  frames = 0;
  private readonly win: Float64Array;
  private readonly winSum: number;
  private readonly re: Float64Array;
  private readonly im: Float64Array;

  constructor(readonly fftSize: number) {
    if (!isPow2(fftSize)) throw new Error('fftSize must be a power of two');
    this.acc = new Float64Array(fftSize);
    this.win = new Float64Array(fftSize);
    let s = 0;
    for (let i = 0; i < fftSize; i++) { this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / fftSize); s += this.win[i]; }
    this.winSum = s;
    this.re = new Float64Array(fftSize);
    this.im = new Float64Array(fftSize);
  }

  /** iq holds at least fftSize interleaved pairs starting at pair `offset`. */
  addFrame(iq: Float32Array, offset = 0) {
    const n = this.fftSize;
    for (let i = 0; i < n; i++) {
      const w = this.win[i];
      this.re[i] = iq[2 * (offset + i)] * w;
      this.im[i] = iq[2 * (offset + i) + 1] * w;
    }
    fft(this.re, this.im);
    for (let i = 0; i < n; i++) this.acc[i] += this.re[i] * this.re[i] + this.im[i] * this.im[i];
    this.frames++;
  }

  /** fftshifted, averaged spectrum in dBFS, downsampled to ≤ maxPoints. */
  result(sampleRate: number, maxPoints = 1024, nPeaks = 5): Spectrum {
    const n = this.fftSize;
    const binHz = sampleRate / n;
    const norm = Math.max(1, this.frames) * this.winSum * this.winSum;
    // fftshift: bin k (k >= n/2) is a negative frequency.
    const db = new Float64Array(n);
    const freq = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const k = (i + n / 2) % n;
      db[i] = floorDb(this.acc[k] / norm);
      freq[i] = (i - n / 2) * binHz;
    }
    // Max-hold decimation keeps narrow tones visible after downsampling.
    const step = Math.max(1, Math.ceil(n / maxPoints));
    const points: SpectrumPoint[] = [];
    for (let i = 0; i < n; i += step) {
      let best = i;
      for (let j = i + 1; j < Math.min(n, i + step); j++) if (db[j] > db[best]) best = j;
      points.push({ f: freq[i + Math.floor(step / 2)] ?? freq[i], p: db[best] });
    }
    // Local maxima, strongest first, at least 3 bins apart.
    const idx: number[] = [];
    for (let i = 1; i < n - 1; i++) if (db[i] >= db[i - 1] && db[i] > db[i + 1]) idx.push(i);
    idx.sort((a, b) => db[b] - db[a]);
    const picked: number[] = [];
    for (const i of idx) {
      if (picked.length >= nPeaks) break;
      if (picked.every(p => Math.abs(p - i) > 3)) picked.push(i);
    }
    const sorted = Array.from(db).sort((a, b) => a - b);
    return {
      fftSize: n,
      frames: this.frames,
      sampleRate,
      binHz,
      points,
      peaks: picked.map(i => ({ f: freq[i], p: db[i] })),
      noiseFloorDb: sorted[Math.floor(n / 2)],
    };
  }
}

export interface PowerPoint { /** Seconds from the start of the file. */ t: number; rmsDb: number; peakDb: number }

/** RMS and peak power (dBFS) of a block of interleaved I/Q. */
export function blockPower(iq: Float32Array, pairs = iq.length / 2): { rmsDb: number; peakDb: number } {
  let sum = 0, peak = 0;
  for (let i = 0; i < pairs; i++) {
    const p = iq[2 * i] * iq[2 * i] + iq[2 * i + 1] * iq[2 * i + 1];
    sum += p;
    if (p > peak) peak = p;
  }
  return { rmsDb: floorDb(sum / Math.max(1, pairs)), peakDb: floorDb(peak) };
}

/** Decode little-endian float32s regardless of host endianness or alignment. */
export function decodeFloat32LE(buf: Buffer, bytes = buf.length): Float32Array {
  const n = Math.floor(bytes / 4);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readFloatLE(i * 4);
  return out;
}

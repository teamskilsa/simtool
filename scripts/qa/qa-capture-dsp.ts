// Capture DSP + sizing + parsing checks, fully offline.
//
//   npx tsx scripts/qa/qa-capture-dsp.ts
//
// Proves: the FFT is correct, the averaged spectrum puts synthetic tones at
// the right frequency offset (positive and negative) and level, the power
// timeline sees a burst, the file-slice inspector gives the same answer from
// a float32 file on disk, and config_get → RF port mapping / size estimates
// match hand-computed values.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fft, SpectrumAccumulator, blockPower, decodeFloat32LE } from '../../src/modules/capture/server/dsp';
import { estimateSampleRate, iqBytes, iqMaxDurationMs, IQ_MAX_TOTAL_BYTES } from '../../src/modules/capture/lib/limits';
import { portsFromConfig, logLevelsFromConfig } from '../../src/modules/capture/server/probe';
import { formatLogEntry } from '../../src/modules/capture/server/capture.server';
import { boxIqPattern, isCaptureId, isLocalFileName, isConsolePcapPath, isIfName } from '../../src/modules/capture/server/validate';
import { inspectIq } from '../../src/modules/capture/server/inspect.server';
import { synthIq } from './capture-synth';
import { mockConfigGet } from './capture-mock-config';

async function main() {
let failures = 0, passes = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passes++; console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failures++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
};
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

console.log('FFT');
{
  const n = 16, re = new Float64Array(n), im = new Float64Array(n);
  for (let k = 0; k < n; k++) { re[k] = Math.cos((2 * Math.PI * 3 * k) / n); im[k] = Math.sin((2 * Math.PI * 3 * k) / n); }
  fft(re, im);
  const mag = Array.from(re, (r, i) => Math.hypot(r, im[i]));
  check('complex exponential at bin 3 lands in bin 3 only', near(mag[3], n, 1e-9) && mag.every((m, i) => i === 3 || m < 1e-9), `|X[3]|=${mag[3].toFixed(3)}`);
}

console.log('Spectrum on synthetic IQ');
const fs_ = 7.68e6;
const tones = [{ offsetHz: 1.25e6, amplitude: 0.5 }, { offsetHz: -2.0e6, amplitude: 0.05 }];
const buf = synthIq(fs_, 1 << 18, tones, 0.01, 7);
const iq = decodeFloat32LE(buf);
{
  const fftSize = 2048;
  const acc = new SpectrumAccumulator(fftSize);
  for (let f = 0; f < 64; f++) acc.addFrame(iq, f * fftSize);
  const s = acc.result(fs_, 1024);
  const [p0, p1] = s.peaks;
  const binHz = fs_ / fftSize;
  check('strongest peak at +1.25 MHz', near(p0.f, 1.25e6, binHz), `found ${(p0.f / 1e6).toFixed(4)} MHz, bin ${binHz.toFixed(0)} Hz`);
  check('strong tone level ≈ 20·log10(0.5) = −6.0 dBFS', near(p0.p, -6.02, 1.6), `${p0.p.toFixed(2)} dBFS`);
  check('second peak at −2.0 MHz', near(p1.f, -2.0e6, binHz), `found ${(p1.f / 1e6).toFixed(4)} MHz`);
  check('weak tone level ≈ −26 dBFS', near(p1.p, -26.02, 1.6), `${p1.p.toFixed(2)} dBFS`);
  check('noise floor well below the weak tone', s.noiseFloorDb < p1.p - 20, `floor ${s.noiseFloorDb.toFixed(1)} dBFS`);
  check('display downsampled to ≤ 1024 points and spans ±fs/2', s.points.length <= 1024 && s.points[0].f < -3.7e6 && s.points.at(-1)!.f > 3.7e6, `${s.points.length} points`);
  const disp = s.points.reduce((a, b) => (b.p > a.p ? b : a));
  check('max-hold keeps the tone visible in the display points', near(disp.f, 1.25e6, 2 * binHz) && near(disp.p, p0.p, 0.01));
  // Swapping I/Q order (a common bug) would mirror the tone to −1.25 MHz.
  check('sign convention: tone is not mirrored', p0.f > 0);
}

console.log('Power timeline');
{
  const quiet = synthIq(1e6, 1000, [], 0.001, 3);
  const loud = synthIq(1e6, 1000, [{ offsetHz: 1e3, amplitude: 1 }], 0, 4);
  const q = blockPower(decodeFloat32LE(quiet));
  const l = blockPower(decodeFloat32LE(loud));
  check('full-scale tone RMS ≈ 0 dBFS', near(l.rmsDb, 0, 0.01), `${l.rmsDb.toFixed(3)}`);
  check('noise RMS ≈ −60 dBFS', near(q.rmsDb, -60, 1), `${q.rmsDb.toFixed(2)}`);
  check('peak ≥ RMS', q.peakDb >= q.rmsDb && l.peakDb >= l.rmsDb - 1e-9);
}

console.log('Inspector over a file on disk');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'simtool-capqa-'));
  const id = 'abcdef012345';
  const capDir = path.join(dir, 'data', 'captures', id);
  fs.mkdirSync(capDir, { recursive: true });
  fs.writeFileSync(path.join(capDir, 'iq-rx-0.bin'), buf);
  fs.writeFileSync(path.join(capDir, 'manifest.json'), JSON.stringify({
    version: 1, id, type: 'iq', label: 'qa', system: { name: 'qa', host: '127.0.0.1' }, createdAt: new Date().toISOString(), state: 'complete',
    files: [{ name: 'iq-rx-0.bin', bytes: buf.length, kind: 'iq', direction: 'rx', channel: 0, rfPort: 0, sampleRate: fs_, centerFreqHz: 1747.5e6 }], notes: [],
  }));
  process.env.SIMTOOL_CAPTURES_DIR = path.join(dir, 'data', 'captures');
  const r = await inspectIq({ id, file: 'iq-rx-0.bin', fftSize: 4096, frames: 32 });
  delete process.env.SIMTOOL_CAPTURES_DIR;
  const pk = r.spectrum.peaks[0];
  check('file inspector finds the tone at +1.25 MHz', near(pk.f, 1.25e6, fs_ / 4096), `${(pk.f / 1e6).toFixed(4)} MHz`);
  check('absolute frequency = centre + offset', near((r.centerFreqHz ?? 0) + pk.f, 1748.75e6, fs_ / 4096), `${(((r.centerFreqHz ?? 0) + pk.f) / 1e6).toFixed(3)} MHz`);
  check('duration from size and rate', near(r.durationSec, (1 << 18) / fs_, 1e-9), `${r.durationSec.toFixed(4)} s`);
  check('timeline has points and ≈ −6 dBFS RMS (0.5² + 0.05² + noise)', r.timeline.points.length > 10 && r.timeline.points.every(p => near(p.rmsDb, 10 * Math.log10(0.25 + 0.0025 + 1e-4), 0.2)),
    `${r.timeline.points.length} pts, first ${r.timeline.points[0].rmsDb.toFixed(2)} dBFS`);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('Sizing');
check('LTE 100 RB → 30.72 Msps', estimateSampleRate(100, 15e3) === 30.72e6);
check('LTE 50 RB → 15.36 Msps', estimateSampleRate(50, 15e3) === 15.36e6);
check('LTE 25 RB → 7.68 Msps', estimateSampleRate(25, 15e3) === 7.68e6);
check('LTE 6 RB → 1.92 Msps', estimateSampleRate(6, 15e3) === 1.92e6);
check('NR 273 RB @30 kHz → 122.88 Msps', estimateSampleRate(273, 30e3) === 122.88e6);
check('NR 106 RB @30 kHz (40 MHz) → 61.44 Msps', estimateSampleRate(106, 30e3) === 61.44e6);
check('30.72 Msps × 8 B × 2 ant × 1 s = 491.52 MB', iqBytes(30.72e6, 2, 1000) === 491_520_000);
const maxMs = iqMaxDurationMs(30.72e6, 2);
check('4 GiB cap → 8738 ms at 30.72 Msps 2 ant', maxMs === 8738 && iqBytes(30.72e6, 2, maxMs) <= IQ_MAX_TOTAL_BYTES, `${maxMs} ms`);
check('duration never exceeds the documented 30 s', iqMaxDurationMs(1.92e6, 1) === 30_000);

console.log('config_get mapping');
{
  const ports = portsFromConfig(mockConfigGet);
  check('two RF ports found', ports.length === 2, ports.map(p => p.port).join(','));
  const p0 = ports.find(p => p.port === 0)!, p1 = ports.find(p => p.port === 1)!;
  check('port 0 carries LTE cell 1 (band 3)', p0.cells.length === 1 && p0.cells[0].band === 3 && p0.cells[0].rat === 'lte');
  check('port 1 carries NR cell (band 78)', p1.cells[0]?.rat === 'nr' && p1.cells[0].band === 78);
  check('port 0 sample rate from config_get rf_ports', p0.sampleRate === 30.72e6 && p0.sampleRateSource === 'config_get');
  check('port 1 sample rate estimated (no rf_ports entry)', p1.sampleRate === 61.44e6 && p1.sampleRateSource === 'estimate', `${p1.sampleRate}`);
  check('channels per port from rx/tx_channels.port', p0.rxChannels.length === 2 && p1.txChannels.length === 2 && p1.txChannels[0].index === 2);
  check('channel centre freq in Hz', p0.txChannels[0].freqHz === 1842.5e6 && p0.rxChannels[0].freqHz === 1747.5e6);
  const noPortField = portsFromConfig({ ...mockConfigGet, rx_channels: mockConfigGet.rx_channels.map(({ port, ...c }: any) => c), tx_channels: [] });
  check('channels without port field assigned by antenna count', noPortField[1].rxChannels.map(c => c.index).join(',') === '2,3');
  check('log levels read from logs.layers', logLevelsFromConfig(mockConfigGet).rrc === 'info');
}

console.log('Validation');
const re = boxIqPattern('0123456789ab');
check('IQ temp path accepted', re.test('/tmp/simtool-iq-0123456789ab-rx-0.bin'));
check('other ids / traversal rejected', !re.test('/tmp/simtool-iq-0123456789ac-rx-0.bin') && !re.test('/tmp/simtool-iq-0123456789ab-rx-0.bin; rm -rf /') && !re.test('/tmp/../etc/passwd'));
check('capture id format', isCaptureId('0123456789ab') && !isCaptureId('../etc') && !isCaptureId('0123456789AB'));
check('local file names', isLocalFileName('iq-rx-0.bin') && !isLocalFileName('../x') && !isLocalFileName('.hidden') && !isLocalFileName('a/b'));
check('console pcap path', isConsolePcapPath('/tmp/simtool-enbpcap-0123456789ab.pcap') && !isConsolePcapPath('/tmp/enb.pcap'));
check('interface names', isIfName('eth0') && isIfName('any') && !isIfName('eth0;reboot') && !isIfName('$(id)'));

console.log('Log formatting');
{
  const t = new Date(2026, 8, 16, 10, 28, 31, 5).getTime();
  const s = formatLogEntry({ timestamp: t, layer: 'rrc', dir: 'DL', ue_id: 1, data: ['SCCH: RRC connection setup', '{ field 1 }'] });
  check('Amarisoft-like line layout', s === '10:28:31.005 [RRC] DL 0001 SCCH: RRC connection setup\n  { field 1 }\n', JSON.stringify(s));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

// Capture API end to end, offline, against the running dev server.
//
//   npx tsx scripts/qa/qa-capture-api.ts        (SIMTOOL_URL defaults to http://localhost:3000)
//
// Starts the mock remote API (capture-mock-remote-api.ts) on 127.0.0.1:19001
// and drives /api/capture/* with curl-equivalent fetches. The "callbox" is
// 127.0.0.1 with no SSH login, so the capture server uses its loopback QA
// transport (dev builds only) instead of SSH: the SSH fetch itself is NOT
// exercised here — see CAPTURE_LIVE_CHECKLIST.md.
import * as fs from 'fs';
import { startMockRemoteApi } from './capture-mock-remote-api';

const BASE = process.env.SIMTOOL_URL ?? 'http://localhost:3000';
const MOCK_PORT = 19001;
const host = '127.0.0.1';
const creds = { host };

let failures = 0, passes = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passes++; console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failures++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
};
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const post = async (path: string, body: unknown) =>
  (await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const get = async (path: string) => (await fetch(BASE + path)).json();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitJob(id: string, until: (j: any) => boolean, timeoutMs = 60_000) {
  const t0 = Date.now();
  for (;;) {
    const r = await get('/api/capture/jobs');
    const j = r.jobs.find((x: any) => x.id === id);
    if (j && until(j)) return j;
    if (Date.now() - t0 > timeoutMs) throw new Error(`job ${id} timed out in state ${j?.state}: ${JSON.stringify(j?.output?.slice(-5))}`);
    await sleep(300);
  }
}

async function main() {
  const mock = await startMockRemoteApi(MOCK_PORT);
  const created: string[] = [];
  try {
    console.log('Probe');
    const pr = await post('/api/capture/probe', { host, apiPort: MOCK_PORT });
    check('probe succeeds', pr.success, pr.error);
    check('two RF ports with cells', pr.probe?.ports?.length === 2 && pr.probe.ports[0].cells[0].band === 3);
    check('host free space reported', typeof pr.hostFreeBytes === 'number' && pr.hostFreeBytes > 0);
    check('remote API connection sends an Origin header', mock.origins.every(o => o === 'http://simtool'), mock.origins[0]);

    console.log('Validation');
    const bad = [
      [{ action: 'start', type: 'iq', creds: { host: '1.2.3.4;reboot' }, rfPorts: [0], directions: ['rx'], durationMs: 100 }, /IPv4/],
      [{ action: 'start', type: 'iq', creds, apiPort: MOCK_PORT, rfPorts: ['0; rm -rf /'], directions: ['rx'], durationMs: 100 }, /RF port/],
      [{ action: 'start', type: 'iq', creds, apiPort: MOCK_PORT, rfPorts: [7], directions: ['rx'], durationMs: 100 }, /not configured/],
      [{ action: 'start', type: 'iq', creds, apiPort: MOCK_PORT, rfPorts: [0], directions: [], durationMs: 100 }, /RX, TX/],
      [{ action: 'start', type: 'iq', creds, apiPort: MOCK_PORT, rfPorts: [0, 1], directions: ['rx', 'tx'], durationMs: 30000 }, /over the 4\.00 GiB limit/],
      [{ action: 'start', type: 'iq', creds: { host: '192.0.2.10' }, rfPorts: [0], directions: ['rx'], durationMs: 100 }, /no SSH login/],
      [{ action: 'start', type: 'log', creds, apiPort: MOCK_PORT, component: 'enb', layers: { 'rrc;x': 'debug' }, durationSec: 1 }, /Unknown enb log layer/],
      [{ action: 'start', type: 'log', creds, apiPort: MOCK_PORT, component: 'enb', layers: { rrc: 'verbose' }, durationSec: 1 }, /Invalid log level/],
      [{ action: 'start', type: 'pcap', creds, method: 'tcpdump', filter: 'control', iface: 'eth0;id', durationSec: 5 }, /Invalid interface/],
      [{ action: 'start', type: 'pcap', creds, method: 'tcpdump', filter: 'port 22 or $(reboot)', durationSec: 5 }, /Unknown pcap filter/],
      [{ action: 'start', type: 'pcap', creds, method: 'tcpdump', filter: 'control', durationSec: 5 }, /SSH login/],
      [{ action: 'stop', id: '../../etc' }, /Invalid capture id/],
    ] as const;
    for (const [body, re] of bad) {
      const r = await post('/api/capture/jobs', body);
      check(`rejects: ${String(re)}`, !r.success && re.test(r.error ?? ''), r.error);
    }

    console.log('IQ capture RX, port 0, 200 ms, auto-fetch');
    const s1 = await post('/api/capture/jobs', { action: 'start', type: 'iq', creds, systemName: 'Mock box', apiPort: MOCK_PORT, rfPorts: [0], directions: ['rx'], durationMs: 200 });
    check('start accepted', s1.success, s1.error);
    const id = s1.job?.id;
    created.push(id);
    const again = await post('/api/capture/jobs', { action: 'start', type: 'iq', creds, apiPort: MOCK_PORT, rfPorts: [0], directions: ['tx'], durationMs: 100 });
    check('second IQ dump on the same system refused', !again.success && /already/.test(again.error), again.error);
    const j1 = await waitJob(id, j => ['done', 'failed'].includes(j.state));
    check('job done', j1.state === 'done', j1.error ?? j1.state);
    const expectBytes = Math.round(30.72e6 * 0.2) * 8;
    check('remote sizes shown before fetch', j1.remoteFiles.length === 2 && j1.remoteFiles.every((f: any) => f.bytes === expectBytes), `${j1.remoteFiles.map((f: any) => f.bytes)}`);
    check('temp files removed from the "box" /tmp', j1.remoteFiles.every((f: any) => !fs.existsSync(f.path)));
    const dump = mock.history.find(m => m.message === 'trx_iq_dump');
    check('trx_iq_dump message as documented', dump?.duration === 200 && dump?.rf_port === 0 && dump?.rx_filename === `/tmp/simtool-iq-${id}-rx-%d.bin` && dump?.tx_filename === undefined, JSON.stringify(dump));

    const list = await get('/api/capture/files');
    const cap = list.captures.find((c: any) => c.id === id);
    check('capture listed with type/system/size', cap?.type === 'iq' && cap?.system?.name === 'Mock box' && cap?.totalBytes === 2 * expectBytes);
    const m = await get(`/api/capture/download?id=${id}&file=manifest.json`);
    check('manifest: format, rate, freqs, antennas, duration, cells', m.iq?.format === 'float32le-iq-interleaved' && m.iq?.sampleRates?.['0'] === 30.72e6
      && m.files[0].centerFreqHz === 1747.5e6 && m.iq.antennaCount === 2 && m.iq.durationMs === 200 && m.iq.cells[0].band === 3,
      JSON.stringify({ rates: m.iq?.sampleRates, f: m.files?.map((f: any) => [f.name, f.centerFreqHz, f.sampleRate]) }));

    console.log('Inspect');
    for (const [file, expectHz] of [['iq-rx-0.bin', 1.25e6], ['iq-rx-1.bin', 1.75e6]] as const) {
      const ins = await get(`/api/capture/inspect?id=${id}&file=${file}&fftSize=4096&frames=64`);
      const pk = ins.result?.spectrum?.peaks?.[0];
      check(`${file}: tone at ${expectHz / 1e6} MHz offset`, ins.success && near(pk.f, expectHz, 30.72e6 / 4096), ins.error ?? `${(pk.f / 1e6).toFixed(4)} MHz @ ${pk.p.toFixed(1)} dBFS`);
      check(`${file}: tone level ≈ −10.5 dBFS, timeline ≈ −10.5 dBFS RMS`, near(pk.p, -10.46, 1.6) && ins.result.timeline.points.every((p: any) => near(p.rmsDb, -10.46, 0.3)),
        `${ins.result.timeline.points.length} timeline points`);
    }
    const badIns = await get(`/api/capture/inspect?id=${id}&file=..%2F..%2Fpackage.json`);
    check('inspect rejects traversal', !badIns.success);

    console.log('Download');
    const head = await fetch(`${BASE}/api/capture/download?id=${id}&file=iq-rx-0.bin`, { method: 'HEAD' });
    check('Content-Length = file size', Number(head.headers.get('content-length')) === expectBytes);
    const rng = await fetch(`${BASE}/api/capture/download?id=${id}&file=iq-rx-0.bin`, { headers: { Range: 'bytes=8-23' } });
    const part = Buffer.from(await rng.arrayBuffer());
    const local = fs.readFileSync(`data/captures/${id}/iq-rx-0.bin`).subarray(8, 24);
    check('Range request returns 206 and the right bytes', rng.status === 206 && part.equals(local));
    const full = await fetch(`${BASE}/api/capture/download?id=${id}&file=iq-rx-1.bin`);
    let n = 0;
    for await (const chunk of full.body as any) n += chunk.length;
    check('full streamed download size', n === expectBytes, `${n}`);
    const trav = await fetch(`${BASE}/api/capture/download?id=${id}&file=..%2F..%2Fpackage.json`);
    check('download refuses files not in the manifest', trav.status === 404 || trav.status === 400, String(trav.status));

    console.log('IQ TX without auto-fetch → wait → discard');
    const s2 = await post('/api/capture/jobs', { action: 'start', type: 'iq', creds, apiPort: MOCK_PORT, rfPorts: [0], directions: ['tx'], durationMs: 50, autoFetch: false });
    check('start accepted', s2.success, s2.error);
    const j2 = await waitJob(s2.job.id, j => ['ready', 'failed'].includes(j.state));
    check('waits for Fetch with sizes known', j2.awaitingFetch && j2.totalBytes === 2 * Math.round(30.72e6 * 0.05) * 8, `${j2.state} ${j2.totalBytes}`);
    const busy = await post('/api/capture/jobs', { action: 'start', type: 'iq', creds, apiPort: MOCK_PORT, rfPorts: [0], directions: ['rx'], durationMs: 50 });
    check('a waiting capture still blocks a new dump', !busy.success && /waiting to be fetched/.test(busy.error), busy.error);
    const d2 = await post('/api/capture/jobs', { action: 'discard', id: s2.job.id });
    check('discard removes box files', d2.success && d2.job.state === 'discarded' && j2.remoteFiles.every((f: any) => !fs.existsSync(f.path)));
    check('nothing saved for a discarded capture', !fs.existsSync(`data/captures/${s2.job.id}`));

    console.log('Log capture');
    mock.history.length = 0;
    const s3 = await post('/api/capture/jobs', { action: 'start', type: 'log', creds, systemName: 'Mock box', apiPort: MOCK_PORT, component: 'enb', layers: { rrc: 'debug', s1ap: 'info' }, durationSec: 3 });
    check('start accepted', s3.success, s3.error);
    created.push(s3.job?.id);
    const j3 = await waitJob(s3.job.id, j => ['done', 'failed', 'stopped'].includes(j.state), 30_000);
    check('job done', j3.state === 'done', j3.error ?? j3.state);
    const sets = mock.history.filter(x => x.message === 'config_set');
    check('raised rrc to debug only (s1ap already info)', JSON.stringify(sets[0]?.logs) === JSON.stringify({ layers: { rrc: { level: 'debug' } } }), JSON.stringify(sets[0]));
    check('restored rrc to info afterwards', JSON.stringify(sets[1]?.logs) === JSON.stringify({ layers: { rrc: { level: 'info' } } }), JSON.stringify(sets[1]));
    const cfgAfter = await post('/api/capture/probe', { host, apiPort: MOCK_PORT });
    check('box log levels back to original', cfgAfter.probe?.logLayers?.rrc === 'info');
    const logText = fs.readFileSync(`data/captures/${s3.job.id}/capture.log`, 'utf8');
    const lines = logText.split('\n');
    check('log has RRC debug and S1AP info lines', lines.some(l => / \[RRC\] .*rrc debug/.test(l)) && lines.some(l => / \[S1AP\] .*s1ap info/.test(l)));
    check('log excludes unselected layers and S1AP debug', !lines.some(l => /\[(PHY|MAC|NAS)\]/.test(l)) && !lines.some(l => /s1ap debug/.test(l)));
    const lg = mock.history.filter(x => x.message === 'log_get');
    check('log_get long-polls with layers + start_timestamp', lg.length >= 2 && lg.every(x => x.layers?.rrc === 'debug' && typeof x.start_timestamp === 'number' && x.allow_empty === true), `${lg.length} polls`);

    const s4 = await post('/api/capture/jobs', { action: 'start', type: 'log', creds, apiPort: MOCK_PORT, component: 'enb', layers: { phy: 'debug' }, durationSec: 600 });
    created.push(s4.job?.id);
    await sleep(1500);
    await post('/api/capture/jobs', { action: 'stop', id: s4.job.id });
    const j4 = await waitJob(s4.job.id, j => ['done', 'failed', 'stopped'].includes(j.state), 10_000);
    const cfg4 = await post('/api/capture/probe', { host, apiPort: MOCK_PORT });
    check('stop ends a long log capture early and restores phy', j4.state === 'stopped' && cfg4.probe?.logLayers?.phy === 'warn', `${j4.state} phy=${cfg4.probe?.logLayers?.phy}`);

    console.log('Console pcap import');
    const s5 = await post('/api/capture/jobs', { action: 'start', type: 'pcap', creds, method: 'console', durationSec: 10 });
    check('console pcap job gives the console command', s5.success && /^pcap -d 10000 -w \/tmp\/simtool-enbpcap-[a-f0-9]{12}\.pcap$/.test(s5.job.consoleCommand), s5.job?.consoleCommand);
    created.push(s5.job?.id);
    const early = await post('/api/capture/jobs', { action: 'fetch', id: s5.job.id });
    check('fetch before the file exists explains and stays fetchable', !early.success && /run the console command/.test(early.error), early.error);
    const pcapPath = s5.job.consoleCommand.split(' -w ')[1];
    const pcap = Buffer.concat([Buffer.from('d4c3b2a1020004000000000000000000ffff000093000000', 'hex')]);
    fs.writeFileSync(pcapPath, pcap);
    const f5 = await post('/api/capture/jobs', { action: 'fetch', id: s5.job.id });
    check('fetch after console run saves the pcap', f5.success && f5.job.state === 'done', f5.error ?? f5.job?.state);
    check('pcap bytes intact and temp removed', fs.readFileSync(`data/captures/${s5.job.id}/enb-mac-lte.pcap`).equals(pcap) && !fs.existsSync(pcapPath));

    console.log('Delete');
    for (const cid of created.filter(Boolean)) {
      const r = await (await fetch(`${BASE}/api/capture/files?id=${cid}`, { method: 'DELETE' })).json();
      check(`delete ${cid}`, r.success && !fs.existsSync(`data/captures/${cid}`), r.error);
    }
    const r404 = await (await fetch(`${BASE}/api/capture/files?id=..%2F..`, { method: 'DELETE' })).json();
    check('delete rejects bad ids', !r404.success);
  } finally {
    await mock.close();
  }
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

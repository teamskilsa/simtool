#!/usr/bin/env node
// Offline QA for Mobility Scenarios: every seed scenario through the real API
// routes of the running dev server, against scripts/qa/mock-callbox.mjs.
//
//   node scripts/qa/mock-callbox.mjs --cells 6                                   # :19001/:19000
//   node scripts/qa/mock-callbox.mjs --cells 12 --enb-port 19011 --mme-port 19010
//   node scripts/qa/mock-callbox.mjs --no-ho-config --enb-port 19021 --mme-port 19020
//   node scripts/qa/qa-mobility-scenarios.mjs [--base http://localhost:3000] [--only ho-tour,tau]
//
// No phone is used: phone steps are skipped by the runner (reported per run).
// Timings are shortened through run params so the whole suite takes a few minutes.
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://localhost:3000');
const ONLY = opt('only', '')?.split(',').filter(Boolean);
const IMSI = '001010123456789';
const MOCK6 = { host: '127.0.0.1', enbPort: 19001, mmePort: 19000 };
const MOCK12 = { host: '127.0.0.1', enbPort: 19011, mmePort: 19010 };
const MOCK_NOHO = { host: '127.0.0.1', enbPort: 19021, mmePort: 19020 };

const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = (url, body) => fetch(`${BASE}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const get = url => fetch(`${BASE}${url}`).then(r => r.json());

function mockState(mock) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${mock.host}:${mock.enbPort}/`, { origin: 'http://qa' });
    ws.on('message', raw => {
      const m = JSON.parse(String(raw));
      if (m.message === 'ready') ws.send(JSON.stringify({ message: 'mock_state', message_id: 1 }));
      else if (m.message_id === 1) { ws.close(); resolve(m); }
    });
    ws.on('error', reject);
  });
}

async function initialNcells(mock) { return (await mockState(mock)).cells.map(c => ({ id: c.id, ncells: JSON.stringify(c.ncells) })); }

/** The callbox must look exactly as before: gains 0, nothing barred, neighbour lists and log levels unchanged. */
async function checkClean(mock, before, beforeLevels) {
  const s = await mockState(mock);
  const problems = [];
  for (const c of s.cells) {
    if (c.gain !== 0) problems.push(`cell ${c.id} gain ${c.gain}`);
    if (c.barred !== false) problems.push(`cell ${c.id} barred=${c.barred}`);
    const b = before.find(x => x.id === c.id);
    if (b && b.ncells !== JSON.stringify(c.ncells)) problems.push(`cell ${c.id} ncell_list changed`);
  }
  if (JSON.stringify(s.logLevels) !== beforeLevels) problems.push(`log levels changed: ${JSON.stringify(s.logLevels)}`);
  return problems;
}

async function waitRun(id, timeoutMs) {
  const end = Date.now() + timeoutMs;
  let from = 0;
  while (Date.now() < end) {
    const r = await get(`/api/scenarios/jobs?id=${id}&eventsFrom=${from}`);
    if (r.success) {
      from = r.run.eventsTotal;
      if (r.run.endedAt) break;
    }
    await sleep(1000);
  }
  return (await get(`/api/scenarios/runs?id=${id}`)).run;
}

function summarizeRun(run) {
  const metrics = {};
  for (const m of run.metrics) (metrics[m.name] ??= []).push(m.value);
  const mtext = Object.entries(metrics).map(([k, v]) => `${k} avg ${Math.round(v.reduce((a, b) => a + b, 0) / v.length)} (n=${v.length})`).join('; ');
  const skipped = run.steps.filter(s => s.status === 'skipped' && /no phone/.test(s.detail ?? '')).length;
  const tdFail = run.teardown.filter(t => !t.ok);
  return { mtext, skipped, tdFail };
}

async function runSeed(id, mock, params, { label = id, timeoutMs = 180000 } = {}) {
  if (ONLY.length && !ONLY.includes(id)) return null;
  const before = await initialNcells(mock);
  const beforeLevels = JSON.stringify((await mockState(mock)).logLevels);
  const t0 = Date.now();
  const start = await post('/api/scenarios/run', { action: 'start', scenarioId: id, ...mock, imsi: IMSI, params, systemName: 'mock' });
  if (!start.success) { record(label, false, `refused: ${start.error}`); return null; }
  const run = await waitRun(start.run.id, timeoutMs);
  const { mtext, skipped, tdFail } = summarizeRun(run);
  const problems = await checkClean(mock, before, beforeLevels);
  const ok = run.state === 'passed' && tdFail.length === 0 && problems.length === 0;
  record(label, ok,
    `${run.state} in ${((Date.now() - t0) / 1000).toFixed(1)} s; asserts ${run.asserts.passed}/${run.asserts.total} passed` +
    `${run.asserts.warned ? `, ${run.asserts.warned} warned` : ''}${run.asserts.failed ? `, ${run.asserts.failed} FAILED` : ''}; ` +
    `${skipped} phone step(s) skipped; teardown ${run.teardown.length} action(s)${tdFail.length ? ` (${tdFail.length} failed)` : ''}` +
    `${problems.length ? `; NOT CLEAN: ${problems.join(', ')}` : '; callbox clean'}${mtext ? `; ${mtext}` : ''}` +
    `${run.error ? `; error: ${run.error}` : ''}`);
  return run;
}

// ─── 1. Schema + validator ───────────────────────────────────────────────────
{
  const Ajv = require('ajv');
  const schemaFile = path.resolve('src/modules/scenarios/schema/mobility-scenario.schema.json');
  const validate = new Ajv({ allErrors: true, strict: false }).compile(JSON.parse(fs.readFileSync(schemaFile, 'utf8')));
  const dir = path.resolve('src/modules/scenarios/seeds');
  const seeds = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const bad = seeds.filter(s => !validate(s));
  record('JSON schema: all seeds valid', bad.length === 0, `${seeds.length} seeds${bad.length ? `; invalid: ${bad.map(b => b.id)}` : ''}`);
  const evil = { ...seeds[0], id: 'evil', steps: [{ type: 'action', target: 'mme', message: { message: 'ue_del', imsi: IMSI } }] };
  record('JSON schema rejects ue_del', !validate(evil));
  const v = await post('/api/scenarios/library', { action: 'validate', scenario: evil });
  record('Validator API rejects ue_del', v.success && !v.valid && v.issues.some(i => /ue_db/.test(i.msg)), v.issues?.[0]?.msg);
  const missing = { ...seeds[0], id: 'missing', steps: [{ type: 'action', target: 'enb', message: { message: 'handover', pci: 2 } }] };
  const v2 = await post('/api/scenarios/library', { action: 'validate', scenario: missing });
  record('Validator flags missing ran_ue_id', v2.success && !v2.valid && v2.issues.some(i => /ran_ue_id/.test(i.msg)), v2.issues?.map(i => i.msg).join(' | '));
  const lib = await get('/api/scenarios/library');
  record('Library API lists seeds', lib.success && seeds.every(s => lib.scenarios.some(x => x.id === s.id)), `${lib.scenarios?.length} scenario(s)`);
  // save / load / delete round trip
  const copy = { ...seeds[0], id: 'qa-copy', name: 'QA copy', builtin: false };
  const saved = await post('/api/scenarios/library', { action: 'save', scenario: copy });
  const loaded = await get('/api/scenarios/library?id=qa-copy');
  const del = await fetch(`${BASE}/api/scenarios/library?id=qa-copy`, { method: 'DELETE' }).then(r => r.json());
  record('Library save/load/delete', saved.success && loaded.success && loaded.scenario.name === 'QA copy' && del.success);
}

// ─── 2. Preflight refusals ───────────────────────────────────────────────────
if (!ONLY.length) {
  const r = await post('/api/scenarios/run', { action: 'start', scenarioId: 'drive-test', ...MOCK_NOHO, imsi: IMSI });
  const check = r.run?.preflight?.find(c => c.name === 'Measurement handover config');
  record('drive-test refused without ho_from_meas', !r.success && r.run?.state === 'error' && check && !check.ok, check?.detail);
  const r2 = await post('/api/scenarios/run', { action: 'start', scenarioId: 'ho-tour', ...MOCK6, imsi: '001010000000999' });
  record('Unknown IMSI refused', !r2.success && /not known to the MME/.test(r2.error ?? ''), r2.error);
  const r4 = await post('/api/scenarios/run', { action: 'start', scenarioId: 'ho-tour', host: '127.0.0.1', enbPort: 19999, mmePort: 19998, imsi: IMSI });
  record('Unreachable callbox refused', !r4.success && /eNB remote API/.test(r4.error ?? ''), r4.error);
}

// ─── 3. Lock + stop/abort with teardown ─────────────────────────────────────
if (!ONLY.length) {
  const before = await initialNcells(MOCK6);
  const beforeLevels = JSON.stringify((await mockState(MOCK6)).logLevels);
  const a = await post('/api/scenarios/run', { action: 'start', scenarioId: 'ho-tour', ...MOCK6, imsi: IMSI, params: { dwellMs: 3000 } });
  const b = await post('/api/scenarios/run', { action: 'start', scenarioId: 'tau', ...MOCK6, imsi: IMSI });
  record('Second run on the same system refused', a.success && !b.success && /busy/.test(b.error ?? ''), b.error);
  await sleep(4500);
  const drive = await post('/api/scenarios/run', { action: 'start', scenarioId: 'drive-test', ...MOCK12, imsi: IMSI, params: { dwellMs: 700 } });
  await sleep(6000);
  await post('/api/scenarios/jobs', { action: 'stop', id: drive.run?.id });
  const stop = await post('/api/scenarios/jobs', { action: 'stop', id: a.run.id });
  const run = await waitRun(a.run.id, 30000);
  const dt = await waitRun(drive.run.id, 30000);
  const problems = await checkClean(MOCK6, before, beforeLevels);
  const s12 = await mockState(MOCK12);
  const dirty12 = s12.cells.filter(c => c.gain !== 0).map(c => `${c.id}:${c.gain}`);
  record('Stop → aborted + teardown restores callbox', stop.success && run.state === 'aborted' && problems.length === 0,
    `state ${run.state}; teardown: ${run.teardown.map(t => `${t.what}${t.ok ? '' : ' FAILED'}`).join(', ') || 'nothing to undo'}${problems.length ? `; NOT CLEAN: ${problems}` : ''}`);
  record('Stop mid-ramp restores all gains (12-cell drive test)', dt.state === 'aborted' && dirty12.length === 0,
    `teardown ${dt.teardown.filter(t => /gain/.test(t.what)).length} gain restore(s)${dirty12.length ? `; gains left: ${dirty12}` : ''}`);
}

// ─── 3b. Stop in the middle of a change: undo + barring ledger ──────────────
if (!ONLY.length) {
  const scellsOf = async () => { const s = await mockState(MOCK6); return s.ue.contexts.at(-1)?.scells ?? []; };
  // A handover the stopped ho-tour requested just before Stop still completes
  // on the mock ~450 ms later (the UE moves, and its SCells with it); let it
  // land before taking the baseline, or "before" and "mid-run" describe
  // different PCells.
  await sleep(1500);
  const before = await scellsOf();
  const a = await post('/api/scenarios/run', { action: 'start', scenarioId: 'scell-churn', ...MOCK6, imsi: IMSI, params: { settleMs: 5000 } });
  await sleep(1500);
  const mid = await scellsOf();
  await post('/api/scenarios/jobs', { action: 'stop', id: a.run.id });
  const run = await waitRun(a.run.id, 30000);
  await sleep(500);
  const after = await scellsOf();
  const undo = run.teardown.find(x => /undo of rrc_cnx_reconf/.test(x.what));
  record('Stop after "release all SCells" → teardown re-adds them', mid.length === 0 && undo?.ok && JSON.stringify(after) === JSON.stringify(before),
    `before ${JSON.stringify(before)}, mid-run ${JSON.stringify(mid)}, after teardown ${JSON.stringify(after)}`);

  const b = await post('/api/scenarios/run', { action: 'start', scenarioId: 'cell-barring', ...MOCK6, imsi: IMSI, params: { sibWaitMs: 10000 } });
  await sleep(2000);
  const barredMid = (await mockState(MOCK6)).cells.filter(c => c.barred === true).map(c => c.id);
  await post('/api/scenarios/jobs', { action: 'stop', id: b.run.id });
  const runB = await waitRun(b.run.id, 30000);
  const barredAfter = (await mockState(MOCK6)).cells.filter(c => c.barred !== false).map(c => c.id);
  record('Stop while a cell is barred → teardown clears barring', barredMid.length === 1 && barredAfter.length === 0 && runB.state === 'aborted',
    `barred mid-run ${JSON.stringify(barredMid)}, after ${JSON.stringify(barredAfter)}`);
}

// ─── 4. Every seed, 6 cells ──────────────────────────────────────────────────
const runs = [];
runs.push(await runSeed('ho-ping-pong', MOCK6, { iterations: 4, periodMs: 300 }));
runs.push(await runSeed('ho-tour', MOCK6, { dwellMs: 200 }));
runs.push(await runSeed('scell-churn', MOCK6, { iterations: 2, settleMs: 200 }));
runs.push(await runSeed('rrc-idle-cycle', MOCK6, { iterations: 2, idleMs: 200 }));
runs.push(await runSeed('rlf-reestablish', MOCK6, { iterations: 2, settleMs: 500 }));
runs.push(await runSeed('cell-barring', MOCK6, { sibWaitMs: 1500, holdMs: 1000 }));
runs.push(await runSeed('drive-test', MOCK6, { dwellMs: 700, holdMs: 800 }));
runs.push(await runSeed('tau', MOCK6, { iterations: 2, settleMs: 300 }));
// ─── 5. Cell-count agnostic: 12 cells ────────────────────────────────────────
runs.push(await runSeed('ho-tour', MOCK12, { dwellMs: 100 }, { label: 'ho-tour (12 cells)' }));
runs.push(await runSeed('drive-test', MOCK12, { dwellMs: 600, holdMs: 600 }, { label: 'drive-test (12 cells)', timeoutMs: 300000 }));

// ─── 6. History + export ─────────────────────────────────────────────────────
{
  const last = runs.filter(Boolean).at(-1);
  if (last) {
    const list = await get('/api/scenarios/runs?limit=50');
    record('History lists the run', list.success && list.runs.some(r => r.id === last.id));
    const csv = await fetch(`${BASE}/api/scenarios/runs?id=${last.id}&format=csv`).then(r => r.text());
    record('CSV export', csv.startsWith('run_id,scenario') && csv.includes(',assert,') && csv.includes(',metric,'), `${csv.split('\n').length - 1} rows`);
    const json = await fetch(`${BASE}/api/scenarios/runs?id=${last.id}&format=json`).then(r => r.json());
    record('JSON export', json.id === last.id && Array.isArray(json.events));
  }
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

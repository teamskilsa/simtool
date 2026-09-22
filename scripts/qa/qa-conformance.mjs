#!/usr/bin/env node
// Offline QA for Pre-conformance: every automatic case on NR SA and LTE, every
// default plan, the operator-prompt flow (continue / skip / timeout / abort),
// the risky-case confirmation, stop-on-fail, the system lock, report exports
// (HTML / JSON / CSV) and teardown cleanliness — through the real API routes of
// the running dev server, against mocks this script starts and stops itself:
//
//   NR_A    --rat nr  :19101/:19100 ssh :19122  --intra-freq --tac-split   (every NR case can pass)
//   NR_B    --rat nr  :19111/:19110 ssh :19132                             (like testDemo-6cell-2x3CC-HO.cfg)
//   LTE_A   --rat lte :19201/:19200 ssh :19222  --intra-freq               (every LTE case can pass)
//   LTE_MIN --rat lte :19211/:19210 no ssh, --no-ho-config --no-ca         (preconditions not met)
//
//   node scripts/qa/qa-conformance.mjs [--base http://localhost:3000] [--only plans,operator,...]
//
// Sections: api, engine, cases, plans, operator, risky, stopfail, lock, abort, reports.
// Operator actions are simulated with the mock's {"message":"mock_ue"} control
// message (what the person at the bench does to the phone).
import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://localhost:3000');
const ONLY = (opt('only', '') ?? '').split(',').filter(Boolean);
const want = s => !ONLY.length || ONLY.includes(s);
const IMSI = '001010123456789';

const MOCKS = {
  NR_A: { host: '127.0.0.1', enbPort: 19101, mmePort: 19100, ssh: 19122, args: ['--rat', 'nr', '--intra-freq', '--tac-split'] },
  NR_B: { host: '127.0.0.1', enbPort: 19111, mmePort: 19110, ssh: 19132, args: ['--rat', 'nr'] },
  LTE_A: { host: '127.0.0.1', enbPort: 19201, mmePort: 19200, ssh: 19222, args: ['--rat', 'lte', '--intra-freq'] },
  LTE_MIN: { host: '127.0.0.1', enbPort: 19211, mmePort: 19210, ssh: 0, args: ['--rat', 'lte', '--no-ho-config', '--no-ca'] },
};

const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = (url, body) => fetch(`${BASE}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const get = url => fetch(`${BASE}${url}`).then(r => r.json());

// ─── Mocks ───────────────────────────────────────────────────────────────────
const children = [];
async function startMocks() {
  for (const m of Object.values(MOCKS)) {
    const a = ['scripts/qa/mock-callbox.mjs', ...m.args, '--enb-port', String(m.enbPort), '--mme-port', String(m.mmePort), '--reconnect-ms', '5000', '--quiet'];
    if (m.ssh) a.push('--ssh-port', String(m.ssh));
    const c = spawn(process.execPath, a, { stdio: ['ignore', 'inherit', 'inherit'] });
    children.push(c);
  }
  await sleep(1500);
}
function stopMocks() { for (const c of children) { try { c.kill('SIGTERM'); } catch { /* gone */ } } }
process.on('exit', stopMocks);
process.on('SIGINT', () => { stopMocks(); process.exit(130); });

function ctl(mock, msg) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${mock.host}:${mock.enbPort}/`, { origin: 'http://qa' });
    const t = setTimeout(() => { ws.terminate(); reject(new Error('mock control timeout')); }, 5000);
    ws.on('message', raw => {
      const m = JSON.parse(String(raw));
      if (m.message === 'ready') ws.send(JSON.stringify({ ...msg, message_id: 'qa' }));
      else if (m.message_id === 'qa') { clearTimeout(t); ws.close(); resolve(m); }
    });
    ws.on('error', e => { clearTimeout(t); reject(e); });
  });
}
const mockState = mock => ctl(mock, { message: 'mock_state' });

async function snapshot(mock) {
  const s = await mockState(mock);
  return { ncells: JSON.stringify(s.cells.map(c => c.ncells)), levels: JSON.stringify(s.logLevels) };
}
/** The callbox as the case found it: gains 0, nothing barred, neighbours and log levels unchanged, no traffic, SCells configured and active. */
async function clean(mock, before) {
  await sleep(300);
  const s = await mockState(mock);
  const p = [];
  for (const c of s.cells) {
    if (c.gain !== 0) p.push(`cell ${c.id} gain ${c.gain}`);
    if (c.barred !== false) p.push(`cell ${c.id} barred=${c.barred}`);
  }
  if (JSON.stringify(s.cells.map(c => c.ncells)) !== before.ncells) p.push('ncell_list changed');
  if (JSON.stringify(s.logLevels) !== before.levels) p.push(`log levels ${JSON.stringify(s.logLevels)}`);
  if (s.traffic.length) p.push(`traffic still running: ${s.traffic}`);
  const cur = s.ue.contexts.at(-1);
  if (cur) {
    const pc = s.cells.find(c => c.id === cur.pcell);
    if (JSON.stringify([...cur.scells].sort()) !== JSON.stringify([...pc.scells].sort())) p.push(`SCells ${JSON.stringify(cur.scells)} ≠ PCell scell_list ${JSON.stringify(pc.scells)}`);
    if (cur.activated.length !== cur.scells.length) p.push(`only ${cur.activated.length}/${cur.scells.length} SCells active`);
  }
  return p;
}
const target = (mock, extra = {}) => ({
  host: mock.host, enbPort: mock.enbPort, mmePort: mock.mmePort, imsi: IMSI, systemName: 'mock',
  ...(mock.ssh ? { creds: { host: mock.host, port: mock.ssh, username: 'root', password: 'mock' } } : {}),
  ...extra,
});

/**
 * Run a plan and answer operator prompts with `onPrompt(prompt, n)` →
 * 'continue' | 'skip' | 'abort' | null (null: leave it waiting).
 */
async function runPlan(body, { onPrompt, timeoutMs = 600000, onRunning } = {}) {
  const start = await post('/api/conformance/run', { action: 'start', ...body });
  if (!start.success) return { refused: start.error ?? 'refused', run: start.run };
  const id = start.run.id;
  const end = Date.now() + timeoutMs;
  const answered = new Set();
  let n = 0;
  let calledRunning = false;
  while (Date.now() < end) {
    const r = await get(`/api/conformance/jobs?id=${id}`);
    if (r.success) {
      const v = r.run;
      if (!calledRunning && onRunning && v.state === 'running') { calledRunning = true; await onRunning(v); }
      if (v.prompt && !answered.has(v.prompt.id) && onPrompt) {
        const action = await onPrompt(v.prompt, n++);
        if (action) { answered.add(v.prompt.id); await post('/api/conformance/jobs', { action: 'prompt', id, promptId: v.prompt.id, response: action }); }
      }
      if (v.endedAt) return { run: v };
    }
    await sleep(300);
  }
  await post('/api/conformance/jobs', { action: 'abort', id });
  return { run: (await get(`/api/conformance/reports?id=${id}`)).report, timedOut: true };
}
const verdicts = run => Object.fromEntries(run.cases.map(c => [c.caseId, c.verdict]));
const caseOf = (run, id) => run.cases.find(c => c.caseId === id);
const vText = run => run.cases.map(c => `${c.caseId}=${c.verdict}`).join(' ');

// ─── Main ────────────────────────────────────────────────────────────────────
await startMocks();
try {
  const cat = await get('/api/conformance/catalog');
  const CASES = cat.cases ?? [];
  const AUTO = CASES.filter(c => c.automation === 'automatic' && !c.risky).map(c => c.id);

  // ── 1. Catalogue + plans API ────────────────────────────────────────────────
  if (want('api')) {
    record('Catalogue lists ≥15 cases', CASES.length >= 15, `${CASES.length} cases, ${AUTO.length} automatic, ${CASES.filter(c => c.automation === 'operator-prompted').length} operator-prompted`);
    const noRef = CASES.filter(c => (c.rat === 'both' ? ['nr', 'lte'] : [c.rat]).some(r => !(c.specs[r] ?? []).length));
    record('Every case cites a procedure spec for each RAT it supports', noRef.length === 0, noRef.map(c => c.id).join(', '));
    const claims = CASES.filter(c => JSON.stringify(c.specs).match(/523/));
    record('No TS 38.523 / 36.523 test case number is claimed', claims.length === 0, claims.map(c => c.id).join(', '));
    record('Catalogue carries the disclaimer', /not a certified 3GPP conformance result/.test(cat.disclaimer ?? ''));
    const plans = await get('/api/conformance/plans');
    const ids = (plans.plans ?? []).map(p => p.id);
    record('Default plans present', ['nr-sa-smoke', 'nr-sa-mobility-ca', 'lte-smoke', 'lte-mobility-ca', 'full-automatic'].every(x => ids.includes(x)), ids.join(', '));
    const full = plans.plans.find(p => p.id === 'full-automatic');
    record('"Full (all automatic)" excludes the network detach and operator cases', full && !full.cases.some(c => c.caseId === 'PC-REG-03' || CASES.find(x => x.id === c.caseId)?.automation !== 'automatic'), `${full?.cases.length} cases`);
    const bad = await post('/api/conformance/plans', { action: 'save', plan: { id: 'Bad Id', name: '', rat: 'x', cases: [{ caseId: 'nope' }], stopOnFail: 1 } });
    record('Invalid plan rejected', !bad.success && /unknown case/.test(bad.error ?? ''), bad.error);
    const mine = { id: 'qa-plan', name: 'QA plan', description: 'qa', rat: 'nr', stopOnFail: true, cases: [{ caseId: 'PC-RRC-01', params: { signallingTimeoutMs: 4000 } }] };
    const saved = await post('/api/conformance/plans', { action: 'save', plan: mine });
    const loaded = await get('/api/conformance/plans?id=qa-plan');
    const del = await fetch(`${BASE}/api/conformance/plans?id=qa-plan`, { method: 'DELETE' }).then(r => r.json());
    record('Plan save / load / delete', saved.success && loaded.plan?.cases?.[0]?.params?.signallingTimeoutMs === 4000 && del.success);
  }

  // ── 1b. Scenario engine: ordered sequences, withinMs, operator step on the mobility API ──
  if (want('engine')) {
    const mock = MOCKS.LTE_A;
    const base = { schemaVersion: 1, description: 'qa', requirements: { minCells: 2, needsHoConfig: false }, logs: { enb: { rrc: 'debug' } } };
    const ho = [
      { type: 'assert', label: 'connected, one context', expect: { all: [{ path: 'ue.connected', op: 'eq', value: true }, { path: 'ue.contexts', op: 'eq', value: 1 }] }, timeoutMs: 30000, holdMs: 500, capture: { src: 'ue.pcell' } },
      { type: 'action', target: 'enb', mark: 'ho', label: 'handover', ensureNeighbour: true, capture: { tgt: 'cells[(vars.src) % cellCount].id' },
        message: { message: 'handover', ran_ue_id: '${ue.ran_ue_id}', pci: '${cellById[vars.tgt].pci}', dl_earfcn: '${cellById[vars.tgt].earfcn}' } },
    ];
    const seqStep = (items, extra = {}) => ({ type: 'assert', source: 'sequence', label: 'seq', sequence: { since: 'ho', items, ...extra }, timeoutMs: 4000 });
    const reconf = { target: 'enb', layer: 'RRC', msg: 'rrc[\\s_-]*connection[\\s_-]*reconfiguration(?![\\s_-]*complete)', contains: 'mobilityControlInfo', label: 'reconf' };
    const cpl = { target: 'enb', layer: 'RRC', msg: 'rrc[\\s_-]*connection[\\s_-]*reconfiguration[\\s_-]*complete', label: 'complete' };
    const runScenario = async (scenario, onPrompt) => {
      const st = await post('/api/scenarios/run', { action: 'start', scenario, host: mock.host, enbPort: mock.enbPort, mmePort: mock.mmePort, imsi: IMSI });
      if (!st.success) return { state: 'refused', error: st.error };
      for (let i = 0; i < 120; i++) {
        const j = await get(`/api/scenarios/jobs?id=${st.run.id}`);
        if (j.run?.prompt && onPrompt) await post('/api/scenarios/jobs', { action: 'prompt', id: st.run.id, promptId: j.run.prompt.id, response: await onPrompt(j.run.prompt) });
        if (j.run?.endedAt) return j.run;
        await sleep(300);
      }
      return { state: 'timeout' };
    };
    const ok = await runScenario({ ...base, id: 'qa-seq-ok', name: 'qa seq ok', steps: [...ho, seqStep([reconf, cpl], { withinMs: 2000, metrics: [{ name: 'x_ms', from: 0, to: 1 }] })] });
    record('Engine: ordered sequence (reconfiguration → complete) passes with evidence + metric', ok.state === 'passed' && ok.assertResults.at(-1).evidence?.length === 2 && ok.metrics.some(m => m.name === 'x_ms'), `${ok.state}; ${ok.assertResults?.at(-1)?.evidence?.join(' / ')}`);
    const rev = await runScenario({ ...base, id: 'qa-seq-rev', name: 'qa seq reversed', steps: [...ho, seqStep([cpl, reconf])] });
    record('Engine: reversed order is not accepted', rev.state === 'failed' && /missing reconf/.test(rev.error ?? ''), rev.error?.slice(0, 120));
    const fast = await runScenario({ ...base, id: 'qa-seq-within', name: 'qa seq within', steps: [...ho, seqStep([reconf, cpl], { withinMs: 1 })] });
    record('Engine: withinMs enforced on callbox timestamps', fast.state === 'failed' && /within 1 ms \(took \d+ ms\)/.test(fast.error ?? ''), fast.error?.slice(0, 140));
    const opt = await runScenario({ ...base, id: 'qa-seq-opt', name: 'qa seq optional', steps: [...ho, seqStep([{ ...cpl, msg: 'no such message', optional: true, label: 'absent' }, reconf, cpl])] });
    record('Engine: an absent optional item does not block the sequence', opt.state === 'passed', opt.error);
    const op = await runScenario({ ...base, id: 'qa-operator', name: 'qa operator', steps: [{ type: 'operator', prompt: 'Press continue', timeoutMs: 20000 }, { type: 'wait', ms: 100 }] }, async () => 'continue');
    record('Engine: operator step answered through /api/scenarios/jobs (mobility API)', op.state === 'passed', op.state);
    const inc = await runScenario({ ...base, id: 'qa-inconclusive', name: 'qa inconclusive', steps: [{ type: 'assert', source: 'vars', label: 'never', expect: { path: 'vars.nope', op: 'exists' }, timeoutMs: 0, onFail: 'inconclusive', inconclusiveReason: 'precondition' }] });
    record('Engine: onFail inconclusive ends the run INCONCLUSIVE', inc.state === 'inconclusive' && /precondition/.test(inc.inconclusive ?? ''), inc.inconclusive);
    const v = await post('/api/scenarios/library', { action: 'validate', scenario: { ...base, id: 'qa-bad', name: 'bad', steps: [{ type: 'assert', source: 'sequence', sequence: { items: [{ msg: '(' }] }, timeoutMs: 1 }, { type: 'operator', prompt: '', timeoutMs: 5 }] } });
    record('Engine: validator rejects a bad sequence regex and a bad operator step', v.success && !v.valid && v.issues.filter(i => i.level === 'error').length >= 3, v.issues?.map(i => i.msg).join(' | '));
  }

  // ── 2. Every automatic case, NR SA and LTE (the "Full (all automatic)" plan) ──
  if (want('cases')) {
    for (const [key, rat] of [['NR_A', 'nr'], ['LTE_A', 'lte']]) {
      const mock = MOCKS[key];
      const before = await snapshot(mock);
      const t0 = Date.now();
      const { run, refused } = await runPlan(target(mock, { planId: 'full-automatic' }));
      if (refused) { record(`Full (all automatic) on ${key}`, false, refused); continue; }
      const probs = await clean(mock, before);
      record(`Full (all automatic) on ${key} (${rat.toUpperCase()}): every case PASS`, run.state === 'finished' && run.counts.PASS === run.cases.length,
        `${run.counts.PASS}/${run.cases.length} PASS in ${((Date.now() - t0) / 1000).toFixed(0)} s; ${run.cases.filter(c => c.verdict !== 'PASS').map(c => `${c.caseId} ${c.verdict}: ${c.reason}`).join(' | ')}`);
      record(`  teardown clean after the plan on ${key}`, probs.length === 0, probs.join('; '));
      record(`  RAT detected as ${rat} on ${key}`, run.rat === rat, run.rat);
      const kpi = caseOf(run, 'PC-KPI-01');
      record(`  KPI-01 measured handover interruption on ${key}`, !!kpi?.measurement && kpi.measurement.samples >= 1, kpi?.measurement ? `max ${kpi.measurement.value} ms, n=${kpi.measurement.samples}` : kpi?.reason);
      const setup = caseOf(run, 'PC-KPI-02');
      record(`  KPI-02 measured RRC setup latency on ${key}`, !!setup?.measurement && setup.measurement.value > 0, setup?.measurement ? `max ${setup.measurement.value} ms, n=${setup.measurement.samples}` : setup?.reason);
      const ho = caseOf(run, 'PC-MOB-02');
      record(`  MOB-02 evidence has the ${rat === 'nr' ? 'reconfigurationWithSync' : 'mobilityControlInfo'} line on ${key}`, (ho?.evidence ?? []).some(l => (rat === 'nr' ? /reconfigurationWithSync/ : /mobilityControlInfo/).test(l)), ho?.evidence?.[1]);
      const page = caseOf(run, 'PC-IDLE-01');
      record(`  IDLE-01 paging evidence (Paging → setup → Service request) on ${key}`, (page?.evidence ?? []).some(l => /Service request/.test(l)) && (page?.evidence ?? []).some(l => /Paging/.test(l)), page?.evidence?.slice(1, 4).join(' / '));
      const tau = caseOf(run, 'PC-MOB-04');
      record(`  MOB-04 ${rat === 'nr' ? 'mobility registration update' : 'load-balancing TAU'} on ${key}`, tau?.verdict === 'PASS' && (tau.evidence ?? []).some(l => (rat === 'nr' ? /mobility registration updating/ : /Tracking area update/).test(l)), tau?.reason);
    }

    // Preconditions not met: NR config like testDemo-6cell-2x3CC-HO (every cell on its own carrier, one TAC)
    const b = MOCKS.NR_B;
    const beforeB = await snapshot(b);
    const rB = await runPlan(target(b, { planId: 'nr-sa-mobility-ca' }));
    const vB = verdicts(rB.run);
    record('NR 2x3CC-like config: MOB-01 intra-frequency → INCONCLUSIVE (precondition)', vB['PC-MOB-01'] === 'INCONCLUSIVE' && /Precondition not met/.test(caseOf(rB.run, 'PC-MOB-01').reason), caseOf(rB.run, 'PC-MOB-01').reason);
    record('NR 2x3CC-like config: MOB-04 without a second TAC → INCONCLUSIVE', vB['PC-MOB-04'] === 'INCONCLUSIVE' && /TAC/.test(caseOf(rB.run, 'PC-MOB-04').reason), caseOf(rB.run, 'PC-MOB-04').reason);
    record('NR 2x3CC-like config: the rest of "NR SA mobility & CA" PASS', ['PC-MOB-02', 'PC-MOB-03', 'PC-CA-01', 'PC-CA-02', 'PC-SI-01', 'PC-KPI-01'].every(k => vB[k] === 'PASS'), vText(rB.run));
    record('  teardown clean (NR_B)', (await clean(b, beforeB)).length === 0, (await clean(b, beforeB)).join('; '));

    const m = MOCKS.LTE_MIN;
    const beforeM = await snapshot(m);
    const rM = await runPlan(target(m, { planId: 'full-automatic' }));
    const vM = verdicts(rM.run);
    record('LTE without HO config / CA / SSH: MOB-03, CA-01, CA-02, IDLE-01 → INCONCLUSIVE with a reason',
      ['PC-MOB-03', 'PC-CA-01', 'PC-CA-02', 'PC-IDLE-01'].every(k => vM[k] === 'INCONCLUSIVE'),
      ['PC-MOB-03', 'PC-CA-01', 'PC-IDLE-01'].map(k => `${k}: ${caseOf(rM.run, k).reason.slice(0, 90)}`).join(' | '));
    record('LTE without SSH: RRC-01, RRC-02, MOB-02, MOB-04 still PASS (UE reconnects on its own)', ['PC-RRC-01', 'PC-RRC-02', 'PC-MOB-02', 'PC-MOB-04', 'PC-REG-02'].every(k => vM[k] === 'PASS'), vText(rM.run));
    record('  teardown clean (LTE_MIN)', (await clean(m, beforeM)).length === 0);

    // Re-establishment replaced by a fresh setup → INCONCLUSIVE with the explanation
    await ctl(MOCKS.NR_A, { message: 'mock_set', reestMode: 'setup' });
    const rS = await runPlan(target(MOCKS.NR_A, { plan: { id: 'qa-reest', name: 'QA reest', description: '', rat: 'nr', stopOnFail: false, cases: [{ caseId: 'PC-RRC-02' }] } }));
    await ctl(MOCKS.NR_A, { message: 'mock_set', reestMode: 'reestablish' });
    const c2 = caseOf(rS.run, 'PC-RRC-02');
    record('RLF answered by a fresh RRC setup → INCONCLUSIVE (explained)', c2.verdict === 'INCONCLUSIVE' && /fresh RRC setup/.test(c2.reason), c2.reason.slice(0, 140));
  }

  // ── 3. The other default plans ─────────────────────────────────────────────
  if (want('plans')) {
    for (const [planId, key] of [['nr-sa-smoke', 'NR_A'], ['nr-sa-mobility-ca', 'NR_A'], ['lte-smoke', 'LTE_A'], ['lte-mobility-ca', 'LTE_A']]) {
      const mock = MOCKS[key];
      const before = await snapshot(mock);
      const { run, refused } = await runPlan(target(mock, { planId }));
      if (refused) { record(`Plan ${planId} on ${key}`, false, refused); continue; }
      const probs = await clean(mock, before);
      record(`Plan ${planId} on ${key}: all PASS, callbox clean`, run.counts.PASS === run.cases.length && probs.length === 0, `${vText(run)}${probs.length ? `; NOT CLEAN: ${probs}` : ''}`);
    }
    const wrong = await post('/api/conformance/run', { action: 'start', ...target(MOCKS.NR_A, { planId: 'lte-smoke' }) });
    record('LTE plan on an NR SA UE refused with a plain reason', !wrong.success && /This plan is for LTE/.test(wrong.error ?? ''), wrong.error);
    const pf = await post('/api/conformance/run', { action: 'preflight', ...target(MOCKS.NR_B, { planId: 'nr-sa-mobility-ca' }) });
    const pfIntra = pf.cases?.find(c => c.caseId === 'PC-MOB-01');
    record('Pre-check lists per-case readiness (intra-frequency not ready on NR_B)', pf.success && pf.rat === 'nr' && pfIntra && !pfIntra.ok, pfIntra?.detail?.slice(0, 120));
  }

  // ── 4. Operator prompts ───────────────────────────────────────────────────
  if (want('operator')) {
    for (const key of ['NR_A', 'LTE_A']) {
      const mock = MOCKS[key];
      const plan = { id: 'qa-operator', name: 'QA operator', description: '', rat: 'auto', stopOnFail: false, cases: [{ caseId: 'PC-REG-01' }, { caseId: 'PC-REG-04' }, { caseId: 'PC-REG-02' }] };
      const texts = [];
      const { run } = await runPlan(target(mock, { plan }), {
        onPrompt: async (p) => {
          texts.push(p.text);
          if (/airplane mode ON/i.test(p.text)) await ctl(mock, { message: 'mock_ue', action: 'power_off' });
          else if (/airplane mode OFF/i.test(p.text)) await ctl(mock, { message: 'mock_ue', action: 'power_on' });
          await sleep(1500);
          return 'continue';
        },
      });
      const v = verdicts(run);
      record(`Operator-prompted registration + UE detach on ${key}: Continue → PASS`, v['PC-REG-01'] === 'PASS' && v['PC-REG-04'] === 'PASS' && v['PC-REG-02'] === 'PASS',
        `${vText(run)}; prompts: ${texts.length}; ${caseOf(run, 'PC-REG-01').evidence.filter(l => /request|accept|complete/i.test(l)).length} NAS lines matched`);
    }
    // Skip → INCONCLUSIVE
    const rSkip = await runPlan(target(MOCKS.NR_A, { plan: { id: 'qa-skip', name: 'QA skip', description: '', rat: 'nr', stopOnFail: false, cases: [{ caseId: 'PC-REG-04' }] } }), { onPrompt: async () => 'skip' });
    const cs = caseOf(rSkip.run, 'PC-REG-04');
    record('Operator Skip → INCONCLUSIVE', cs.verdict === 'INCONCLUSIVE' && /skipped/i.test(cs.reason), cs.reason);
    // Timeout → INCONCLUSIVE
    const rTo = await runPlan(target(MOCKS.NR_A, { plan: { id: 'qa-timeout', name: 'QA timeout', description: '', rat: 'nr', stopOnFail: false, cases: [{ caseId: 'PC-REG-01', params: { operatorTimeoutMs: 3000 } }] } }), { onPrompt: async () => null });
    const ct = caseOf(rTo.run, 'PC-REG-01');
    record('No operator answer → INCONCLUSIVE after the timeout', ct.verdict === 'INCONCLUSIVE' && /No operator response within 3 s/.test(ct.reason), ct.reason);
    // Abort from the prompt → plan aborted, rest NOT_RUN
    const rAb = await runPlan(target(MOCKS.NR_A, { plan: { id: 'qa-abort', name: 'QA abort', description: '', rat: 'nr', stopOnFail: false, cases: [{ caseId: 'PC-REG-04' }, { caseId: 'PC-RRC-01' }] } }), { onPrompt: async () => 'abort' });
    record('Operator Abort → plan aborted, later cases NOT RUN', rAb.run.state === 'aborted' && caseOf(rAb.run, 'PC-RRC-01').verdict === 'NOT_RUN', `${rAb.run.state}; ${vText(rAb.run)}`);
    // The pending prompt is exposed on the scenario jobs API too
    const st = await mockState(MOCKS.NR_A);
    record('UE left registered after the operator tests', st.ue.registered && st.ue.poweredOn);
  }

  // ── 5. Risky case: network-initiated detach ─────────────────────────────────
  if (want('risky')) {
    const plan = { id: 'qa-risky', name: 'QA risky', description: '', rat: 'auto', stopOnFail: false, cases: [{ caseId: 'PC-REG-03' }] };
    const r1 = await runPlan(target(MOCKS.LTE_A, { plan }));
    const c1 = caseOf(r1.run, 'PC-REG-03');
    record('Network detach without confirmation → NOT RUN', c1.verdict === 'NOT_RUN' && /confirmation/.test(c1.reason), c1.reason.slice(0, 100));
    for (const key of ['LTE_A', 'NR_A']) {
      const r2 = await runPlan(target(MOCKS[key], { plan, confirmRisky: ['PC-REG-03'] }), { onPrompt: async () => 'continue' });
      const c2 = caseOf(r2.run, 'PC-REG-03');
      record(`Network detach confirmed on ${key} (cause -1, re-attach required) → PASS`, c2.verdict === 'PASS' && r2.run.confirmedRisky.includes('PC-REG-03'), `${c2.reason} ${c2.evidence.filter(l => /Detach|Deregistration/.test(l)).join(' / ').slice(0, 160)}`);
    }
    // The runner itself refuses ue_detach without the flag, and any unsafe form.
    const v = await post('/api/scenarios/library', { action: 'validate', scenario: { id: 'x', name: 'x', description: '', schemaVersion: 1, requirements: { minCells: 1, needsHoConfig: false }, steps: [{ type: 'action', target: 'mme', message: { message: 'ue_detach', imsi: IMSI } }] } });
    record('Validator still rejects ue_detach with the default (SIM-locking) cause', v.success && !v.valid, v.issues?.[0]?.msg);
  }

  // ── 6. Stop on fail ─────────────────────────────────────────────────────────
  if (want('stopfail')) {
    const plan = { id: 'qa-stopfail', name: 'QA stop on fail', description: '', rat: 'nr', stopOnFail: true, cases: [{ caseId: 'PC-KPI-01', params: { thresholdMs: 1, handovers: 2 } }, { caseId: 'PC-RRC-01' }] };
    const r = await runPlan(target(MOCKS.NR_A, { plan }));
    const k = caseOf(r.run, 'PC-KPI-01');
    record('Measurement over threshold → FAIL; stop on fail → next case NOT RUN', k.verdict === 'FAIL' && caseOf(r.run, 'PC-RRC-01').verdict === 'NOT_RUN' && /stop on fail/.test(caseOf(r.run, 'PC-RRC-01').reason), `${k.reason} | ${caseOf(r.run, 'PC-RRC-01').reason}`);
  }

  // ── 7. One run per system ───────────────────────────────────────────────────
  if (want('lock')) {
    const plan = { id: 'qa-lock', name: 'QA lock', description: '', rat: 'nr', stopOnFail: false, cases: [{ caseId: 'PC-KPI-01', params: { handovers: 3 } }] };
    let mobilityRefusal = '';
    let planRefusal = '';
    await runPlan(target(MOCKS.NR_A, { plan }), {
      onRunning: async () => {
        const m = await post('/api/scenarios/run', { action: 'start', scenarioId: 'tau', host: '127.0.0.1', enbPort: MOCKS.NR_A.enbPort, mmePort: MOCKS.NR_A.mmePort, imsi: IMSI });
        mobilityRefusal = m.success ? 'STARTED' : m.error;
        const p = await post('/api/conformance/run', { action: 'start', ...target(MOCKS.NR_A, { plan }) });
        planRefusal = p.success ? 'STARTED' : p.error;
      },
    });
    record('A mobility run is refused while a plan holds the system', /busy|reserved/.test(mobilityRefusal), mobilityRefusal);
    record('A second plan is refused on the same system', /busy|reserved/.test(planRefusal), planRefusal);
    // …and a plan is refused while a mobility run is active
    const mob = await post('/api/scenarios/run', { action: 'start', scenarioId: 'ho-ping-pong', host: '127.0.0.1', enbPort: MOCKS.LTE_A.enbPort, mmePort: MOCKS.LTE_A.mmePort, imsi: IMSI, params: { iterations: 4, periodMs: 1500 } });
    await sleep(500);
    const p2 = await post('/api/conformance/run', { action: 'start', ...target(MOCKS.LTE_A, { planId: 'lte-smoke' }) });
    record('A plan is refused while a mobility run is active on the system', mob.success && !p2.success && /busy/.test(p2.error ?? ''), p2.error);
    if (mob.run?.id) { await post('/api/scenarios/jobs', { action: 'stop', id: mob.run.id }); await sleep(2500); }
  }

  // ── 8. Abort mid-plan ───────────────────────────────────────────────────────
  if (want('abort')) {
    const mock = MOCKS.LTE_A;
    const before = await snapshot(mock);
    const start = await post('/api/conformance/run', { action: 'start', ...target(mock, { plan: { id: 'qa-midabort', name: 'QA mid abort', description: '', rat: 'lte', stopOnFail: false, cases: [{ caseId: 'PC-MOB-03', params: { dwellMs: 3000 } }, { caseId: 'PC-RRC-01' }] } }) });
    await sleep(5000);
    await post('/api/conformance/jobs', { action: 'abort', id: start.run.id });
    let run;
    for (let i = 0; i < 60; i++) { run = (await get(`/api/conformance/jobs?id=${start.run.id}`)).run; if (run?.endedAt) break; await sleep(500); }
    const probs = await clean(mock, before);
    record('Abort mid-ramp → plan aborted, gains/traffic restored', run.state === 'aborted' && caseOf(run, 'PC-RRC-01').verdict === 'NOT_RUN' && probs.length === 0, `${vText(run)}${probs.length ? `; NOT CLEAN: ${probs}` : ''}`);
  }

  // ── 9. Reports ──────────────────────────────────────────────────────────────
  if (want('reports')) {
    const list = await get('/api/conformance/reports?limit=100');
    const last = list.reports?.find(r => r.state === 'finished' && r.total >= 4) ?? list.reports?.[0];
    record('Reports are listed', list.success && list.reports.length > 0, `${list.reports?.length} report(s)`);
    if (last) {
      const rep = (await get(`/api/conformance/reports?id=${last.id}`)).report;
      const html = await fetch(`${BASE}/api/conformance/reports?id=${last.id}&format=html`).then(r => r.text());
      const csv = await fetch(`${BASE}/api/conformance/reports?id=${last.id}&format=csv`).then(r => r.text());
      const json = await fetch(`${BASE}/api/conformance/reports?id=${last.id}&format=json`).then(r => r.json());
      const dis = /Pre-conformance — not a certified 3GPP conformance result/;
      record('HTML report: disclaimer, summary, software version, every case', dis.test(html) && html.includes('<h2>Summary</h2>') && html.includes(rep.callbox.enb?.version ?? '§') && rep.cases.every(c => html.includes(c.caseId)), `${html.length} bytes`);
      const lines = csv.trim().split('\n');
      record('CSV report: disclaimer row, header, one row per case', dis.test(lines[0]) && lines[1].startsWith('report_id,') && lines.length === rep.cases.length + 2 && lines.slice(2).every(l => dis.test(l)), `${lines.length} lines`);
      record('JSON report: disclaimer, counts, per-case evidence', dis.test(json.disclaimer) && json.counts && json.cases.every(c => Array.isArray(c.evidence) && c.verdict), `${json.cases.length} cases, ${JSON.stringify(json.counts)}`);
      record('Report records software version, cell config and IMSI', !!rep.callbox.enb?.version && rep.cellSummary.length > 0 && rep.ue.imsi === IMSI, `${rep.callbox.enb?.version}; ${rep.cellSummary[0]}`);
      const perCaseRuns = rep.cases.filter(c => c.runId);
      const one = perCaseRuns[0] ? await get(`/api/scenarios/runs?id=${perCaseRuns[0].runId}`) : null;
      record('Each case has its own scenario run record', perCaseRuns.length > 0 && one?.success, `${perCaseRuns.length} run records`);
    }
  }
} finally {
  stopMocks();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await sleep(300);
process.exit(failed.length ? 1 : 0);

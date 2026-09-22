// Mobility Scenario runner (server only).
//
// One Run owns: a persistent WebSocket to the eNB (:9001) and MME (:9000),
// optional log_get collectors, an optional phone, and a teardown ledger. The
// ledger is filled as side effects happen (gains touched, cells barred,
// neighbours added, log levels raised, undo messages, traffic jobs, airplane
// mode) and replayed in `finally`, so a failed assert, an exception or Stop
// all leave the callbox as they found it.
//
// Registry and per-host locks live on globalThis so Next dev hot reloads
// don't orphan a running scenario (same approach as traffic.server.ts).
import * as crypto from 'crypto';
import type {
  ActionStep, AssertRecord, AssertStep, CellInfo, Condition, LogSeqItem, LoopStep, MetricRecord, MobilityScenario,
  OperatorStep, PhoneActionStep, PreflightCheck, PromptResponse, RampStep, RemoteActionStep, RunEvent, RunRequest, RunView, Step,
  StepRecord, StepStatus, TeardownRecord, TrafficStep, WaitStep,
} from '../types';
import { evalCondition, evaluate, hasPlaceholder, resolveDeep } from '../lib/expr';
import { BLOCKED, GAIN_MAX, GAIN_MIN, isSafeDetach } from '../lib/catalog';
import { validateScenario } from '../lib/validate';
import { LogCollector, RemoteApiError, RemoteConn } from './remoteConn';
import * as phone from './phone';
import { getScenario, saveRun, summarize } from './store';
import { isIPv4, isSerial, startJob, stopJob } from '@/modules/traffic/server/traffic.server';

// ─── Registry ───────────────────────────────────────────────────────────────
const g = globalThis as unknown as {
  __simtoolMobilityRuns?: Map<string, Run>; __simtoolMobilityLocks?: Map<string, string>;
  __simtoolSystemReservations?: Map<string, { token: string; label: string }>;
};
const runs: Map<string, Run> = g.__simtoolMobilityRuns ?? (g.__simtoolMobilityRuns = new Map());
const locks: Map<string, string> = g.__simtoolMobilityLocks ?? (g.__simtoolMobilityLocks = new Map());
/** Longer-lived holds on a system (a pre-conformance plan runs many scenarios
 *  back to back); a run is only allowed through with the matching token. */
const reservations: Map<string, { token: string; label: string }> = g.__simtoolSystemReservations ?? (g.__simtoolSystemReservations = new Map());

const MAX_EVENTS = 5000;
const DEFAULT_MAX_MS = 30 * 60_000;

class Aborted extends Error { constructor(reason: string) { super(reason); } }
class StepFailed extends Error { constructor(msg: string, public path: string) { super(msg); } }
/** Ends the run INCONCLUSIVE: a precondition or the test system, not the UE. */
class Inconclusive extends Error { constructor(msg: string, public path?: string) { super(msg); } }

const short = (v: unknown, n = 240) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s && s.length > n ? `${s.slice(0, n)}…` : s ?? '';
};
const toNum = (v: unknown, what: string) => {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) throw new Error(`${what} is not a number (${JSON.stringify(v)})`);
  return n;
};
const gatewayFor = (ip?: string) => (ip && isIPv4(ip) ? ip.split('.').slice(0, 3).concat('1').join('.') : undefined);

interface UeSnap {
  connected: boolean; contexts: number;
  enb_ue_id?: number; ran_ue_id?: number; mme_ue_id?: number; rnti?: number;
  pcell?: number; scells: number[]; scellList: { cell_id: number }[];
  pci?: number; earfcn?: number;
  imsi: string; imei?: string; ip?: string; registered: boolean; m_tmsi?: number; tac?: number;
}

/** A "system" is its eNB remote API endpoint (host:port), so mocks on one host don't collide. */
const lockKey = (host: string, enbPort?: number) => `${host}:${enbPort ?? 9001}`;
export function lockedBy(host: string, enbPort?: number) { return locks.get(lockKey(host, enbPort)); }

/** Hold a system for a batch of runs. Refused while another run or
 *  reservation holds it. Returns the token runs must present. */
export function reserveSystem(host: string, enbPort: number | undefined, label: string): string {
  const key = lockKey(host, enbPort);
  const holder = locks.get(key);
  if (holder) {
    const other = runs.get(holder);
    throw new Error(`System ${host} is busy with mobility run ${holder}${other ? ` (${other.view.scenarioName}, ${other.view.state})` : ''} — stop it first`);
  }
  const r = reservations.get(key);
  if (r) throw new Error(`System ${host} is reserved by ${r.label}`);
  const token = crypto.randomBytes(8).toString('hex');
  reservations.set(key, { token, label });
  return token;
}
export function releaseSystem(host: string, enbPort: number | undefined, token: string) {
  const key = lockKey(host, enbPort);
  if (reservations.get(key)?.token === token) reservations.delete(key);
}
export function reservedBy(host: string, enbPort?: number) { return reservations.get(lockKey(host, enbPort))?.label; }

/**
 * eNB `config_get` → the cell view every run works from. LTE cells
 * (config_get.cells) and NR cells (config_get.nr_cells) both take part: an NR
 * SA config has an empty cell_list, and its handovers key off ssb_nr_arfcn
 * instead of dl_earfcn.
 *
 * Extracted from Run.loadCells so /api/scenarios/cells can show the same list
 * in the Run panel without starting a run. Pure: no run state is touched.
 */
export function parseCells(cfg: any): CellInfo[] {
  const lte: CellInfo[] = Object.entries(cfg?.cells ?? {}).map(([k, c]: [string, any]) => {
    const cm = c.connected_mobility;
    return {
      id: Number(k), pci: Number(c.n_id_cell), earfcn: Number(c.dl_earfcn), band: c.band, rat: 'lte' as const,
      gain: typeof c.gain === 'number' ? c.gain : 0, eci: c.ecgi?.eci, plmn: c.ecgi?.plmn, tac: c.tac,
      barred: c.cell_barred, hasMeasConfig: !!cm,
      hoFromMeas: !!(cm && (cm.eutra_handover_intra || cm.eutra_handover_inter)),
      scells: (c.scell_list ?? []).map((s: any) => Number(s.cell_id)),
    };
  });
  const nr: CellInfo[] = Object.entries(cfg?.nr_cells ?? {}).map(([k, c]: [string, any]) => {
    const cm = c.connected_mobility;
    return {
      id: Number(k), pci: Number(c.n_id_nrcell ?? c.n_id_cell), earfcn: Number(c.dl_nr_arfcn),
      ssb: Number(c.ssb_nr_arfcn), band: c.band, rat: 'nr' as const,
      gain: typeof c.gain === 'number' ? c.gain : 0, eci: c.ncgi?.nci ?? c.ncgi?.eci, plmn: c.ncgi?.plmn, tac: c.tac,
      barred: c.cell_barred, hasMeasConfig: !!cm,
      hoFromMeas: !!(cm && (cm.nr_handover || cm.nr_handover_intra || cm.nr_handover_inter
        || cm.eutra_handover_intra || cm.eutra_handover_inter)),
      scells: (c.scell_list ?? []).map((s: any) => Number(s.cell_id)),
    };
  });
  return [...lte, ...nr].filter(c => Number.isFinite(c.id)).sort((a, b) => a.id - b.id);
}

/** Read-only cell list for the UI: connect, config_get, parse, disconnect. */
export async function readCells(host: string, enbPort = 9001): Promise<CellInfo[]> {
  if (!isIPv4(host)) throw new Error('host must be an IPv4 address');
  if (!(Number.isInteger(enbPort) && enbPort > 0 && enbPort < 65536)) throw new Error('bad port');
  const conn = new RemoteConn('eNB', host, enbPort);
  try {
    await conn.connect();
    return parseCells(await conn.send<any>({ message: 'config_get' }));
  } finally { conn.close(); }
}

export class Run {
  view: RunView;
  private enb: RemoteConn;
  private mme: RemoteConn;
  private logs: Partial<Record<'enb' | 'mme', LogCollector>> = {};
  private abortReason: string | null = null;
  /** Events dropped from the front of view.events (keeps eventsFrom indexes absolute). */
  eventsDropped = 0;
  private wakeups = new Set<() => void>();

  // ctx
  private ue: UeSnap;
  private mmeUe: any = null;
  private enbUeCount = 0;
  private vars: Record<string, unknown> = {};
  private replies: Record<string, unknown> = {};
  private marks: Record<string, number> = {};
  private phoneCtx: Record<string, unknown> = {};
  private loopStack: { i: number; n: number }[] = [];

  // teardown ledger
  private undos: { key?: string; target: 'enb' | 'mme'; message: Record<string, unknown>; label: string }[] = [];
  private gains = new Map<number, number>();
  private originalGain = new Map<number, number>();
  private barredTouched = new Set<number>();
  private ncellsAdded: { cell_id: number; n_id_cell: number; dl_arfcn?: number }[] = [];
  private logRestore: Partial<Record<'enb' | 'mme', Record<string, string>>> = {};
  private trafficJobs = new Map<string, string>();
  private bgPing: phone.BackgroundPing | null = null;
  private airplaneOn = false;
  private phoneOk = false;
  private barredTouchedNr = new Set<number>();
  private promptWaiter: { id: string; done: (r: PromptResponse | 'timeout') => void } | null = null;
  /** Hook for callers that orchestrate runs (pre-conformance): resolves when the run has ended. */
  finished: Promise<void>;
  private markFinished!: () => void;

  constructor(private req: RunRequest, private scenario: MobilityScenario) {
    const id = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(4).toString('hex')}`;
    const params = { ...(scenario.params ?? {}), ...(req.params ?? {}) };
    this.enb = new RemoteConn('eNB', req.host, req.enbPort ?? 9001);
    this.mme = new RemoteConn('MME', req.host, req.mmePort ?? 9000);
    this.ue = { connected: false, contexts: 0, scells: [], scellList: [], imsi: req.imsi, registered: false };
    this.view = {
      id, scenarioId: scenario.id, scenarioName: scenario.name, host: req.host, systemName: req.systemName,
      imsi: req.imsi, phoneSerial: req.phoneSerial, state: 'preflight', startedAt: Date.now(),
      asserts: { total: 0, passed: 0, failed: 0, warned: 0 }, linkedTest: req.linkedTest,
      params, preflight: [], cells: [], steps: [], assertResults: [], metrics: [], teardown: [], events: [],
      scenario: { ...scenario, params }, notes: [],
    };
    this.finished = new Promise(r => { this.markFinished = r; });
  }

  /** Answer the operator step that is waiting. False when no such prompt is pending. */
  respondPrompt(promptId: string, response: PromptResponse): boolean {
    if (!this.promptWaiter || this.promptWaiter.id !== promptId) return false;
    this.promptWaiter.done(response);
    return true;
  }

  // ─── Logging / abort ──────────────────────────────────────────────────────
  private event(level: RunEvent['level'], msg: string, path?: string, data?: unknown) {
    this.view.events.push({ t: Date.now(), level, msg, path, data });
    if (this.view.events.length > MAX_EVENTS) {
      const n = this.view.events.length - MAX_EVENTS;
      this.view.events.splice(0, n);
      this.eventsDropped += n;
    }
  }

  stop(reason = 'Stopped by user') {
    if (this.abortReason) return;
    this.abortReason = reason;
    this.event('warn', `${reason} — tearing down`);
    for (const w of this.wakeups) w();
  }

  private checkAbort() { if (this.abortReason) throw new Aborted(this.abortReason); }

  private sleep(ms: number) {
    this.checkAbort();
    return new Promise<void>((resolve, reject) => {
      const done = () => { clearTimeout(t); this.wakeups.delete(done); this.abortReason ? reject(new Aborted(this.abortReason)) : resolve(); };
      const t = setTimeout(done, Math.max(0, ms));
      this.wakeups.add(done);
    });
  }

  // ─── Context ──────────────────────────────────────────────────────────────
  private cellsCtx() {
    return this.view.cells.map(c => ({ ...c, gain: this.gains.get(c.id) ?? c.gain }));
  }

  private ctx(): Record<string, unknown> {
    const cells = this.cellsCtx();
    return {
      ue: this.ue,
      mme: this.mmeUe ?? {},
      enb: { ue_count: this.enbUeCount },
      cells, cellCount: cells.length,
      cellById: Object.fromEntries(cells.map(c => [String(c.id), c])),
      params: this.view.params, vars: this.vars, reply: this.replies, marks: this.marks,
      phone: this.phoneCtx, loop: this.loopStack[this.loopStack.length - 1] ?? { i: 0, n: 0 }, now: Date.now(),
    };
  }

  private resolve<T>(v: T): T { return resolveDeep(v, this.ctx()); }

  async refreshUe(): Promise<UeSnap> {
    const [m, e] = await Promise.all([
      this.mme.send<any>({ message: 'ue_get', imsi: this.req.imsi }),
      this.enb.send<any>({ message: 'ue_get' }),
    ]);
    const mmeUe = (m.ue_list ?? []).find((u: any) => String(u.imsi) === this.req.imsi) ?? null;
    const list: any[] = e.ue_list ?? [];
    this.enbUeCount = list.length;
    // The core and the RAN name the UE differently per RAT: LTE uses
    // mme_ue_id/enb_ue_id, NR uses amf_ue_id/ran_ue_id. Try each pairing.
    const joinOn = (key: 'amf_ue_id' | 'mme_ue_id' | 'ran_ue_id' | 'enb_ue_id') =>
      typeof mmeUe?.[key] === 'number' ? list.filter(u => u[key] === mmeUe[key]) : [];
    let matches = joinOn('amf_ue_id');
    if (!matches.length) matches = joinOn('mme_ue_id');
    if (!matches.length) matches = joinOn('ran_ue_id');
    if (!matches.length) matches = joinOn('enb_ue_id');
    const cur = matches[matches.length - 1];
    const cellsOf = (u: any): number[] => (u?.cells ?? []).map((c: any) => c.cell_id).filter((x: unknown) => typeof x === 'number');
    const ids = cellsOf(cur);
    const pcell = ids[0];
    const pInfo = this.view.cells.find(c => c.id === pcell);
    const bearer = (mmeUe?.bearers ?? []).find((b: any) => b.ip && !/^(ims|sos)$/i.test(String(b.apn ?? ''))) ?? (mmeUe?.bearers ?? [])[0];
    const imeisv = typeof mmeUe?.imeisv === 'string' ? mmeUe.imeisv : undefined;
    this.mmeUe = mmeUe;
    this.ue = {
      connected: matches.length > 0, contexts: matches.length,
      enb_ue_id: cur?.enb_ue_id ?? cur?.ran_ue_id, ran_ue_id: cur?.ran_ue_id ?? cur?.enb_ue_id,
      mme_ue_id: cur?.mme_ue_id ?? cur?.amf_ue_id ?? mmeUe?.mme_ue_id ?? mmeUe?.amf_ue_id, rnti: cur?.rnti,
      pcell, scells: ids.slice(1), scellList: ids.slice(1).map(cell_id => ({ cell_id })),
      pci: pInfo?.pci, earfcn: pInfo?.earfcn,
      imsi: this.req.imsi, imei: imeisv && /^\d{14,16}$/.test(imeisv) ? imeisv.slice(0, 14) : undefined,
      ip: bearer?.ip, registered: !!mmeUe?.registered, m_tmsi: mmeUe?.m_tmsi ?? mmeUe?.['5g_tmsi'], tac: mmeUe?.tac,
    };
    return this.ue;
  }

  private async loadCells() {
    const cfg = await this.enb.send<any>({ message: 'config_get' });
    const cells = parseCells(cfg);
    this.view.cells = cells;
    for (const c of cells) this.originalGain.set(c.id, c.gain);
    return cfg;
  }

  // ─── Preflight ────────────────────────────────────────────────────────────
  async preflight(): Promise<boolean> {
    const checks = this.view.preflight;
    const add = (name: string, ok: boolean, level: PreflightCheck['level'], detail: string) => {
      checks.push({ name, ok, level: ok ? 'info' : level, detail });
      this.event(ok ? 'info' : level === 'error' ? 'error' : 'warn', `preflight ${name}: ${detail}`);
    };
    const req = this.scenario.requirements;

    try { await this.enb.connect(); add('eNB remote API', true, 'error', `${this.req.host}:${this.enb.port} ${this.enb.info.name ?? ''} ${this.enb.info.version ?? ''}`.trim()); }
    catch (e: any) { add('eNB remote API', false, 'error', e.message); return false; }
    try { await this.mme.connect(); add('MME remote API', true, 'error', `${this.req.host}:${this.mme.port} ${this.mme.info.name ?? ''} ${this.mme.info.version ?? ''}`.trim()); }
    catch (e: any) { add('MME remote API', false, 'error', e.message); return false; }
    this.view.callbox = { enb: { ...this.enb.info }, mme: { ...this.mme.info } };

    let cfg: any;
    try { cfg = await this.loadCells(); }
    catch (e: any) { add('eNB config_get', false, 'error', e.message); return false; }
    const cells = this.view.cells;
    add('Cells', cells.length >= req.minCells, 'error',
      `${cells.length} cell(s): ${cells.map(c => `${c.id}=${c.rat.toUpperCase()} PCI ${c.pci}/${c.rat === 'nr' ? `SSB ${c.ssb}` : `EARFCN ${c.earfcn}`}`).join(', ')}${cells.length < req.minCells ? ` — scenario needs ${req.minCells}` : ''}`);

    if (req.needsHoConfig) {
      const ho = cells.filter(c => c.hoFromMeas);
      const meas = cells.filter(c => c.hasMeasConfig);
      add('Measurement handover config', ho.length >= Math.min(2, cells.length), 'error',
        ho.length ? `ho_from_meas + meas_config_desc on cells ${ho.map(c => c.id).join(', ')}`
          : meas.length ? 'meas_config_desc is present but ho_from_meas is false in the running config — enable "Handover from measurements" in the LTE Config Builder and redeploy'
            : 'Running eNB config has no meas_config_desc / ho_from_meas (config_get shows no connected_mobility) — build the config with "Handover from measurements" on (it emits ncell_list, meas_config_desc, meas_gap_config, ho_from_meas) and deploy it');
      if (this.req.configText !== undefined) {
        const t = this.req.configText;
        const okText = /ho_from_meas\s*:\s*true/.test(t) && /meas_config_desc/.test(t);
        add('Config text', okText, 'warn', okText ? 'Selected config has meas_config_desc and ho_from_meas: true' : 'Selected config text lacks meas_config_desc or ho_from_meas: true');
      }
    }

    try {
      await this.refreshUe();
      if (!this.mmeUe) add('UE on MME', false, this.req.allowUnregistered ? 'warn' : 'error', `IMSI ${this.req.imsi} is not known to the MME — attach the phone first`);
      else {
        add('UE on MME', !!this.mmeUe.registered, 'warn', `IMSI ${this.req.imsi} ${this.mmeUe.registered ? 'registered' : 'NOT registered'}${this.ue.ip ? `, IP ${this.ue.ip}` : ''}`);
        add('UE on eNB', this.ue.connected, 'warn', this.ue.connected
          ? `enb_ue_id ${this.ue.enb_ue_id}, PCell ${this.ue.pcell}${this.ue.scells.length ? `, SCells ${this.ue.scells.join(',')}` : ''}`
          : 'UE is RRC idle — steps that need it connected will wait (send data from the phone)');
      }
    } catch (e: any) { add('UE lookup', false, 'error', e.message); }

    if (req.needsCa) {
      const p = cells.find(c => c.id === this.ue.pcell) ?? cells[0];
      add('Carrier aggregation', !!p && p.scells.length > 0, 'error',
        p?.scells.length ? `Cell ${p.id} scell_list: ${p.scells.join(', ')}` : 'The UE PCell has no scell_list in the running config');
    }

    if (this.req.phoneSerial) {
      const st = isSerial(this.req.phoneSerial) ? await phone.phoneState(this.req.phoneSerial) : null;
      this.phoneOk = st === 'device';
      add('Phone', this.phoneOk, 'error', this.phoneOk ? `${this.req.phoneSerial} connected over adb` : `${this.req.phoneSerial} is ${st ?? 'not connected'}`);
    } else {
      const hasPhoneSteps = JSON.stringify(this.scenario.steps).includes('"target":"phone"');
      if (hasPhoneSteps) this.view.notes.push('Phone steps were skipped: no phone selected.');
    }
    if (JSON.stringify(this.scenario.steps).includes('"type":"traffic"') && !this.req.creds?.username) {
      add('Traffic', false, 'warn', 'Scenario has traffic steps but the system has no SSH login — they will fail (or warn if optional)');
    }
    if (cfg?.logs === undefined && this.scenario.logs?.enb) add('Logs', false, 'warn', 'config_get returned no logs section; log levels cannot be restored');

    return !checks.some(c => !c.ok && c.level === 'error');
  }

  // ─── Execute ──────────────────────────────────────────────────────────────
  async execute() {
    const maxMs = this.scenario.maxDurationMs ?? DEFAULT_MAX_MS;
    const cap = setTimeout(() => this.stop(`Max duration ${Math.round(maxMs / 1000)} s reached`), maxMs);
    this.view.state = 'running';
    this.event('info', `Run ${this.view.id} started: ${this.scenario.name} on ${this.req.host}, IMSI ${this.req.imsi}`);
    await saveRun(this.view).catch(() => {});
    let failure: string | null = null;
    let inconclusive: string | null = null;
    try {
      await this.setupLogs();
      await this.runSteps(this.scenario.steps, '');
    } catch (e: any) {
      if (e instanceof Aborted) failure = null;
      else if (e instanceof Inconclusive) { inconclusive = e.message; this.event('warn', `INCONCLUSIVE: ${e.message}`, e.path); }
      else failure = e?.message ?? String(e);
      if (failure) this.event('error', failure, e instanceof StepFailed ? e.path : undefined);
    } finally {
      clearTimeout(cap);
      this.view.prompt = undefined;
      this.view.state = 'teardown';
      await this.teardown();
      const failedAsserts = this.view.assertResults.some(a => !a.passed && !a.optional);
      this.view.state = this.abortReason ? 'aborted' : failure ? 'failed' : inconclusive ? 'inconclusive' : failedAsserts ? 'failed' : 'passed';
      if (this.abortReason) this.view.error = this.abortReason;
      else if (failure) this.view.error = failure;
      else if (inconclusive) this.view.inconclusive = inconclusive;
      this.view.endedAt = Date.now();
      this.event('info', `Run ${this.view.state} in ${((this.view.endedAt - this.view.startedAt) / 1000).toFixed(1)} s`);
      await saveRun(this.view).catch(e => this.event('error', `Could not save run: ${e.message}`));
      locks.delete(lockKey(this.req.host, this.req.enbPort));
      this.markFinished();
    }
  }

  private async runSteps(steps: Step[], base: string) {
    for (let i = 0; i < steps.length; i++) {
      this.checkAbort();
      await this.execStep(steps[i], base ? `${base}/${i + 1}` : `${i + 1}`);
    }
  }

  private label(step: Step): string {
    if (step.label) return step.label;
    switch (step.type) {
      case 'action': return step.target === 'phone' ? `phone ${(step as PhoneActionStep).phone.op}` : `${step.target} ${String((step as RemoteActionStep).message?.message)}`;
      case 'wait': return `wait ${step.ms} ms`;
      case 'assert': return step.source === 'log' ? `log ~ /${step.log?.pattern}/`
        : step.source === 'sequence' ? `sequence ${(step.sequence?.items ?? []).map(i => i.label ?? i.msg).join(' → ')}`
          : `assert ${short(step.expect, 80)}`;
      case 'ramp': return `ramp ${step.cells.length} cell(s)`;
      case 'loop': return `loop ${step.count ?? 'until'}`;
      case 'traffic': return `traffic ${step.op}`;
      case 'operator': return `operator: ${step.prompt}`;
    }
  }

  private needsUe(v: unknown) {
    return hasPlaceholder(v) && /\$\{[^}]*\b(ue|mme|enb)\b/.test(JSON.stringify(v));
  }

  private async execStep(step: Step, path: string) {
    const rec: StepRecord = {
      path, type: step.type, label: '', status: 'running', startedAt: Date.now(),
      iteration: this.loopStack.length ? this.loopStack[this.loopStack.length - 1].i + 1 : undefined,
    };
    try { rec.label = String(this.resolve(this.label(step))); } catch { rec.label = this.label(step); }
    this.view.steps.push(rec);
    if (step.mark) this.marks[step.mark] = rec.startedAt;
    const finish = (status: StepStatus, detail?: string) => {
      rec.status = status; rec.endedAt = Date.now(); if (detail) rec.detail = detail;
      this.event(status === 'failed' ? 'error' : status === 'warned' ? 'warn' : 'info', `${rec.label}: ${status}${detail ? ` — ${detail}` : ''}`, path);
    };

    try {
      if (step.when) {
        if (JSON.stringify(step.when).match(/\b(ue|mme|enb)\./)) await this.refreshUe().catch(() => {});
        const r = evalCondition(step.when, this.ctx());
        if (!r.ok) { finish('skipped', `when: ${r.detail}`); return; }
      }
      let detail: string | undefined;
      let status: StepStatus = 'passed';
      switch (step.type) {
        case 'action':
          if (step.target === 'phone') {
            const r = await this.phoneAction(step as PhoneActionStep, path);
            if (r === null) { finish('skipped', 'no phone selected'); return; }
            detail = r;
          } else detail = await this.remoteAction(step as RemoteActionStep, path);
          break;
        case 'wait': {
          const ms = toNum(this.resolve((step as WaitStep).ms), 'wait ms');
          await this.sleep(ms);
          break;
        }
        case 'assert': {
          const r = await this.assertStep(step as AssertStep, path, rec);
          if (r === null) { finish('skipped', 'no phone selected'); return; }
          if (!r.ok) {
            if (step.optional) { finish('warned', r.detail); return; }
            if (step.onFail === 'inconclusive') {
              const why = `${step.inconclusiveReason ?? rec.label} — ${r.detail}`;
              finish('warned', `inconclusive: ${why}`);
              throw new Inconclusive(why, path);
            }
            finish('failed', r.detail);
            throw new StepFailed(`Assert failed: ${rec.label} — ${r.detail}`, path);
          }
          detail = r.detail;
          break;
        }
        case 'ramp': detail = await this.rampStep(step as RampStep, path); break;
        case 'loop': detail = await this.loopStep(step as LoopStep, path); break;
        case 'traffic': detail = await this.trafficStep(step as TrafficStep); break;
        case 'operator': detail = await this.operatorStep(step as OperatorStep, path); break;
      }
      finish(status, detail);
    } catch (e: any) {
      if (e instanceof Aborted) { if (rec.status === 'running') finish('skipped', 'aborted'); throw e; }
      if (e instanceof Inconclusive) {
        // An optional step (e.g. a clean-up operator prompt) only warns.
        if (step.optional && rec.status === 'running') { finish('warned', e.message); return; }
        if (rec.status === 'running') finish('warned', `inconclusive: ${e.message}`);
        throw e;
      }
      if (e instanceof StepFailed) {
        if (rec.status === 'running') finish('failed', e.message);
        if (step.onFail === 'inconclusive') throw new Inconclusive(`${step.inconclusiveReason ?? rec.label} — ${e.message}`, path);
        throw e;
      }
      const msg = e?.message ?? String(e);
      if (step.optional) { finish('warned', msg); return; }
      if (step.onFail === 'inconclusive') {
        const why = `${step.inconclusiveReason ?? rec.label} — ${msg}`;
        finish('warned', `inconclusive: ${why}`);
        throw new Inconclusive(why, path);
      }
      finish('failed', msg);
      throw new StepFailed(`${rec.label}: ${msg}`, path);
    }
  }

  // ─── Operator ─────────────────────────────────────────────────────────────
  /** Wait for the person at the bench. SimTool never touches the phone. */
  private async operatorStep(step: OperatorStep, path: string): Promise<string> {
    this.checkAbort();
    const timeoutMs = Math.max(1000, toNum(this.resolve(step.timeoutMs), 'operator timeoutMs'));
    const text = String(this.resolve(step.prompt));
    const id = crypto.randomBytes(4).toString('hex');
    const startedAt = Date.now();
    this.view.prompt = {
      id, path, text, detail: step.detail ? String(this.resolve(step.detail)) : undefined,
      continueLabel: step.continueLabel, startedAt, timeoutMs,
    };
    this.event('info', `Waiting for the operator: ${text}`, path);
    const answer = await new Promise<PromptResponse | 'timeout'>(resolve => {
      let settled = false;
      const done = (r: PromptResponse | 'timeout') => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.wakeups.delete(onStop);
        this.promptWaiter = null;
        resolve(r);
      };
      const onStop = () => done('abort');
      const timer = setTimeout(() => done('timeout'), timeoutMs);
      this.wakeups.add(onStop);
      this.promptWaiter = { id, done };
    });
    this.view.prompt = undefined;
    const waited = `${((Date.now() - startedAt) / 1000).toFixed(1)} s`;
    switch (answer) {
      case 'continue':
        this.event('info', `Operator continued after ${waited}`, path);
        return `operator continued after ${waited}`;
      case 'skip':
        throw new Inconclusive(`Operator skipped "${text}"`, path);
      case 'abort':
        if (!this.abortReason) this.stop('Aborted by the operator');
        throw new Aborted(this.abortReason ?? 'Aborted by the operator');
      case 'timeout':
      default:
        if (step.onTimeout === 'fail') throw new Error(`no operator response within ${Math.round(timeoutMs / 1000)} s`);
        throw new Inconclusive(`No operator response within ${Math.round(timeoutMs / 1000)} s to "${text}"`, path);
    }
  }

  private doCapture(capture: Record<string, string> | undefined, path: string) {
    if (!capture) return;
    const ctx = this.ctx();
    for (const [k, e] of Object.entries(capture)) {
      this.vars[k] = evaluate(e, ctx);
      this.event('debug', `vars.${k} = ${short(this.vars[k], 120)}`, path);
    }
  }

  // ─── Remote actions ───────────────────────────────────────────────────────
  private async remoteAction(step: RemoteActionStep, path: string): Promise<string> {
    const conn = step.target === 'mme' ? this.mme : this.enb;
    if (this.needsUe(step.message) || this.needsUe(step.undo) || (step.capture && JSON.stringify(step.capture).match(/\b(ue|mme)\b/))) {
      await this.refreshUe();
    }
    this.doCapture(step.capture, path);
    const msg = this.resolve(step.message) as Record<string, unknown>;
    const name = String(msg.message);
    if (BLOCKED[name] && !(this.req.allowNetworkDetach && isSafeDetach(msg))) {
      throw new Error(name === 'ue_detach' && isSafeDetach(msg) ? 'ue_detach needs the operator to confirm network detach for this run' : BLOCKED[name]);
    }
    delete msg.message_id;

    if (name === 'cell_gain') {
      const gain = toNum(msg.gain, 'cell_gain gain');
      if (gain < GAIN_MIN || gain > GAIN_MAX) throw new Error(`cell_gain ${gain} dB is outside [${GAIN_MIN}, ${GAIN_MAX}]`);
    }
    if (name === 'handover') this.normaliseHandover(msg, path);
    const timeout = step.timeoutMs ?? 5000;
    this.event('debug', `→ ${step.target} ${short(msg, 400)}`, path);

    let reply: any;
    let note = '';
    try {
      reply = await conn.send(msg, timeout);
    } catch (e: any) {
      const text = e?.message ?? String(e);
      if (name === 'handover' && step.ensureNeighbour && /not found in Neighbour Cell List/i.test(text)) {
        note = await this.addNeighbourFor(msg, path);
        try { reply = await conn.send(msg, timeout); }
        catch (e2: any) { return this.onActionError(step, e2, path); }
      } else {
        return this.onActionError(step, e, path);
      }
    }
    if (step.expectError) throw new Error(`expected an error matching /${step.expectError}/ but the ${name} succeeded`);
    this.event('debug', `← ${short(reply, 400)}`, path);
    this.trackSideEffects(step.target, msg);
    if (step.saveAs) this.replies[step.saveAs] = reply;
    if (step.resolvesUndo) {
      const before = this.undos.length;
      this.undos = this.undos.filter(u => u.key !== step.resolvesUndo);
      if (this.undos.length !== before) this.event('debug', `undo "${step.resolvesUndo}" resolved by this step`, path);
    }
    if (step.undo) {
      const undo = this.resolve(step.undo) as Record<string, unknown>;
      if (BLOCKED[String(undo.message)]) throw new Error(BLOCKED[String(undo.message)]);
      this.undos.push({ key: step.undoKey, target: step.target, message: undo, label: `${step.target} ${String(undo.message)} (undo of ${name})` });
    }
    const { message: _m, message_id: _i, time: _t, utc: _u, ...rest } = reply ?? {};
    return `${Object.keys(rest).length ? `ok ${short(rest, 160)}` : 'ok'}${note ? ` (${note})` : ''}`;
  }

  private onActionError(step: RemoteActionStep, e: any, path: string): string {
    const text = e?.message ?? String(e);
    if (step.expectError && new RegExp(step.expectError, 'i').test(text)) {
      if (step.saveAs) this.replies[step.saveAs] = { error: text };
      return `expected error: ${text}`;
    }
    if (e instanceof RemoteApiError) throw new Error(`${String(step.message.message)} rejected: ${text}`);
    throw e;
  }

  private trackSideEffects(target: 'enb' | 'mme', msg: Record<string, any>) {
    if (target !== 'enb') return;
    switch (msg.message) {
      case 'cell_gain': this.gains.set(Number(msg.cell_id), Number(msg.gain)); break;
      case 'sib_set':
        for (const [id, c] of Object.entries<any>(msg.cells ?? {})) if (c?.sib1 && 'cell_barred' in c.sib1) this.barredTouched.add(Number(id));
        break;
      case 'ncell_list_add': {
        const n = msg.ncell ?? {};
        const src = this.view.cells.find(c => c.id === Number(msg.cell_id));
        {
          const tgt = this.view.cells.find(c => c.id === Number(n.cell_id))
            ?? this.view.cells.find(c => c.pci === Number(n.n_id_cell));
          // ncell_list_del's dl_arfcn is "DL EARFCN or SSB NR-ARFCN"
          const arfcn = tgt?.rat === 'nr' ? tgt.ssb : (n.dl_earfcn ?? src?.earfcn);
          this.ncellsAdded.push({ cell_id: Number(msg.cell_id), n_id_cell: Number(n.n_id_cell ?? tgt?.pci), dl_arfcn: arfcn });
        }
        break;
      }
      case 'ncell_list_del':
        this.ncellsAdded = this.ncellsAdded.filter(a => !(a.cell_id === Number(msg.cell_id) && a.n_id_cell === Number(msg.n_id_cell)));
        break;
      case 'config_set':
        if (msg.logs) this.view.notes.push('A config_set logs step ran; only levels raised via scenario.logs are restored automatically.');
        // NR cells are barred with config_set cells.<id>.cell_barred (sib_set only bars LTE cells).
        for (const [id, c] of Object.entries<any>(msg.cells ?? {})) if (c && 'cell_barred' in c) this.barredTouchedNr.add(Number(id));
        break;
    }
  }

  /** An NR target is addressed by ssb_nr_arfcn; dl_earfcn is silently ignored by
   *  lteenb, which then searches the UE's current SSB and reports "not found in
   *  Neighbour Cell List". Seeds written for LTE pass dl_earfcn, so swap it. */
  private normaliseHandover(msg: Record<string, unknown>, path: string) {
    const target = this.view.cells.find(c => c.pci === Number(msg.pci));
    if (!target || target.rat !== 'nr' || target.ssb === undefined) return;
    if (msg.ssb_nr_arfcn === undefined) {
      msg.ssb_nr_arfcn = target.ssb;
      this.event('debug', `NR target: using ssb_nr_arfcn ${target.ssb} for cell ${target.id}`, path);
    }
    delete msg.dl_earfcn;
    delete msg.dl_nr_arfcn;
  }

  /** handover target missing from the PCell's ncell_list → ncell_list_add, deleted at teardown. */
  private async addNeighbourFor(ho: Record<string, unknown>, path: string): Promise<string> {
    await this.refreshUe();
    const src = this.view.cells.find(c => c.id === this.ue.pcell);
    if (!src) throw new Error('Cannot add neighbour: UE PCell unknown');
    const byPci = this.view.cells.filter(c => c.pci === Number(ho.pci));
    const target = ho.ssb_nr_arfcn !== undefined
      ? byPci.find(c => c.ssb === Number(ho.ssb_nr_arfcn))
      : byPci.find(c => c.earfcn === (ho.dl_earfcn !== undefined ? Number(ho.dl_earfcn) : src.earfcn));
    if (!target) throw new Error(`No cell with PCI ${ho.pci} matching the requested frequency in the running config`);
    // NR neighbours inside the same gNB are named by their internal cell_id
    // (docs: "The cell_id parameter can be used for cells internal to the gNB").
    const ncell: Record<string, unknown> = target.rat === 'nr'
      ? { rat: 'nr', cell_id: target.id }
      : { n_id_cell: target.pci, dl_earfcn: target.earfcn };
    if (target.rat !== 'nr') {
      if (typeof target.eci === 'number') ncell.cell_id = target.eci;
      if (typeof target.tac === 'number') ncell.tac = target.tac;
      if (target.plmn) ncell.plmn = target.plmn;
    }
    const add = { message: 'ncell_list_add', cell_id: src.id, ncell };
    this.event('info', `Cell ${target.id} (PCI ${target.pci}) is not a neighbour of cell ${src.id} — adding it`, path, add);
    await this.enb.send(add);
    this.ncellsAdded.push({ cell_id: src.id, n_id_cell: target.pci,
      dl_arfcn: target.rat === 'nr' ? target.ssb : target.earfcn });
    return `added cell ${target.id} to cell ${src.id} ncell_list for this run`;
  }

  // ─── Phone ────────────────────────────────────────────────────────────────
  private async phoneAction(step: PhoneActionStep, path: string): Promise<string | null> {
    const serial = this.req.phoneSerial;
    if (!serial || !this.phoneOk) return null;
    const p = step.phone;
    const metric = (name: string, value: number, unit: string) => this.metric(name, value, unit, path);
    switch (p.op) {
      // Flag first: an adb timeout can still have switched airplane mode on, and
      // teardown must then turn it off.
      case 'airplane_on': this.airplaneOn = true; await phone.airplane(serial, true); return 'airplane mode on';
      case 'airplane_off': await phone.airplane(serial, false); this.airplaneOn = false; return 'airplane mode off';
      case 'wake': await phone.wake(serial); return 'woken';
      case 'radio_info': await phone.radioInfo(serial); return 'RadioInfo opened';
      case 'cell_info': {
        const r = await phone.cellInfo(serial);
        this.phoneCtx = { ...(r.serving ?? {}), cells: r.cells };
        if (step.saveAs) this.replies[step.saveAs] = r;
        return r.serving ? `PCI ${r.serving.pci} EARFCN ${r.serving.earfcn} RSRP ${r.serving.rsrp}` : 'no registered LTE cell reported';
      }
      case 'ping': case 'ping_start': {
        if (!this.ue.ip) await this.refreshUe().catch(() => {});
        const host = p.host ? String(this.resolve(p.host)) : gatewayFor(this.ue.ip);
        if (!host || !isIPv4(host)) throw new Error('No ping host: set phone.host or make sure the UE has an IP on the MME');
        const interval = p.intervalMs ?? (p.op === 'ping' ? 1000 : 200);
        if (p.op === 'ping_start') {
          if (this.bgPing) await this.bgPing.stop();
          this.bgPing = new phone.BackgroundPing(serial, host, interval);
          this.bgPing.start();
          return `background ping ${host} every ${interval} ms`;
        }
        const s = await phone.ping(serial, host, p.count ?? 3, interval);
        if (step.saveAs) this.replies[step.saveAs] = s;
        metric('ping_loss_pct', s.lossPct, '%');
        return `${s.received}/${s.sent} replies from ${host}`;
      }
      case 'ping_stop': {
        if (!this.bgPing) return 'no background ping running';
        const s = await this.bgPing.stop();
        this.bgPing = null;
        if (step.saveAs) this.replies[step.saveAs] = s;
        metric('ping_loss_pct', s.lossPct, '%');
        metric('ping_lost', s.sent - s.received, 'pkts');
        metric('ping_max_gap_ms', s.maxGapMs, 'ms');
        return `${s.sent - s.received}/${s.sent} lost, longest gap ${s.maxGapMs} ms`;
      }
    }
    return 'unknown phone op';
  }

  private metric(name: string, value: number, unit: string, path: string) {
    const m: MetricRecord = { name, value: Math.round(value * 100) / 100, unit, path, at: Date.now() };
    this.view.metrics.push(m);
    this.event('info', `metric ${name} = ${m.value} ${unit}`, path);
  }

  // ─── Assert ───────────────────────────────────────────────────────────────
  private async assertStep(step: AssertStep, path: string, rec: StepRecord): Promise<{ ok: boolean; detail: string } | null> {
    const source = step.source ?? 'ue';
    if (source === 'phone' && (!this.req.phoneSerial || !this.phoneOk)) return null;
    const timeout = toNum(this.resolve(step.timeoutMs), 'timeoutMs');
    const hold = step.holdMs !== undefined ? toNum(this.resolve(step.holdMs), 'holdMs') : 0;
    const poll = step.pollMs ?? (source === 'phone' ? 1500 : source === 'sequence' ? 300 : 250);
    const start = Date.now();
    const deadline = start + timeout;
    let heldSince: number | null = null;
    let firstOk: number | null = null;
    let last = '';

    let evidence: string[] | undefined;
    let seqResult: { matched: boolean; evidence: string[]; missing: string[]; times: (number | null)[] } | null = null;
    let deadlineMs = deadline;
    if (source === 'sequence' && step.sequence?.withinMs !== undefined) {
      // Log entries reach SimTool up to ~1 s after they were written (log_get batching).
      deadlineMs = Math.max(deadline, start + toNum(this.resolve(step.sequence.withinMs), 'withinMs') + 2500);
    }
    const evalOnce = async (): Promise<boolean> => {
      if (source === 'log') return this.checkLog(step, rec, (d) => { last = d; });
      if (source === 'sequence') {
        seqResult = this.checkSequence(step, rec);
        last = seqResult.matched ? `sequence matched (${seqResult.evidence.length} entries)` : `missing ${seqResult.missing.join(', ')}`;
        evidence = seqResult.evidence;
        return seqResult.matched;
      }
      try {
        if (source === 'ue' || source === 'mme') await this.refreshUe();
        if (source === 'phone') {
          const r = await phone.cellInfo(this.req.phoneSerial!);
          this.phoneCtx = { ...(r.serving ?? {}), cells: r.cells };
        }
      } catch (e: any) { last = `refresh failed: ${e.message}`; return false; }
      const r = evalCondition(step.expect as Condition, this.ctx());
      last = r.detail;
      return r.ok;
    };

    for (;;) {
      this.checkAbort();
      const ok = await evalOnce();
      const now = Date.now();
      if (ok) {
        if (firstOk === null) firstOk = now;
        if (heldSince === null) heldSince = now;
        if (now - heldSince >= hold) break;
      } else {
        if (heldSince !== null && hold > 0) this.event('debug', `hold broken after ${now - heldSince} ms: ${last}`, path);
        heldSince = null; firstOk = null;
      }
      if (now >= deadlineMs) {
        const detail = heldSince !== null ? `held only ${now - heldSince} of ${hold} ms (${last})` : `timed out after ${now - start} ms: ${last}`;
        this.recordAssert(path, rec.label, false, !!step.optional || step.onFail === 'inconclusive', now - start, detail, evidence);
        if (step.saveAs) this.replies[step.saveAs] = seqResult ?? { matched: false };
        return { ok: false, detail };
      }
      await this.sleep(Math.min(poll, Math.max(10, deadlineMs - now)));
    }

    const passedAt = firstOk ?? Date.now();
    const elapsed = passedAt - start;
    const detail = `${last} after ${elapsed} ms${hold ? ` (held ${hold} ms)` : ''}`;
    this.recordAssert(path, rec.label, true, !!step.optional, elapsed, detail, evidence);
    if (step.saveAs) this.replies[step.saveAs] = seqResult ?? { matched: true };
    if (source === 'sequence' && seqResult) this.sequenceMetrics(step, rec, seqResult, path);
    this.doCapture(step.capture, path);
    if (step.metric) {
      const since = step.metric.since ? this.marks[step.metric.since] : start;
      if (since === undefined) this.event('warn', `metric ${step.metric.name}: mark "${step.metric.since}" was never set`, path);
      else this.metric(step.metric.name, passedAt - since, step.metric.unit ?? 'ms', path);
    }
    return { ok: true, detail };
  }

  private checkLog(step: AssertStep, rec: StepRecord, setDetail: (d: string) => void): boolean {
    const l = step.log!;
    const col = this.logs[l.target];
    if (!col) { setDetail(`no ${l.target} log collector`); return false; }
    const since = l.since ? this.marks[l.since] ?? rec.startedAt : rec.startedAt;
    const re = new RegExp(l.pattern, 'i');
    const hits = col.lines.filter(x => x.rx >= since && (!l.layer || x.layer.toLowerCase() === l.layer.toLowerCase()) && re.test(x.text));
    const need = l.minCount ?? 1;
    setDetail(hits.length ? `${hits.length} match(es), first: [${hits[0].layer}] ${short(hits[0].text.split('\n')[0], 140)}`
      : `no ${l.layer ? `${l.layer} ` : ''}log line matching /${l.pattern}/${col.error ? ` (collector: ${col.error})` : ''}`);
    return hits.length >= need;
  }

  // ─── Signalling sequences ─────────────────────────────────────────────────
  /** SimTool time → callbox log time for one daemon (0 offset until a reply carried utc). */
  private toCallbox(target: 'enb' | 'mme', ms: number) {
    const conn = target === 'enb' ? this.enb : this.mme;
    return ms + (conn.clockOffsetMs ?? 0);
  }

  private seqSince(step: AssertStep, rec: StepRecord) {
    const s = step.sequence!;
    return s.since ? this.marks[s.since] ?? rec.startedAt : rec.startedAt;
  }

  /**
   * Ordered match over the eNB and MME logs since the mark: each required
   * item must appear after the previous match; an optional item is taken only
   * if it sits before the next required one. Entries are ordered by their
   * callbox timestamps (both daemons log with the same clock).
   */
  private checkSequence(step: AssertStep, rec: StepRecord) {
    const seq = step.sequence!;
    const since = this.seqSince(step, rec);
    const targetOf = (i: LogSeqItem) => i.target ?? seq.target ?? 'enb';
    type L = { target: 'enb' | 'mme'; t: number; layer: string; dir?: string; text: string; first: string; n: number };
    const pool: L[] = [];
    const missingCollector: string[] = [];
    let n = 0;
    for (const target of new Set(seq.items.map(targetOf))) {
      const col = this.logs[target];
      if (!col) { missingCollector.push(`${target} log collector`); continue; }
      const from = this.toCallbox(target, since) - 20; // 20 ms slack for clock-offset jitter
      for (const l of col.lines) if (l.t >= from) pool.push({ target, t: l.t, layer: l.layer, dir: l.dir, text: l.text, first: l.text.split('\n')[0], n: n++ });
    }
    pool.sort((a, b) => a.t - b.t || a.n - b.n);
    const matches = (it: LogSeqItem, l: L) => targetOf(it) === l.target
      && (!it.layer || l.layer.toLowerCase() === it.layer.toLowerCase())
      && (!it.dir || String(l.dir ?? '').toUpperCase() === it.dir)
      && new RegExp(it.msg, 'i').test(l.first)
      && (!it.contains || new RegExp(it.contains, 'i').test(l.text));
    const findFrom = (it: LogSeqItem, pos: number) => { for (let k = pos; k < pool.length; k++) if (matches(it, pool[k])) return k; return -1; };

    const evidence: string[] = [];
    const missing: string[] = [...missingCollector];
    const times: (number | null)[] = [];
    let pos = 0;
    const sinceCb = (t: 'enb' | 'mme') => this.toCallbox(t, since);
    for (let i = 0; i < seq.items.length; i++) {
      const it = seq.items[i];
      let k = findFrom(it, pos);
      if (it.optional && k >= 0) {
        const nextReq = seq.items.slice(i + 1).find(x => !x.optional);
        const bound = nextReq ? findFrom(nextReq, pos) : -1;
        if (bound >= 0 && k > bound) k = -1;
      }
      if (k < 0) {
        times.push(null);
        if (!it.optional) missing.push(it.label ?? it.msg);
        continue;
      }
      const l = pool[k];
      times.push(l.t);
      const snippet = it.contains ? (l.text.split('\n').find(x => new RegExp(it.contains!, 'i').test(x)) ?? '').trim() : '';
      evidence.push(`+${Math.max(0, Math.round(l.t - sinceCb(l.target)))} ms [${l.target.toUpperCase()} ${l.layer}${l.dir ? ` ${l.dir}` : ''}] ${l.first}${snippet && snippet !== l.first ? ` · ${snippet.slice(0, 120)}` : ''}`);
      pos = k + 1;
    }
    let matched = missing.length === 0;
    if (matched && seq.withinMs !== undefined) {
      const within = toNum(this.resolve(seq.withinMs), 'withinMs');
      const lastIdx = seq.items.map((it, i) => (!it.optional && times[i] !== null ? i : -1)).filter(i => i >= 0).pop();
      if (lastIdx !== undefined) {
        const took = (times[lastIdx] as number) - sinceCb(targetOf(seq.items[lastIdx]));
        if (took > within) { matched = false; missing.push(`${seq.items[lastIdx].label ?? seq.items[lastIdx].msg} within ${within} ms (took ${Math.round(took)} ms)`); }
      }
    }
    return { matched, evidence, missing, times };
  }

  private sequenceMetrics(step: AssertStep, rec: StepRecord, r: { times: (number | null)[] }, path: string) {
    const seq = step.sequence!;
    for (const m of seq.metrics ?? []) {
      const to = r.times[m.to];
      const target = seq.items[m.to]?.target ?? seq.target ?? 'enb';
      const from = m.from < 0 ? this.toCallbox(target, this.seqSince(step, rec)) : r.times[m.from];
      if (typeof to !== 'number' || typeof from !== 'number') { this.event('warn', `metric ${m.name}: an entry it needs was not matched`, path); continue; }
      this.metric(m.name, to - from, m.unit ?? 'ms', path);
    }
  }

  private recordAssert(path: string, label: string, passed: boolean, optional: boolean, elapsedMs: number, detail: string, evidence?: string[]) {
    const a: AssertRecord = { path, label, passed, optional, elapsedMs, detail, at: Date.now(), ...(evidence?.length ? { evidence } : {}) };
    this.view.assertResults.push(a);
    this.view.asserts.total++;
    if (passed) this.view.asserts.passed++;
    else if (optional) this.view.asserts.warned++;
    else this.view.asserts.failed++;
  }

  // ─── Ramp ─────────────────────────────────────────────────────────────────
  private async setGain(cellId: number, gain: number, path: string) {
    const g = Math.max(GAIN_MIN, Math.min(GAIN_MAX, Math.round(gain * 10) / 10));
    // Record before sending: a reply timeout can still have applied the gain,
    // and teardown restoring an unchanged cell to its original gain is harmless.
    this.gains.set(cellId, g);
    await this.enb.send({ message: 'cell_gain', cell_id: cellId, gain: g });
    this.event('debug', `cell_gain ${cellId} → ${g} dB`, path);
  }

  private async rampStep(step: RampStep, path: string): Promise<string> {
    await this.refreshUe();
    this.doCapture(step.capture, path);
    const ctx = this.ctx();
    const cells = step.cells.map(c => {
      const r = resolveDeep(c, ctx);
      const id = toNum(r.cell, 'ramp cell');
      if (!this.view.cells.some(x => x.id === id)) throw new Error(`ramp: cell ${id} is not in the running config`);
      const clamp = (v: unknown, w: string) => Math.max(GAIN_MIN, Math.min(GAIN_MAX, toNum(v, w)));
      return { id, from: clamp(r.from, 'ramp from'), to: clamp(r.to, 'ramp to') };
    });
    const stepDb = Math.abs(toNum(this.resolve(step.stepDb), 'stepDb'));
    const dwell = Math.max(100, toNum(this.resolve(step.dwellMs), 'dwellMs'));
    if (stepDb === 0) throw new Error('stepDb must be > 0');

    const start = Date.now();
    const cur = new Map<number, number>();
    for (const c of cells) { await this.setGain(c.id, c.from, path); cur.set(c.id, c.from); }
    let ticks = 0;
    let stopped = false;
    let stopDetail = '';
    for (;;) {
      await this.sleep(dwell);
      if (step.stopWhen) {
        await this.refreshUe().catch(() => {});
        const r = evalCondition(step.stopWhen, this.ctx());
        stopDetail = r.detail;
        if (r.ok) { stopped = true; break; }
      }
      const done = cells.every(c => cur.get(c.id) === c.to);
      if (done) break;
      for (const c of cells) {
        const v = cur.get(c.id)!;
        if (v === c.to) continue;
        const next = c.to < v ? Math.max(c.to, v - stepDb) : Math.min(c.to, v + stepDb);
        await this.setGain(c.id, next, path);
        cur.set(c.id, next);
      }
      ticks++;
    }
    const gains = Object.fromEntries([...cur.entries()].map(([k, v]) => [String(k), v]));
    const elapsedMs = Date.now() - start;
    if (step.saveAs) this.replies[step.saveAs] = { stopped, ticks, elapsedMs, gains };
    if (step.metric) this.metric(step.metric.name, elapsedMs, 'ms', path);
    const gainText = cells.map(c => `${c.id}:${cur.get(c.id)} dB`).join(', ');
    if (stopped) return `stopWhen held after ${ticks} step(s), ${elapsedMs} ms at ${gainText} (${stopDetail})`;
    if (step.stopWhen && step.requireStop) throw new Error(`ramp ended at ${gainText} without ${stopDetail}`);
    return `ramp complete after ${ticks} step(s) at ${gainText}`;
  }

  // ─── Loop ─────────────────────────────────────────────────────────────────
  private async loopStep(step: LoopStep, path: string): Promise<string> {
    if (step.capture) { await this.refreshUe().catch(() => {}); this.doCapture(step.capture, path); }
    const count = step.count !== undefined ? Math.floor(toNum(this.resolve(step.count), 'loop count')) : undefined;
    const max = Math.min(step.maxIterations ?? (count ?? 100), 100000);
    const n = count !== undefined ? Math.min(count, max) : max;
    let i = 0;
    for (; i < n; i++) {
      this.checkAbort();
      this.loopStack.push({ i, n });
      try {
        this.event('debug', `iteration ${i + 1}/${count ?? '∞'}`, path);
        await this.runSteps(step.steps, `${path}#${i + 1}`);
        if (step.until) {
          if (JSON.stringify(step.until).match(/\b(ue|mme|enb)\./)) await this.refreshUe().catch(() => {});
          if (evalCondition(step.until, this.ctx()).ok) { i++; break; }
        }
      } finally { this.loopStack.pop(); }
    }
    if (step.until && count === undefined && i >= max) throw new Error(`until condition never held in ${max} iterations`);
    return `${i} iteration(s)`;
  }

  // ─── Traffic ──────────────────────────────────────────────────────────────
  private async trafficStep(step: TrafficStep): Promise<string> {
    if (step.op === 'stop') {
      const ids = step.ref ? [this.trafficJobs.get(step.ref)].filter(Boolean) as string[] : [...this.trafficJobs.values()];
      for (const id of ids) await stopJob(id).catch(() => {});
      if (step.ref) this.trafficJobs.delete(step.ref); else this.trafficJobs.clear();
      return `stopped ${ids.length} job(s)`;
    }
    const creds = this.req.creds;
    if (!creds?.username) throw new Error('traffic needs the system SSH login (none was provided)');
    await this.refreshUe();
    if (!this.ue.ip) throw new Error('UE has no IP on the MME');
    const generator = step.generator ?? 'callbox';
    const job = await startJob({
      creds: { ...creds, host: creds.host || this.req.host },
      direction: step.direction ?? 'dl', generator, protocol: step.protocol ?? 'udp',
      ueIp: this.ue.ip, serverIp: gatewayFor(this.ue.ip)!, phoneSerial: this.req.phoneSerial,
      bitrateMbps: toNum(this.resolve(step.bitrateMbps ?? 5), 'bitrateMbps'),
      durationSec: toNum(this.resolve(step.durationSec ?? 300), 'durationSec'),
    });
    this.trafficJobs.set(step.ref ?? job.id, job.id);
    return `job ${job.id}: ${job.label}`;
  }

  // ─── Logs ─────────────────────────────────────────────────────────────────
  private async setupLogs() {
    const assertLayers: Record<'enb' | 'mme', Set<string>> = { enb: new Set(), mme: new Set() };
    let wants: Record<'enb' | 'mme', boolean> = { enb: false, mme: false };
    const walk = (steps: Step[]) => steps.forEach(s => {
      if (s.type === 'assert' && s.source === 'log' && s.log) { wants[s.log.target] = true; if (s.log.layer) assertLayers[s.log.target].add(s.log.layer.toLowerCase()); }
      if (s.type === 'assert' && s.source === 'sequence' && s.sequence) {
        for (const it of s.sequence.items) {
          const t = it.target ?? s.sequence.target ?? 'enb';
          wants[t] = true;
          if (it.layer) assertLayers[t].add(it.layer.toLowerCase());
        }
      }
      if (s.type === 'loop') walk(s.steps);
    });
    walk(this.scenario.steps);

    for (const target of ['enb', 'mme'] as const) {
      const conn = target === 'enb' ? this.enb : this.mme;
      const levels = this.scenario.logs?.[target];
      if (levels && Object.keys(levels).length) {
        try {
          const cfg = await conn.send<any>({ message: 'config_get' });
          const layers = cfg.logs?.layers ?? {};
          const restore: Record<string, string> = {};
          const set: Record<string, { level: string }> = {};
          const known = Object.keys(layers).length > 0;
          for (const [layer, level] of Object.entries(levels)) {
            // A layer this daemon doesn't have would make config_set reject the whole request.
            if (known && !(layer in layers)) { this.event('debug', `${target} has no "${layer}" log layer — not raised`); continue; }
            const orig = layers[layer]?.level;
            if (orig !== undefined) restore[layer] = String(orig);
            if (orig !== level) set[layer] = { level: String(level) };
          }
          if (Object.keys(set).length) {
            const r = await conn.send<any>({ message: 'config_set', logs: { layers: set } });
            if (r?.logs === 'locked') this.event('warn', `${target} logs are locked; levels unchanged`);
            else { this.logRestore[target] = restore; this.event('info', `${target} log levels raised: ${short(set)}`); }
          }
        } catch (e: any) { this.event('warn', `${target} log level change failed: ${e.message}`); }
      }
      if (wants[target]) {
        const filter: Record<string, string> = {};
        for (const l of Object.keys(levels ?? {})) filter[l] = 'debug';
        for (const l of assertLayers[target]) filter[l] = 'debug';
        const col = new LogCollector(target === 'enb' ? 'eNB' : 'MME', this.req.host, conn.port, Object.keys(filter).length ? filter : undefined);
        try { await col.start(); this.logs[target] = col; this.event('info', `${target} log collector started${Object.keys(filter).length ? ` (${Object.keys(filter).join(', ')})` : ''}`); }
        catch (e: any) { this.event('warn', `${target} log collector failed: ${e.message}`); }
      }
    }
  }

  // ─── Teardown ─────────────────────────────────────────────────────────────
  private async teardown() {
    const rec = (what: string, ok: boolean, detail?: string) => {
      const t: TeardownRecord = { what, ok, detail, at: Date.now() };
      this.view.teardown.push(t);
      this.event(ok ? 'info' : 'error', `teardown ${what}: ${ok ? 'ok' : 'FAILED'}${detail ? ` — ${detail}` : ''}`);
    };
    const attempt = async (what: string, fn: () => Promise<unknown>) => {
      try { const d = await fn(); rec(what, true, typeof d === 'string' ? d : undefined); }
      catch (e: any) { rec(what, false, e?.message ?? String(e)); }
    };
    this.event('info', 'Teardown started');

    if (this.bgPing) { const p = this.bgPing; this.bgPing = null; await attempt('stop background ping', async () => { const s = await p.stop(); return `${s.sent - s.received}/${s.sent} lost`; }); }
    for (const [ref, id] of this.trafficJobs) await attempt(`stop traffic ${ref}`, () => stopJob(id));
    this.trafficJobs.clear();

    // Recorded undos, newest first. UE ids are refreshed: after a handover or
    // reconnect the id captured when the undo was recorded is stale.
    for (const u of [...this.undos].reverse()) {
      await attempt(u.label, async () => {
        const m = { ...u.message };
        if ('enb_ue_id' in m || 'ran_ue_id' in m) {
          await this.refreshUe().catch(() => {});
          if (!this.ue.connected) return 'skipped: UE not connected';
          if ('enb_ue_id' in m) m.enb_ue_id = this.ue.enb_ue_id;
          if ('ran_ue_id' in m) m.ran_ue_id = this.ue.ran_ue_id;
        }
        await (u.target === 'mme' ? this.mme : this.enb).send(m);
      });
    }
    this.undos = [];

    for (const [cell, gain] of this.gains) {
      const orig = this.originalGain.get(cell) ?? 0;
      if (gain !== orig) await attempt(`cell ${cell} gain → ${orig} dB`, () => this.enb.send({ message: 'cell_gain', cell_id: cell, gain: orig }));
    }
    if (this.barredTouched.size) {
      const cells: Record<string, unknown> = {};
      for (const id of this.barredTouched) {
        const orig = this.view.cells.find(c => c.id === id)?.barred;
        cells[String(id)] = { sib1: { cell_barred: typeof orig === 'boolean' || orig === 'auto' ? orig : false } };
      }
      await attempt(`clear barring on cell(s) ${[...this.barredTouched].join(', ')}`, () => this.enb.send({ message: 'sib_set', cells }));
    }
    if (this.barredTouchedNr.size) {
      const cells: Record<string, unknown> = {};
      for (const id of this.barredTouchedNr) {
        const orig = this.view.cells.find(c => c.id === id)?.barred;
        cells[String(id)] = { cell_barred: typeof orig === 'boolean' || orig === 'auto' ? orig : false };
      }
      await attempt(`clear NR barring on cell(s) ${[...this.barredTouchedNr].join(', ')}`, () => this.enb.send({ message: 'config_set', cells }));
    }
    for (const n of [...this.ncellsAdded].reverse()) {
      const m: Record<string, unknown> = { message: 'ncell_list_del', cell_id: n.cell_id, n_id_cell: n.n_id_cell };
      if (n.dl_arfcn !== undefined) m.dl_arfcn = n.dl_arfcn;
      await attempt(`remove neighbour PCI ${n.n_id_cell} from cell ${n.cell_id}`, () => this.enb.send(m));
    }
    if (this.airplaneOn && this.req.phoneSerial) await attempt('airplane mode off', () => phone.airplane(this.req.phoneSerial!, false));
    for (const target of ['enb', 'mme'] as const) {
      const restore = this.logRestore[target];
      if (!restore || !Object.keys(restore).length) continue;
      const layers = Object.fromEntries(Object.entries(restore).map(([l, level]) => [l, { level }]));
      await attempt(`${target} log levels restored`, () => (target === 'enb' ? this.enb : this.mme).send({ message: 'config_set', logs: { layers } }));
    }
    for (const c of Object.values(this.logs)) c?.stop();
    if (!this.view.teardown.length) this.event('info', 'Teardown: nothing to undo');
    this.enb.close();
    this.mme.close();
  }

  closeQuietly() { this.enb.close(); this.mme.close(); }
}

// ─── Public API ─────────────────────────────────────────────────────────────
async function buildRun(req: RunRequest): Promise<Run> {
  if (!isIPv4(req.host)) throw new Error('host must be an IPv4 address');
  if (typeof req.imsi !== 'string' || !/^\d{5,15}$/.test(req.imsi)) throw new Error('imsi must be 5–15 digits');
  if (req.phoneSerial && !isSerial(req.phoneSerial)) throw new Error('bad phone serial');
  for (const p of [req.enbPort, req.mmePort]) if (p !== undefined && !(Number.isInteger(p) && p > 0 && p < 65536)) throw new Error('bad port');
  const scenario = req.scenario ?? (req.scenarioId ? await getScenario(req.scenarioId) : null);
  if (!scenario) throw new Error(req.scenarioId ? `Mobility scenario "${req.scenarioId}" not found` : 'scenarioId or scenario is required');
  const errors = validateScenario(scenario).filter(i => i.level === 'error');
  if (errors.length) throw new Error(`Scenario is invalid: ${errors.map(e => `${e.path} ${e.msg}`).join('; ')}`);
  return new Run(req, scenario);
}

export async function preflightOnly(req: RunRequest) {
  const run = await buildRun(req);
  try {
    const ok = await run.preflight();
    return { ok, checks: run.view.preflight, cells: run.view.cells, notes: run.view.notes };
  } finally { run.closeQuietly(); }
}

export async function startRun(req: RunRequest): Promise<{ ok: boolean; run: RunView }> {
  const run = await buildRun(req);
  const key = lockKey(req.host, req.enbPort);
  const reserved = reservations.get(key);
  if (reserved && reserved.token !== req.reservation) throw new Error(`System ${req.host} is busy: ${reserved.label} — stop it first`);
  const holder = locks.get(key);
  if (holder) {
    const other = runs.get(holder);
    throw new Error(`System ${req.host} is busy with mobility run ${holder}${other ? ` (${other.view.scenarioName}, ${other.view.state})` : ''} — stop it first`);
  }
  locks.set(key, run.view.id);
  runs.set(run.view.id, run);
  let ok = false;
  try { ok = await run.preflight(); }
  catch (e: any) { run.view.preflight.push({ name: 'preflight', ok: false, level: 'error', detail: e?.message ?? String(e) }); }
  if (!ok) {
    run.view.state = 'error';
    run.view.error = run.view.preflight.filter(c => !c.ok && c.level === 'error').map(c => `${c.name}: ${c.detail}`).join('; ') || 'Preflight failed';
    run.view.endedAt = Date.now();
    run.closeQuietly();
    locks.delete(key);
    return { ok: false, run: run.view };
  }
  void run.execute();
  return { ok: true, run: run.view };
}

export function stopRun(id: string, reason?: string) {
  const run = runs.get(id);
  if (!run) throw new Error('No such mobility run in memory (it may have finished — see History)');
  run.stop(reason);
  return summarize(run.view);
}

export function listActiveRuns() {
  const cutoff = Date.now() - 60 * 60_000;
  for (const [id, r] of runs) if (r.view.endedAt && r.view.endedAt < cutoff) runs.delete(id);
  return [...runs.values()].map(r => summarize(r.view)).sort((a, b) => b.startedAt - a.startedAt);
}

export function getActiveRun(id: string, eventsFrom = 0): (RunView & { eventsFrom: number; eventsTotal: number }) | null {
  const r = runs.get(id);
  if (!r) return null;
  const v = r.view;
  const total = r.eventsDropped + v.events.length;
  const from = Math.max(r.eventsDropped, Math.min(eventsFrom, total));
  return { ...v, events: v.events.slice(from - r.eventsDropped), eventsFrom: from, eventsTotal: total };
}

/** Answer an operator prompt of a live run. */
export function respondToPrompt(id: string, promptId: string, response: PromptResponse) {
  const run = runs.get(id);
  if (!run) throw new Error('No such run in memory');
  if (!['continue', 'skip', 'abort'].includes(response)) throw new Error('response must be continue, skip or abort');
  if (!run.respondPrompt(promptId, response)) throw new Error('That prompt is no longer waiting');
  return summarize(run.view);
}

/** The live Run object (for orchestrators in this process). */
export const getRunObject = (id: string) => runs.get(id) ?? null;

export const isActive = (id: string) => {
  const r = runs.get(id);
  return !!r && !r.view.endedAt;
};

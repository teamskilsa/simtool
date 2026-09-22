// Mobility Scenarios ↔ Test Execution, at the data/API level.
//
// A Test Execution scenario (the deploy topology stored by the app-router
// /api/scenarios in data/users/admin/scenarios.json) may carry an optional
// `mobility` attachment. The existing POST/PUT handlers spread the body into
// the record, so the field persists without touching Test Execution; its UI
// simply ignores it today.
//
//   deploy scenario ── mobility: { scenarioId, imsi?, phoneSerial?, params? }
//          │
//          ▼ runDeployThenMobility()
//   executionService.executeScenario()  (existing deploy: SCP + restart)
//          │ all steps succeeded
//          ▼ waitForUe()  — preflight polls until the UE re-attaches
//   POST /api/scenarios/run { linkedTest, configText (deployed enb cfg) }
//          │
//          ▼ results: data/scenario-runs/<id>.json, GET /api/scenarios/runs?linkedTestId=
//
// Client-side (browser) helpers: they reuse Test Execution's own services
// read-only, exactly as its run hook does.
import type { System } from '@/modules/systems/types';
import { executionService } from '@/modules/testExecution/services';
import { configService } from '@/modules/testExecution/services/config/config.service';
import type { ExecutionStep } from '@/modules/testExecution/types/execution.types';
import type { PreflightCheck, RunView } from './types';

export interface MobilityAttachment {
  scenarioId: string;
  imsi?: string;
  phoneSerial?: string;
  params?: Record<string, unknown>;
}

/** The deploy scenario record, as the app-router /api/scenarios returns it (only what we use). */
export interface TestScenarioRecord {
  id: string;
  name: string;
  topology: string;
  system?: { id: string; name: string; host: string; port: string };
  moduleConfigs?: Array<{ moduleId: string; configId: string; enabled: boolean }>;
  mobility?: MobilityAttachment;
}

const json = async <T,>(r: Response): Promise<T> => r.json();

export async function listTestScenarios(): Promise<TestScenarioRecord[]> {
  const r = await fetch('/api/scenarios');
  if (!r.ok) return [];
  const list = await json<unknown>(r);
  return Array.isArray(list) ? (list as TestScenarioRecord[]) : [];
}

/** Attach (or detach with null) a mobility scenario to a Test Execution scenario. Additive: PUT merges fields. */
export async function attachMobility(testScenarioId: string, mobility: MobilityAttachment | null) {
  const r = await fetch('/api/scenarios', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: testScenarioId, mobility }),
  });
  if (!r.ok) throw new Error(`Could not update test scenario (${r.status})`);
}

/** eNB config text of a deploy scenario, for the runner's ho_from_meas check. */
export async function enbConfigTextFor(test: TestScenarioRecord): Promise<string | undefined> {
  const row = (test.moduleConfigs ?? []).find(c => c.moduleId === 'enb' && c.enabled !== false && c.configId);
  if (!row) return undefined;
  const all = await configService.getAllConfigs().catch(() => null);
  return all?.enb?.find(c => c.id === row.configId)?.content;
}

export const sshCredsOf = (s: System) => ({
  host: s.ip,
  port: s.sshPort ?? 22,
  username: s.username ?? '',
  ...(s.authMode === 'privateKey' && s.privateKey ? { privateKey: s.privateKey } : { password: s.password ?? '' }),
});

/** Poll the preflight until the IMSI is back on the MME (after a deploy restarts lte/ltemme). */
export async function waitForUe(body: Record<string, unknown>, timeoutMs = 120_000, signal?: { cancelled: boolean }): Promise<PreflightCheck[]> {
  const end = Date.now() + timeoutMs;
  let last: PreflightCheck[] = [];
  while (Date.now() < end && !signal?.cancelled) {
    const r = await fetch('/api/scenarios/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, action: 'preflight' }),
    }).then(x => x.json()).catch(() => null);
    last = r?.checks ?? [];
    if (last.some(c => c.name === 'UE on MME' && c.ok)) return last;
    await new Promise(res => setTimeout(res, 3000));
  }
  return last;
}

export interface DeployThenMobilityOptions {
  test: TestScenarioRecord;
  system: System;
  mobility: MobilityAttachment & { imsi: string };
  enbPort?: number;
  mmePort?: number;
  onDeploySteps?: (steps: ExecutionStep[]) => void;
  onStatus?: (msg: string) => void;
  signal?: { cancelled: boolean };
}

/** Test Execution's deploy, then the attached mobility scenario. Resolves with the started run (or throws). */
export async function runDeployThenMobility(o: DeployThenMobilityOptions): Promise<RunView> {
  o.onStatus?.(`Deploying "${o.test.name}"…`);
  const steps = await executionService.executeScenario(o.test.id, sshCredsOf(o.system), o.onDeploySteps);
  const failed = steps.find(s => s.status === 'failure');
  if (!steps.length) throw new Error('Deploy produced no steps — check the test scenario modules');
  if (failed) throw new Error(`Deploy failed at ${failed.name}: ${failed.error ?? 'unknown error'}`);

  const configText = await enbConfigTextFor(o.test);
  const body = {
    scenarioId: o.mobility.scenarioId,
    host: o.system.ip, enbPort: o.enbPort, mmePort: o.mmePort,
    imsi: o.mobility.imsi, phoneSerial: o.mobility.phoneSerial, params: o.mobility.params,
    systemId: String(o.system.id), systemName: o.system.name,
    creds: sshCredsOf(o.system),
    linkedTest: { id: o.test.id, name: o.test.name },
    configText,
  };
  o.onStatus?.('Deploy done — waiting for the UE to re-attach…');
  await waitForUe(body, 120_000, o.signal);
  if (o.signal?.cancelled) throw new Error('Cancelled');
  o.onStatus?.('Starting the mobility scenario…');
  const r = await fetch('/api/scenarios/run', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, action: 'start' }),
  }).then(x => x.json());
  if (!r.success) throw new Error(r.error ?? 'Mobility scenario did not start');
  return r.run as RunView;
}

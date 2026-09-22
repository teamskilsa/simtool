// Pre-conformance — the data model.
//
// PRE-CONFORMANCE, NOT CERTIFIED CONFORMANCE: these are procedure checks run
// against an Amarisoft callbox (not a GCF/PTCRB-validated test system), written
// by SimTool (not the official TTCN-3 test cases of TS 38.523 / 36.523). Every
// surface that shows a result must carry DISCLAIMER.
//
// A test case is catalogue metadata plus a builder that turns it into a
// Mobility Scenario (src/modules/scenarios) for the running config; the
// scenario runner executes it and its run record becomes the case's evidence.
// A plan is an ordered list of cases with parameters; a plan run produces a
// report (data/conformance/reports/<id>.json, exported as HTML / JSON / CSV).
import type { CellInfo, MobilityScenario, PendingPrompt, PreflightCheck } from '@/modules/scenarios/types';

export const DISCLAIMER = 'Pre-conformance — not a certified 3GPP conformance result.';
export const DISCLAIMER_LONG =
  'Pre-conformance — not a certified 3GPP conformance result. These checks run SimTool-authored procedures against an ' +
  'Amarisoft callbox, which is not a GCF/PTCRB-validated test system, and they are not the official TTCN-3 test cases of ' +
  'TS 38.523-1 / TS 36.523-1. A PASS means the observed signalling matched the procedure as SimTool checks it; it does not ' +
  'certify the device.';

export type Rat = 'nr' | 'lte';
export type CaseRat = Rat | 'both';
export type Category =
  | 'Registration & session' | 'Mobility' | 'RRC' | 'Carrier aggregation'
  | 'System information' | 'Paging & idle' | 'Robustness';
export const CATEGORIES: Category[] = ['Registration & session', 'RRC', 'Mobility', 'Carrier aggregation', 'System information', 'Paging & idle', 'Robustness'];
export type Automation = 'automatic' | 'operator-prompted';
export type Verdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'NOT_RUN';

/** A 3GPP reference. `basis` says what it is: the procedure the check follows
 *  (never a claim that SimTool runs that spec's test case). */
export interface SpecRef {
  spec: string;          // e.g. "TS 38.331"
  section?: string;      // only where the section number is certain
  title: string;         // e.g. "RRC reconfiguration — reconfiguration with sync"
  basis: 'procedure';
}

export interface CaseParam {
  key: string;
  label: string;
  default: number | boolean;
  help: string;
  min?: number;
  max?: number;
}

/** What a builder knows about the target when it builds the scenario. */
export interface CaseEnv {
  rat: Rat;
  cells: CellInfo[];
  /** The system has an SSH login, so the callbox can send downlink UDP. */
  hasSsh: boolean;
  params: Record<string, unknown>;
}

export interface Measurement {
  /** Metric name the scenario records. */
  metric: string;
  unit: string;
  /** Statistic compared with the threshold. */
  stat: 'max' | 'avg';
  /** Param key holding the PASS threshold (value ≤ threshold passes). */
  thresholdParam: string;
}

export interface TestCaseDef {
  id: string;
  title: string;
  rat: CaseRat;
  category: Category;
  automation: Automation;
  /** One or two sentences: what is checked. */
  summary: string;
  specs: Partial<Record<Rat, SpecRef[]>>;
  /** Honest notes on RAT support / limits of the check. */
  notes?: string[];
  preconditions: string[];
  procedure: string[];
  passCriteria: string[];
  inconclusiveWhen: string[];
  params: CaseParam[];
  measurement?: Measurement;
  /** Needs explicit operator confirmation before a plan may run it. */
  risky?: { confirm: string };
  /** Included by default when a plan is built from the catalogue. */
  defaultInPlans: boolean;
  /** Returns why the case cannot run on this config (→ INCONCLUSIVE, not run), or null. */
  precheck: (env: CaseEnv) => string | null;
  build: (env: CaseEnv) => MobilityScenario;
}

/** Catalogue entry as sent to the UI / API (no functions). */
export type TestCaseInfo = Omit<TestCaseDef, 'precheck' | 'build'>;

// ─── Plans ──────────────────────────────────────────────────────────────────
export interface PlanCase {
  caseId: string;
  /** Overrides of the case's params. */
  params?: Record<string, unknown>;
}

export interface TestPlan {
  id: string;
  name: string;
  description: string;
  /** Which RAT the plan is written for; 'auto' follows the UE / running config. */
  rat: Rat | 'auto';
  cases: PlanCase[];
  stopOnFail: boolean;
  /** Pause between cases so the UE settles. */
  interCaseMs?: number;
  /** Remembered target (filled in by the Run tab; optional). */
  target?: { systemId?: string; systemName?: string; host?: string; enbPort?: number; mmePort?: number; imsi?: string };
  builtin?: boolean;
  updatedAt?: string;
}

// ─── Plan runs / reports ────────────────────────────────────────────────────
export interface CaseResult {
  index: number;
  caseId: string;
  title: string;
  category: Category;
  automation: Automation;
  specs: SpecRef[];
  status: 'pending' | 'running' | 'done';
  verdict: Verdict;
  /** Plain-language reason for the verdict. */
  reason: string;
  runId?: string;
  startedAt?: number;
  endedAt?: number;
  params: Record<string, unknown>;
  /** Matched signalling and state checks, newest last. */
  evidence: string[];
  checks: { label: string; passed: boolean; optional: boolean; detail: string }[];
  metrics: { name: string; value: number; unit: string }[];
  measurement?: { metric: string; stat: 'max' | 'avg'; value: number; unit: string; threshold: number; pass: boolean; samples: number };
  teardown: { what: string; ok: boolean; detail?: string }[];
  /** Live: the step the case run is on. */
  currentStep?: string;
}

export type PlanRunState = 'preflight' | 'running' | 'finished' | 'aborted' | 'error';

export interface PlanPreflightCheck extends PreflightCheck { plain: string }

export interface PlanRunView {
  id: string;
  planId: string;
  planName: string;
  disclaimer: string;
  state: PlanRunState;
  host: string;
  enbPort: number;
  mmePort: number;
  systemName?: string;
  imsi: string;
  rat?: Rat;
  stopOnFail: boolean;
  startedAt: number;
  endedAt?: number;
  preflight: PlanPreflightCheck[];
  callbox: { enb?: { name?: string; version?: string }; mme?: { name?: string; version?: string } };
  cells: CellInfo[];
  cellSummary: string[];
  ue: { imsi: string; ip?: string; rat?: string; registered?: boolean; imeisv?: string };
  cases: CaseResult[];
  currentIndex: number;
  counts: Record<Verdict, number>;
  /** Operator step of the running case, waiting for an answer. */
  prompt?: PendingPrompt & { runId: string; caseId: string; caseTitle: string };
  confirmedRisky: string[];
  error?: string;
}

export interface PlanRunSummary {
  id: string;
  planId: string;
  planName: string;
  state: PlanRunState;
  host: string;
  systemName?: string;
  imsi: string;
  rat?: Rat;
  startedAt: number;
  endedAt?: number;
  counts: Record<Verdict, number>;
  total: number;
  softwareVersion?: string;
}

export interface PlanRunRequest {
  planId?: string;
  /** Run an unsaved plan (the Plans editor). */
  plan?: TestPlan;
  host: string;
  enbPort?: number;
  mmePort?: number;
  imsi: string;
  systemId?: string;
  systemName?: string;
  creds?: { host: string; port?: number; username?: string; password?: string; privateKey?: string };
  /** Case ids the operator explicitly confirmed (risky cases). */
  confirmRisky?: string[];
  stopOnFail?: boolean;
}

export const emptyCounts = (): Record<Verdict, number> => ({ PASS: 0, FAIL: 0, INCONCLUSIVE: 0, NOT_RUN: 0 });

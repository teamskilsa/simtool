// QA framework types — shared between the orchestrator (server) and
// the UI (client). The REST surface at /api/qa/* serialises these as
// JSON, so any shape change here requires touching both sides.
//
// See docs/QA_PLAN.md for the design doc.

export type Rat = 'lte' | 'nr' | 'nbiot' | 'catm' | 'nsa';
export type Duplex = 'fdd' | 'tdd';

export interface NsaSecondary {
  band: number;
  bandwidthMhz: number;
  scsKhz: 15 | 30 | 60 | 120;
}

/**
 * One row in the test catalog. Generated from a parameter matrix —
 * NOT hand-curated. The id is the canonical name we expose in the UI
 * and persist into Run records, so it must be stable across rebuilds.
 *
 * id format: <rat>-<band>-<bw>-<duplex>-<features>
 *   lte-b7-20mhz-fdd-mimo2
 *   lte-b41-20mhz-tdd-mimo4
 *   nr-n78-100mhz-tdd-sa-mimo2
 *   nbiot-b5-200khz-fdd-standalone
 *   nsa-b7-20mhz-fdd-anchor-n78-100mhz-tdd-secondary-mimo2
 */
export interface TestCase {
  id: string;
  rat: Rat;
  band: number;
  bandwidthMhz: number;
  duplex: Duplex;
  nAntennaDl: 1 | 2 | 4;
  nAntennaUl: 1 | 2 | 4;

  // RAT-specific extras. Only set when relevant; the runner ignores
  // fields that don't match the rat.
  tddConfig?: number;
  tddSpecial?: number;
  scsKhz?: 15 | 30 | 60 | 120;
  nbIotMode?: 'standalone' | 'inband' | 'guardband';
  catMCeMode?: 'A' | 'B';
  nsaSecondary?: NsaSecondary;

  // Test expectations.
  expectAttachWithinSec: number;
  expectDataPlane: boolean;

  // Human-readable summary for the UI grid.
  description: string;
}

export type CasePhase =
  | 'preflight'
  | 'generate'
  | 'validate'
  | 'deploy'
  | 'attach'
  | 'data-plane'
  | 'teardown';

export type CaseStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface CaseStep {
  name: string;
  ok: boolean;
  detail?: string;
  ms?: number;
  // Phase the step belongs to — drives the UI grouping.
  phase?: CasePhase;
}

export interface AttachSnapshot {
  imsi: string;
  rsrp: number;
  pci: number;
  earfcn: number;
  attachMs: number;
}

export interface DataPlaneResult {
  sent: number;
  received: number;
  rttMs?: number;
}

export interface CaseEvidence {
  // Filesystem paths — UI fetches via a separate evidence endpoint
  // rather than embedding the file contents here.
  generatedCfgs: { enb: string; ue: string };
  attachSnapshot?: AttachSnapshot;
  dataPlane?: DataPlaneResult;
}

export interface CaseResult {
  caseId: string;
  status: CaseStatus;
  failedPhase?: CasePhase;
  durationMs?: number;
  steps: CaseStep[];
  evidence?: CaseEvidence;
}

export type RunStatus =
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'mixed'
  | 'cancelled';

export interface RunOptions {
  stopOnFail: boolean;
  timeoutSec: number;
}

export interface Run {
  id: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  systems: {
    callbox: number;  // System.id of the callbox (eNB/MME/IMS host)
    uesim: number;    // System.id of the UE simulator host
  };
  options: RunOptions;
  cases: CaseResult[];
}

// Request body for POST /api/qa/runs.
export interface CreateRunRequest {
  caseIds: string[];
  systems: Run['systems'];
  options?: Partial<RunOptions>;
}

export interface CreateRunResponse {
  runId: string;
  queueLength: number;
}

// types/execution.types.ts
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failure';

/** Diagnostic detail entry returned by /api/systems/config-deploy. One per
 *  shell command issued during the deploy (connect / scp / mv / restart /
 *  port-check). UI surfaces these in a "Show details" panel so a failed
 *  deploy isn't a black box. */
export interface ExecutionLogEntry {
  step: string;
  cmd?: string;
  code?: number;
  stdout?: string;
  stderr?: string;
  ms?: number;
  ok: boolean;
}

export interface ExecutionStep {
  id: string;
  name: string;
  status: ExecutionStatus;
  error?: string;
  /** Which deploy phase failed, if any: 'request' | 'connect' | 'scp' |
   *  'mv' | 'restart' | 'port-check' | 'check-dir' | 'exception' */
  phase?: string;
  /** Last 500 chars of restart stdout+stderr — handy for service errors. */
  output?: string;
  /** Full chronological command log forwarded from the deploy API. */
  commandLog?: ExecutionLogEntry[];
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  description?: string;
}

export interface ExecutionState {
  scenarioId: string | null;
  status: ExecutionStatus;
  steps: ExecutionStep[];
  currentStep: string | null;
  error: string | null;
}
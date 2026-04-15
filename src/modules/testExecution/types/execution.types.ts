// types/execution.types.ts
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failure';

export interface ExecutionStep {
  id: string;
  name: string;
  status: ExecutionStatus;
  error?: string;
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
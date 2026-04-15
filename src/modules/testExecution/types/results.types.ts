export interface TestResult {
  id: string;
  executionId: string;
  scenarioId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime: Date;
  duration: number;
  components: ComponentResult[];
  metrics: ResultMetrics;
  logs: ResultLog[];
}

export interface ComponentResult {
  componentId: string;
  configId: string;
  status: ExecutionStatus;
  steps: ExecutionStep[];
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: string;
}

export interface ResultMetrics {
  cpu: number;
  memory: number;
  networkLatency: number;
  throughput: number;
  customMetrics: Record<string, number>;
}

export interface ResultLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  componentId?: string;
  stepId?: string;
}

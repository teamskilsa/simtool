// modules/systems/types/index.ts
export * from './connection';

export type SystemType = 'Callbox' | 'UESim' | 'MME' | 'SPGW';

export type ProvisionStatus = 'pending' | 'provisioning' | 'success' | 'failed';

export interface ProvisionStep {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface System {
  id: number;
  name: string;
  type: SystemType;
  ip: string;
  sshPort?: number;
  status: 'running' | 'warning' | 'stopped';
  username?: string;
  password?: string;
  authMode?: 'password' | 'privateKey';
  privateKey?: string;
  maxUEs?: number;
  maxConnections?: number;
  maxThroughput?: string;
  features?: string[];
  version?: string;
  cpu?: number;
  memory?: number;
  uptime?: string;
  lastUpdate?: number;
  lastError?: string;
  // Provisioning state — set during/after Add or Retry Provisioning.
  // When a system is added but reachability/SSH/deploy fails, it's still saved
  // with provisionStatus='failed' so the user can retry later.
  provisionStatus?: ProvisionStatus;
  provisionError?: string;
  provisionSteps?: ProvisionStep[];
  provisionedAt?: number;
  provisionFailedStep?: string; // e.g. 'ping', 'ssh-test', 'deploy'
}

export interface SystemFilters {
  search: string;
  type: string;
  status: string;
  sortBy?: string;
  monitoringConfig?: {
    pullDuration: number;
    refreshInterval: number;
    isActive?: boolean;
  };
}

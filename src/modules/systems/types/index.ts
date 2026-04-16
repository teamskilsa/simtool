// modules/systems/types/index.ts
export * from './connection';

export type SystemType = 'Callbox' | 'UESim' | 'MME' | 'SPGW';

export interface System {
  id: number;
  name: string;
  type: SystemType;
  ip: string;
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

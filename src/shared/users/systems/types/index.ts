// src/shared/users/systems/types/index.ts

export type ComponentType = 'ENB' | 'UE' | 'MME' | 'IMS' | 'MBMS';

export interface SystemAccess {
  protocol: 'ws' | 'ssh' | 'http' | 'https';
  ip: string;
  port: number;
  ssl?: boolean;
  password?: string;
}

export interface SystemSoftware {
  mainApplication: string;
  version: string;
  lastUpdated?: string;
}

export interface SystemConnection {
  id: string;
  name: string;
  type: ComponentType;
  description?: string;
  status?: 'active' | 'inactive' | 'error' | 'maintenance';
  remoteAPI: SystemAccess;
  software: SystemSoftware;
}

export interface SystemGroup {
  id: string;
  name: string;
  systems: SystemConnection[];
}

export interface SystemsConfig {
  groups: SystemGroup[];
  defaultGroup: SystemGroup;
}

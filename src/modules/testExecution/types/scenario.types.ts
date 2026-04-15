// types/scenario.types.ts
export type TopologyType = 'callbox' | 'ue-core' | 'core';
export type ModuleType = 'enb' | 'gnb' | 'mme' | 'ims' | 'ue_db' | 'ue' | 'core';
export type ScenarioStatus = 'ready' | 'running' | 'completed' | 'failed';

export interface IPConfig {
  [module: string]: string;
}

export interface Scenario {
  id: string;
  name: string;
  type: TopologyType;
  modules: ModuleType[];
  status: ScenarioStatus;
  lastRun?: string;
  ipConfig: IPConfig;
  createdAt: Date;
  modifiedAt: Date;
}

export interface TopologyConfig {
  id: TopologyType;
  name: string;
  description: string;
  modules: ModuleType[];
  optional?: ModuleType[];
}

export interface ModuleConfig {
  type: ModuleType;
  name: string;
  configId: string;
  ipAddress: string;
  systemId?: string;
  required: boolean;
}
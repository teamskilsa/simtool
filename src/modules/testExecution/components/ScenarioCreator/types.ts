// src/modules/testExecution/components/ScenarioCreator/types.ts

export interface ModuleConfig {
  moduleId: string;
  enabled: boolean;
  configId: string;
  ipAddress: string;
  isCustomIp: boolean;
  systemId?: string;
  isCollapsed?: boolean;
}

/** The system a scenario targets, as stored in scenarios.json. */
export interface ScenarioSystem {
  id: string;
  name: string;
  host: string;
  port: string;
}

export interface ScenarioConfig {
  /** Set once the scenario has been saved; absent while creating. */
  id?: string;
  name: string;
  topology: string;
  system: ScenarioSystem;
  useCommonIp: boolean;
  ipConfig: {
    common?: string;
    [key: string]: string | undefined;
  };
  moduleConfigs: ModuleConfig[];
}

export interface SystemOption {
  id: string;
  name: string;
  host: string;
}

export interface ScenarioFormState {
  name: string;
  topology: string;
  system?: ScenarioSystem;
  useCommonIp: boolean;
  ipConfig: {
    common?: string;
    [key: string]: string | undefined;
  };
  moduleConfigs: Record<string, ModuleConfig>;
}
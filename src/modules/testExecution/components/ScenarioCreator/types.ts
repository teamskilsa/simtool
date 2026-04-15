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

export interface ScenarioConfig {
  name: string;
  topology: string;
  system: SystemConfig;
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
  system?: SystemConfig;
  useCommonIp: boolean;
  ipConfig: {
    common?: string;
    [key: string]: string | undefined;
  };
  moduleConfigs: Record<string, ModuleConfig>;
}
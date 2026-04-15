export const COMPONENT_PORTS = {
  ENB: 9001,
  MME: 9000,
  IMS: 9003,
  UE: 9002
} as const;

export const PROMETHEUS_PORT = 9090;
export const GRAFANA_PORT = 5000;

export type ComponentType = keyof typeof COMPONENT_PORTS;

export const DEFAULT_IP = '127.0.0.1';
export const DEFAULT_POLLING_INTERVAL = 5000; // 5 seconds
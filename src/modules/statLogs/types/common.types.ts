import { ComponentType } from '../constants/ports';

export interface WebSocketMessage {
  message: string;
  message_id?: string;
  [key: string]: any;
}

export interface WebSocketResponse {
  message: string;
  message_id?: string;
  error?: string;
  [key: string]: any;
}

export interface MonitoringConfig {
  ip: string;
  port: number;
  interval: number;
  componentType: ComponentType;
  autoConnect?: boolean;
}

export interface StatsMonitorState {
  isConnected: boolean;
  isMonitoring: boolean;
  lastUpdate?: Date;
  error?: string;
}

export interface MetricsConfig {
  retention: number;  // How long to keep metrics in memory
  aggregation: 'avg' | 'max' | 'min';
  sampleInterval: number;
}

export interface ConnectionStatus {
  connected: boolean;
  lastPing?: Date;
  error?: string;
}
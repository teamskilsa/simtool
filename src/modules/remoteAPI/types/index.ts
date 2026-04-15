export interface RemoteAPIConfig {
  server: string;
  port: number;
  ssl?: boolean;
  password?: string;
  timeout?: number;
}

export interface RemoteAPIMessage {
  message: string;
  message_id?: string | number;
  [key: string]: any;
}

export interface WebSocketResponse {
  message: string;
  message_id?: string | number;
  error?: string;
  [key: string]: any;
}

export type ComponentType = 'ENB' | 'UE' | 'MME' | 'IMS' | 'MBMS';

export interface SystemConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: ComponentType;
}

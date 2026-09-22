import type { ComponentType as CatalogueComponentType } from '../../../shared/default/templates/remoteapi/common/types';

export interface RemoteAPIConfig {
  server: string;
  port: number;
  ssl?: boolean;
  password?: string;
  /** Default per-message timeout in seconds (long-poll messages get more). */
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
  /** Present on intermediate frames (trx_iq_dump start, ext_app progress). */
  notification?: string;
  time?: number;
  utc?: number;
  [key: string]: any;
}

/** Remote API server kinds: ENB (eNB/gNB), MME (MME/AMF), IMS, UE, MBMS (MBMSGW), LICENSE. */
export type ComponentType = CatalogueComponentType;

export interface SystemConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: ComponentType;
}

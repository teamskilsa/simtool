// modules/systems/types/connection.ts
export interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError?: string;
  pingOk?: boolean;
  sshOk?: boolean;
}

export interface ConnectionUpdateEvent {
  pingOk: boolean;
  sshOk: boolean;
  lastError?: string;
}

export interface SSHConnectionConfig {
  host: string;
  username: string;
  password: string;
  port?: number;
}

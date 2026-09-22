// src/modules/remoteAPI/utils/remote-api-storage.ts
//
// localStorage persistence for the Remote API console. Every read is guarded:
// storage can be unavailable (private mode, SSR) or hold corrupt JSON from an
// older build, and the console must still render.
import type { ComponentType } from '../types';

export interface ConnectionDetails {
  ip: string;
  type: ComponentType;
  port: string;
  name?: string;
  timestamp?: string;
}

export type LogStatus = 'success' | 'error' | 'notification' | 'event';

export interface LogEntry {
  command: string;
  response: any;
  timestamp: string;
  status: LogStatus;
  /** Round trip in ms for request/response entries. */
  durationMs?: number;
  /** Server that answered, e.g. "ENB lteenb 2026-06-12". */
  server?: string;
  connectionDetails?: ConnectionDetails;
}

const MAX_STORED_RESPONSE_CHARS = 20000;

function readJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled: keep going in memory */
  }
}

export const STORAGE_KEYS = {
  CONNECTIONS: 'remote_api_connections',
  RECENT_CONNECTION: 'remote_api_recent_connection',
  COMMAND_HISTORY: 'remote_api_command_history',
  RESPONSE_LOGS: 'remote_api_response_logs',
} as const;

export const remoteAPIStorage = {
  // Connection Management
  saveConnection(connection: ConnectionDetails): void {
    const connections = this.getSavedConnections();
    const exists = connections.find(
      c => c.ip === connection.ip && c.port === connection.port
    );
    
    if (!exists) {
      connections.push({
        ...connection,
        timestamp: new Date().toISOString()
      });
      writeJSON(STORAGE_KEYS.CONNECTIONS, connections);
    }
    
    // Update recent connection
    writeJSON(STORAGE_KEYS.RECENT_CONNECTION, connection);
  },

  getSavedConnections(): ConnectionDetails[] {
    const v = readJSON<ConnectionDetails[]>(STORAGE_KEYS.CONNECTIONS, []);
    return Array.isArray(v) ? v : [];
  },

  getRecentConnection(): ConnectionDetails | null {
    const v = readJSON<ConnectionDetails | null>(STORAGE_KEYS.RECENT_CONNECTION, null);
    return v && typeof v === 'object' && typeof v.ip === 'string' ? v : null;
  },

  deleteConnection(connection: ConnectionDetails): void {
    const connections = this.getSavedConnections();
    const updated = connections.filter(
      c => !(c.ip === connection.ip && c.port === connection.port)
    );
    writeJSON(STORAGE_KEYS.CONNECTIONS, updated);
  },

  // Command History Management
  saveCommand(command: string): void {
    const history = this.getCommandHistory();
    const updated = [command, ...history.filter(cmd => cmd !== command)].slice(0, 20); // Keep last 20
    writeJSON(STORAGE_KEYS.COMMAND_HISTORY, updated);
  },

  getCommandHistory(): string[] {
    const v = readJSON<string[]>(STORAGE_KEYS.COMMAND_HISTORY, []);
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  },

  // Response Log Management
  saveLog(log: LogEntry): void {
    const logs = this.getResponseLogs();
    // config_get / log_get / ue_get responses can be megabytes; persisting
    // them whole blew the localStorage quota and silently lost the history.
    let stored = log;
    try {
      const size = JSON.stringify(log.response ?? null).length;
      if (size > MAX_STORED_RESPONSE_CHARS) {
        stored = { ...log, response: { truncated: true, chars: size, preview: JSON.stringify(log.response).slice(0, 2000) } };
      }
    } catch { /* unserialisable: store as-is */ }
    const updated = [stored, ...logs].slice(0, 100); // Keep last 100 logs
    writeJSON(STORAGE_KEYS.RESPONSE_LOGS, updated);
  },

  getResponseLogs(): LogEntry[] {
    const v = readJSON<LogEntry[]>(STORAGE_KEYS.RESPONSE_LOGS, []);
    return Array.isArray(v) ? v : [];
  },

  clearResponseLogs(): void {
    writeJSON(STORAGE_KEYS.RESPONSE_LOGS, []);
  },

  // Utility methods
  clearAll(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => window.localStorage.removeItem(key));
    } catch { /* storage unavailable */ }
  },

  exportData(): string {
    const data = {
      connections: this.getSavedConnections(),
      commandHistory: this.getCommandHistory(),
      responseLogs: this.getResponseLogs(),
      timestamp: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  },

  importData(jsonString: string): void {
    try {
      const data = JSON.parse(jsonString);
      if (data.connections) {
        writeJSON(STORAGE_KEYS.CONNECTIONS, data.connections);
      }
      if (data.commandHistory) {
        writeJSON(STORAGE_KEYS.COMMAND_HISTORY, data.commandHistory);
      }
      if (data.responseLogs) {
        writeJSON(STORAGE_KEYS.RESPONSE_LOGS, data.responseLogs);
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Invalid import data format');
    }
  }
};

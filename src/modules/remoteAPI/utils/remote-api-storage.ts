// src/modules/remoteAPI/utils/remote-api-storage.ts

export interface ConnectionDetails {
  ip: string;
  type: 'ENB' | 'UE' | 'MME' | 'IMS' | 'MBMS';
  port: string;
  name?: string;
  timestamp?: string;
}

export interface LogEntry {
  command: string;
  response: any;
  timestamp: string;
  status: 'success' | 'error';
  connectionDetails?: ConnectionDetails;
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
      localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(connections));
    }
    
    // Update recent connection
    localStorage.setItem(STORAGE_KEYS.RECENT_CONNECTION, JSON.stringify(connection));
  },

  getSavedConnections(): ConnectionDetails[] {
    const saved = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
    return saved ? JSON.parse(saved) : [];
  },

  getRecentConnection(): ConnectionDetails | null {
    const recent = localStorage.getItem(STORAGE_KEYS.RECENT_CONNECTION);
    return recent ? JSON.parse(recent) : null;
  },

  deleteConnection(connection: ConnectionDetails): void {
    const connections = this.getSavedConnections();
    const updated = connections.filter(
      c => !(c.ip === connection.ip && c.port === connection.port)
    );
    localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(updated));
  },

  // Command History Management
  saveCommand(command: string): void {
    const history = this.getCommandHistory();
    const updated = [command, ...history.filter(cmd => cmd !== command)].slice(0, 20); // Keep last 20
    localStorage.setItem(STORAGE_KEYS.COMMAND_HISTORY, JSON.stringify(updated));
  },

  getCommandHistory(): string[] {
    const history = localStorage.getItem(STORAGE_KEYS.COMMAND_HISTORY);
    return history ? JSON.parse(history) : [];
  },

  // Response Log Management
  saveLog(log: LogEntry): void {
    const logs = this.getResponseLogs();
    const updated = [log, ...logs].slice(0, 100); // Keep last 100 logs
    localStorage.setItem(STORAGE_KEYS.RESPONSE_LOGS, JSON.stringify(updated));
  },

  getResponseLogs(): LogEntry[] {
    const logs = localStorage.getItem(STORAGE_KEYS.RESPONSE_LOGS);
    return logs ? JSON.parse(logs) : [];
  },

  clearResponseLogs(): void {
    localStorage.setItem(STORAGE_KEYS.RESPONSE_LOGS, JSON.stringify([]));
  },

  // Utility methods
  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
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
        localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(data.connections));
      }
      if (data.commandHistory) {
        localStorage.setItem(STORAGE_KEYS.COMMAND_HISTORY, JSON.stringify(data.commandHistory));
      }
      if (data.responseLogs) {
        localStorage.setItem(STORAGE_KEYS.RESPONSE_LOGS, JSON.stringify(data.responseLogs));
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Invalid import data format');
    }
  }
};

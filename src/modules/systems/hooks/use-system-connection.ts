// modules/systems/hooks/use-system-connection.ts
import { useState } from 'react';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../types';

interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError?: string;
  pingOk?: boolean;
  sshOk?: boolean;
}

export function useSystemConnection() {
  const [connections, setConnections] = useState<Map<number, ConnectionStatus>>(new Map());

  const testSystemReachability = async (ip: string): Promise<boolean> => {
    console.log('Testing reachability for:', ip);
    try {
      const response = await fetch(`http://${ip}:9050/api/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const testSSHConnection = async (system: System): Promise<boolean> => {
    console.log('Testing SSH connection for:', system.ip);
    try {
      const response = await fetch(`http://${system.ip}:9050/api/ssh/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: system.username,
          password: system.password,
          host: system.ip
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'SSH connection failed');
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('SSH connection failed:', error);
      return false;
    }
  };

  const executeCommand = async (system: System, command: string): Promise<string> => {
    console.log('Executing command on:', system.ip, 'Command:', command);
    try {
      const response = await fetch(`http://${system.ip}:9050/api/ssh/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command,
          username: system.username,
          password: system.password,
          host: system.ip
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Command execution failed');
      }

      const result = await response.json();
      return result.output || '';
    } catch (error) {
      console.error('Command execution failed:', error);
      throw error;
    }
  };

  const updateConnectionStatus = (
    systemId: number, 
    status: Partial<ConnectionStatus>
  ) => {
    setConnections(prev => {
      const newMap = new Map(prev);
      const currentStatus = prev.get(systemId) || {
        status: 'disconnected'
      };
      newMap.set(systemId, { ...currentStatus, ...status });
      return newMap;
    });
  };

  return {
    connections,
    testSystemReachability,
    testSSHConnection,
    executeCommand,
    updateConnectionStatus
  };
}
// modules/systems/hooks/use-system-connection.ts
import { useState } from 'react';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../types';

/** Build SSH credential payload consistent with /api/systems/ssh-test & ssh-execute */
function sshCredentials(system: System) {
  return {
    host: system.ip,
    port: system.sshPort ?? 22,
    username: system.username,
    ...(system.authMode === 'privateKey' && system.privateKey
      ? { privateKey: system.privateKey }
      : { password: system.password || '' }),
  };
}

interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError?: string;
  pingOk?: boolean;
  sshOk?: boolean;
}

export function useSystemConnection() {
  const [connections, setConnections] = useState<Map<number, ConnectionStatus>>(new Map());

  const testSystemReachability = async (ip: string, sshPort = 22): Promise<boolean> => {
    console.log('Testing reachability for:', ip);
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 5000);
      // TCP probe on SSH port — no agent required on the target machine
      const response = await fetch('/api/systems/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: ip, port: sshPort, timeoutMs: 4000 }),
        signal: ac.signal,
      });
      clearTimeout(timer);
      const result = await response.json();
      return result.reachable || result.icmpAlive || false;
    } catch {
      return false;
    }
  };

  const testSSHConnection = async (system: System): Promise<boolean> => {
    console.log('Testing SSH connection for:', system.ip);
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10000);
      // Use the Next.js server-side route — the agent does not expose an ssh/test endpoint
      const response = await fetch('/api/systems/ssh-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sshCredentials(system)),
        signal: ac.signal,
      });
      clearTimeout(timer);

      if (!response.ok) return false;
      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('SSH connection failed:', error);
      return false;
    }
  };

  const executeCommand = async (system: System, command: string): Promise<string> => {
    console.log('Executing command on:', system.ip, 'Command:', command);
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 30000);
      // Use the Next.js server-side route — the agent does not expose an ssh/execute endpoint
      const response = await fetch('/api/systems/ssh-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sshCredentials(system), command }),
        signal: ac.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Command execution failed');
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Command execution failed');
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
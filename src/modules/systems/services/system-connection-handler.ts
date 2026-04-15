// modules/systems/services/system-connection-handler.ts
import { SSHConnectionService } from './ssh-connection';
import type { System } from '../types';

interface ConnectionCheckResult {
  success: boolean;
  details: {
    canPing: boolean;
    sshAvailable: boolean;
    systemInfo?: {
      hostname?: string;
      platform?: string;
      cpuLoad?: number;
      memoryUsage?: number;
      uptime?: number;
    };
  };
  error?: string;
}

export class SystemConnectionHandler {
  static async performConnectionChecks(system: System): Promise<ConnectionCheckResult> {
    try {
      // Step 1: Check if system is pingable
      const pingResult = await this.checkPing(system.ip);
      if (!pingResult.success) {
        return {
          success: false,
          details: {
            canPing: false,
            sshAvailable: false,
          },
          error: 'System is not reachable'
        };
      }

      // Step 2: Check SSH connection
      const sshResponse = await fetch(`http://${system.ip}:9050/api/ssh/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: system.ip,
          username: system.username,
          password: system.password
        })
      });

      const sshResult = await sshResponse.json();
      
      if (!sshResponse.ok || !sshResult.success) {
        return {
          success: false,
          details: {
            canPing: true,
            sshAvailable: false,
          },
          error: sshResult.error || 'SSH connection failed'
        };
      }

      // Step 3: Fetch system information
      const systemInfo = await this.getSystemInformation(system);

      return {
        success: true,
        details: {
          canPing: true,
          sshAvailable: true,
          systemInfo
        }
      };
    } catch (error) {
      return {
        success: false,
        details: {
          canPing: false,
          sshAvailable: false,
        },
        error: error instanceof Error ? error.message : 'Connection check failed'
      };
    }
  }

  private static async checkPing(ip: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`http://${ip}:9050/api/health`);
      return { success: response.ok };
    } catch {
      return { success: false };
    }
  }

  private static async getSystemInformation(system: System) {
    try {
      // Use SSH execute to get system information
      const response = await fetch(`http://${system.ip}:9050/api/ssh/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: system.ip,
          username: system.username,
          password: system.password,
          command: 'uname -a && uptime'
        })
      });

      if (!response.ok) throw new Error('Failed to fetch system info');
      return await response.json();
    } catch {
      return undefined;
    }
  }
}
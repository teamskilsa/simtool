// modules/systems/services/ssh-connection.ts
import type { System } from '../types';
import { agentUrl } from '@/lib/constants';

interface ConnectionCheckResult {
  success: boolean;
  details?: {
    canPing: boolean;
    sshAvailable: boolean;
    credentialsProvided: boolean;
  };
  error?: string;
}

export class SSHConnectionService {
  static async checkConnection(system: System): Promise<ConnectionCheckResult> {
    try {
      console.log('Initiating connection check for:', {
        ip: system.ip,
        username: system.username,
        hasPassword: !!system.password
      });

      const response = await fetch(agentUrl(system.ip, '/api/ssh/test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: system.ip,
          username: system.username,
          password: system.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: result.success,
        details: {
          canPing: true,
          sshAvailable: result.success,
          credentialsProvided: true
        }
      };

    } catch (error) {
      console.error('Connection check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection check failed',
        details: {
          canPing: false,
          sshAvailable: false,
          credentialsProvided: !!system.username && !!system.password
        }
      };
    }
  }
}
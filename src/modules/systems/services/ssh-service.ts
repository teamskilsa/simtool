// modules/systems/services/ssh-service.ts
import type { System } from '../types';
import { agentUrl } from '@/lib/constants';

export class SSHService {
  private system: System | null = null;

  async connect(system: System): Promise<boolean> {
    try {
      this.system = system;
      
      const requestBody = {
        username: system.username,
        password: system.password,
        host: system.ip
      };

      console.log('Connecting to system:', {
        url: agentUrl(system.ip, '/api/ssh/test'),
        username: system.username,
        host: system.ip
      });

      const response = await fetch(agentUrl(system.ip, '/api/ssh/test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Gateway error: ${response.status}`);
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('SSH gateway connection failed:', error);
      return false;
    }
  }

  async executeCommand(command: string): Promise<string> {
    if (!this.system) {
      throw new Error('No system connected');
    }

    try {
      const requestBody = {
        command: command,
        username: this.system.username,
        password: this.system.password,
        host: this.system.ip
      };

      const response = await fetch(agentUrl(this.system.ip, '/api/ssh/execute'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gateway command execution failed');
      }

      const result = await response.json();
      return result.output || '';
    } catch (error) {
      throw new Error(`Gateway command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSystemStats(): Promise<{
    cpu: number;
    memory: number;
    uptime: string;
    processes: number;
  }> {
    // Fixed command string with proper escaping
    const command = [
      'CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\')',
      'MEM_INFO=$(free -m | awk \'/Mem:/ {print $3/$2 * 100}\')',
      'UPTIME=$(uptime -p)',
      'PROCS=$(ps aux | wc -l)',
      'echo "$CPU_USAGE::$MEM_INFO::$UPTIME::$PROCS"'
    ].join(' && ');

    try {
      const output = await this.executeCommand(command);
      const [cpu, memory, uptime, processes] = output.trim().split('::');

      return {
        cpu: parseFloat(cpu) || 0,
        memory: parseFloat(memory) || 0,
        uptime: uptime || 'unknown',
        processes: parseInt(processes) || 0
      };
    } catch (error) {
      console.error('Failed to get system stats:', error);
      return {
        cpu: 0,
        memory: 0,
        uptime: 'unknown',
        processes: 0
      };
    }
  }

  disconnect() {
    this.system = null;
  }
}
// services/system-monitor.ts
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import * as net from 'net';

const execAsync = promisify(exec);

export class SystemMonitor {
  async getStats() {
    try {
      const [cpuUsage, temperature] = await Promise.all([
        this.getCPUUsage(),
        this.getCPUTemperature()
      ]);

      return {
        cpu: {
          usage: cpuUsage,
          temperature,
          cores: os.cpus().map(cpu => ({
            model: cpu.model,
            speed: cpu.speed,
            times: cpu.times
          }))
        },
        memory: this.getMemoryInfo(),
        uptime: os.uptime(),
        load: os.loadavg(),
        platform: os.platform(),
        release: os.release()
      };
    } catch (error) {
      logger.error('Failed to get system stats:', error);
      throw error;
    }
  }

  async testConnectivity(host: string, port: number = 9050): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(5000); // 5 second timeout

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  private async getCPUUsage(): Promise<number> {
    const { stdout } = await execAsync('top -bn1');
    const cpuLine = stdout.split('\n')[2];
    const idleMatch = cpuLine.match(/(\d+\.\d+) id/);
    const idlePercentage = idleMatch ? parseFloat(idleMatch[1]) : 0;
    return 100 - idlePercentage;
  }

  private async getCPUTemperature(): Promise<number> {
    try {
      const { stdout } = await execAsync('cat /sys/class/thermal/thermal_zone0/temp');
      return parseInt(stdout) / 1000;
    } catch {
      return 0;
    }
  }

  private getMemoryInfo() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total,
      used,
      free,
      usage: (used / total) * 100
    };
  }
}

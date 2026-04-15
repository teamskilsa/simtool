// src/shared/users/systems/utils/ssh-client.ts

import type { SystemAccess } from '../types';

export interface SSHCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export class SSHClient {
  private connected: boolean = false;

  constructor(private config: SystemAccess) {}

  async connect(): Promise<void> {
    try {
      // Test connection with simple command
      await this.executeCommand('echo "test"');
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Connection failed: ${error}`);
    }
  }

  async executeCommand(command: string): Promise<SSHCommandResult> {
    try {
      const response = await fetch('/api/ssh/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: this.config.ip,
          port: this.config.port,
          username: this.config.username,
          privateKey: this.config.privateKey,
          command
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'SSH command failed');
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(`Command execution failed: ${error.message}`);
    }
  }

  async executeWithProgress(
    command: string,
    onProgress: (data: string) => void
  ): Promise<SSHCommandResult> {
    // For progress reporting, we'll need to use WebSocket
    // For now, just call regular execute
    onProgress('Starting command execution...');
    const result = await this.executeCommand(command);
    onProgress('Command completed.');
    return result;
  }

  disconnect(): void {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
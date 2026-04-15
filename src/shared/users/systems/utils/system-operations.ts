// src/shared/users/systems/utils/system-operations.ts

import type { SystemConnection } from '../types';
import { SSHClient, SSHCommandResult } from './ssh-client';

export interface UpdateOptions {
  version?: string;
  backup?: boolean;
  force?: boolean;
  timeout?: number;
}

export interface BackupOptions {
  type: 'full' | 'config' | 'logs';
  destination?: string;
  compress?: boolean;
}

export const systemOperations = {
  async executeSSHCommand(
    system: SystemConnection, 
    command: string,
    onProgress?: (data: string) => void
  ): Promise<SSHCommandResult> {
    if (!system.remoteAPI) {
      throw new Error('Remote access not configured for this system');
    }
    
    const client = new SSHClient(system.remoteAPI);
    
    try {
      await client.connect();
      
      if (onProgress) {
        return await client.executeWithProgress(command, onProgress);
      }
      
      return await client.executeCommand(command);
    } finally {
      client.disconnect();
    }
  },

  async updateSoftware(
    system: SystemConnection,
    options: UpdateOptions = {},
    onProgress?: (data: string) => void
  ): Promise<SSHCommandResult> {
    const command = [
      'update-software',
      options.version ? `--version ${options.version}` : '',
      options.backup ? '--backup' : '',
      options.force ? '--force' : ''
    ].filter(Boolean).join(' ');

    return this.executeSSHCommand(system, command, onProgress);
  },

  async backup(
    system: SystemConnection,
    options: BackupOptions,
    onProgress?: (data: string) => void
  ): Promise<SSHCommandResult> {
    const command = [
      'backup-system',
      `--type ${options.type}`,
      options.destination ? `--dest ${options.destination}` : '',
      options.compress ? '--compress' : ''
    ].filter(Boolean).join(' ');

    return this.executeSSHCommand(system, command, onProgress);
  },

  async checkStatus(system: SystemConnection): Promise<{
    success: boolean;
    services: { [key: string]: boolean };
    resources: {
      cpu: number;
      memory: number;
      disk: number;
    };
  }> {
    const result = await this.executeSSHCommand(system, 'check-system-status');
    
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new Error('Invalid status response');
    }
  }
};
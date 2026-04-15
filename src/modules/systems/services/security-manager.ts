// modules/systems/services/security-manager.ts
import { SecureCredentialsManager } from './secure-credentials';
import { SSHService } from './ssh-service';
import type { System } from '../types';

interface ConnectionResult {
  success: boolean;
  error?: string;
  details?: {
    canPing: boolean;
    sshAvailable: boolean;
    credentialsValid: boolean;
  };
}

export class SecurityManager {
  private static sshServices = new Map<number, SSHService>();

  static async connectToSystem(system: System): Promise<ConnectionResult> {
    try {
      // Step 1: Validate credentials
      if (!system.username || !system.password) {
        const storedCreds = SecureCredentialsManager.getCredentials(system.id);
        if (!storedCreds) {
          return {
            success: false,
            error: 'Missing SSH credentials',
            details: {
              canPing: false,
              sshAvailable: false,
              credentialsValid: false
            }
          };
        }
        system.username = storedCreds.username;
        system.password = storedCreds.password;
      }

      // Step 2: Initialize SSH Service
      let sshService = this.sshServices.get(system.id);
      if (!sshService) {
        sshService = new SSHService();
        this.sshServices.set(system.id, sshService);
      }

      // Step 3: Attempt Connection
      const connected = await sshService.connect(system);
      
      if (connected) {
        // Store credentials securely on successful connection
        SecureCredentialsManager.storeCredentials(system.id, {
          username: system.username,
          password: system.password
        });
      }

      return {
        success: connected,
        details: {
          canPing: true,
          sshAvailable: true,
          credentialsValid: connected
        }
      };

    } catch (error) {
      console.error('Connection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown connection error',
        details: {
          canPing: false,
          sshAvailable: false,
          credentialsValid: false
        }
      };
    }
  }

  static disconnectSystem(systemId: number) {
    const sshService = this.sshServices.get(systemId);
    if (sshService) {
      sshService.disconnect();
      this.sshServices.delete(systemId);
    }
    SecureCredentialsManager.removeCredentials(systemId);
  }

  static async executeCommand(systemId: number, command: string): Promise<string> {
    const sshService = this.sshServices.get(systemId);
    if (!sshService) {
      throw new Error('No active SSH connection');
    }
    return sshService.executeCommand(command);
  }
}

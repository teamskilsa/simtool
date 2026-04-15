// modules/systems/hooks/use-ssh-connection.ts
import { useState } from 'react';
import { SSHService } from '../services/ssh-service';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../types';

export function useSSHConnection() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sshService = new SSHService();

  const connect = async (system: System) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Attempting SSH connection:', {
        ip: system.ip,
        username: system.username
      });

      const success = await sshService.connect(system);
      
      if (success) {
        console.log('SSH connection successful');
        setConnected(true);
        return true;
      } else {
        throw new Error('Failed to establish SSH connection');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('SSH connection failed:', errorMessage);
      setError(errorMessage);
      setConnected(false);
      
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    if (sshService) {
      sshService.disconnect();
      setConnected(false);
      setError(null);
    }
  };

  const sendCommand = async (command: string): Promise<string> => {
    if (!sshService) {
      throw new Error('SSH service not initialized');
    }

    try {
      console.log('Sending SSH command:', command);
      return await sshService.executeCommand(command);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Command execution failed';
      console.error('SSH command failed:', errorMessage);
      
      toast({
        title: "Command Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw err;
    }
  };

  return {
    connected,
    loading,
    error,
    connect,
    disconnect,
    sendCommand
  };
}
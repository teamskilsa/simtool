// modules/systems/hooks/use-system-operations.ts
import { useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import type { System } from '../types';
import { useSystemConnection } from './use-system-connection';
import { useSystemStorage } from './use-system-storage';
import { useSystemMonitoring } from './use-system-monitoring';

export function useSystemOperations(systemId?: string) {
  const { checkConnection } = useSystemConnection();
  const { addSystem, updateSystem, deleteSystem } = useSystemStorage();
  const { startMonitoring, stopMonitoring, monitoring } = systemId 
    ? useSystemMonitoring(systemId)
    : { startMonitoring: () => {}, stopMonitoring: () => {}, monitoring: null };

  const handleAddSystem = useCallback(async (systemData: Partial<System>) => {
    try {
      // First add the system
      const newSystem = await addSystem(systemData);
      
      // Then check its connection
      const connectionResult = await checkConnection(newSystem);
      
      if (connectionResult) {
        toast({
          title: "System Added",
          description: "System has been added and connected successfully.",
        });

        // Initialize monitoring for the new system
        if (newSystem.id) {
          localStorage.setItem(`system_monitoring_${newSystem.id}`, JSON.stringify({
            pullDuration: 0,
            requestCount: 0,
            lastPull: new Date().toISOString(),
            status: 'inactive'
          }));
        }
      } else {
        toast({
          title: "System Added",
          description: "System added but connection check failed.",
          variant: "warning",
        });
      }

      return newSystem;
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add system",
        variant: "destructive",
      });
      throw error;
    }
  }, [addSystem, checkConnection]);

  const handleUpdateSystem = useCallback(async (systemId: string, updates: Partial<System>) => {
    try {
      await updateSystem(systemId, updates);

      // Check connection after update if connection details changed
      if (updates.host || updates.port || updates.username || updates.password) {
        const system = { id: systemId, ...updates };
        await checkConnection(system as System);
      }

      toast({
        title: "Success",
        description: "System has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update system",
        variant: "destructive",
      });
      throw error;
    }
  }, [updateSystem, checkConnection]);

  const handleDeleteSystem = useCallback(async (systemId: string) => {
    try {
      // Stop monitoring if active
      stopMonitoring();
      
      // Remove monitoring data
      localStorage.removeItem(`system_monitoring_${systemId}`);
      
      // Delete the system
      await deleteSystem(systemId);
      
      toast({
        title: "Success",
        description: "System has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete system",
        variant: "destructive",
      });
      throw error;
    }
  }, [deleteSystem, stopMonitoring]);

  const handleStartOperation = useCallback(async () => {
    if (!systemId) return;

    try {
      startMonitoring();
      toast({
        title: "Operation Started",
        description: "System monitoring has been started.",
      });
    } catch (error) {
      stopMonitoring();
      toast({
        title: "Error",
        description: "Failed to start operation",
        variant: "destructive",
      });
    }
  }, [systemId, startMonitoring, stopMonitoring]);

  const handleStopOperation = useCallback(() => {
    if (!systemId) return;

    try {
      stopMonitoring();
      toast({
        title: "Operation Stopped",
        description: "System monitoring has been stopped.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop operation",
        variant: "destructive",
      });
    }
  }, [systemId, stopMonitoring]);

  return {
    handleAddSystem,
    handleUpdateSystem,
    handleDeleteSystem,
    handleStartOperation,
    handleStopOperation,
    isRunning: monitoring?.status === 'active',
    monitoring
  };
}
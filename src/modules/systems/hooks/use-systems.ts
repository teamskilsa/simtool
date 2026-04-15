// modules/systems/hooks/use-systems.ts
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../types';

interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError?: string;
  pingOk?: boolean;
  sshOk?: boolean;
}

const STORAGE_KEY = 'stored_systems';

export function useSystems() {
  // Initialize systems from localStorage
  const [systems, setSystems] = useState<System[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  
  const [connections, setConnections] = useState<Map<number, ConnectionStatus>>(new Map());
  const [monitoring, setMonitoring] = useState({ isActive: false });
  const [loading, setLoading] = useState(true);

  // Save systems to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(systems));
  }, [systems]);

  const connectSystem = async (system: System) => {
    try {
      setConnections(prev => {
        const newMap = new Map(prev);
        newMap.set(system.id, { status: 'connecting' });
        return newMap;
      });

      // Try to connect to the system
      const response = await fetch(`http://${system.ip}:9050/api/health`);
      const pingOk = response.ok;

      // Try SSH if ping successful
      let sshOk = false;
      if (pingOk && system.username && system.password) {
        const sshResponse = await fetch(`http://${system.ip}:9050/api/ssh/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: system.username,
            password: system.password
          })
        });
        const sshResult = await sshResponse.json();
        sshOk = sshResult.success;
      }

      setConnections(prev => {
        const newMap = new Map(prev);
        newMap.set(system.id, {
          status: pingOk ? 'connected' : 'error',
          pingOk,
          sshOk,
          lastError: !pingOk ? 'System not reachable' : 
                    !sshOk ? 'SSH connection failed' : undefined
        });
        return newMap;
      });

      return true;
    } catch (error) {
      setConnections(prev => {
        const newMap = new Map(prev);
        newMap.set(system.id, {
          status: 'error',
          pingOk: false,
          sshOk: false,
          lastError: error instanceof Error ? error.message : 'Connection failed'
        });
        return newMap;
      });
      return false;
    }
  };

  const addSystem = async (systemData: Partial<System>): Promise<System> => {
    const newSystem = {
      id: Date.now(),
      name: systemData.name || '',
      type: systemData.type || 'Callbox',
      ip: systemData.ip || '',
      username: systemData.username || '',
      password: systemData.password || '',
      status: 'stopped',
      ...systemData,
    } as System;

    setSystems(prev => [...prev, newSystem]);
    
    // Try to connect the new system
    await connectSystem(newSystem);
    
    toast({
      title: "System Added",
      description: `${newSystem.name} has been added successfully.`,
    });

    return newSystem;
  };

  const updateSystem = async (systemId: number, updates: Partial<System>) => {
    setSystems(prev => prev.map(system => 
      system.id === systemId ? { ...system, ...updates } : system
    ));
    
    // Refresh connection if connection-related fields were updated
    const updatedSystem = systems.find(s => s.id === systemId);
    if (updatedSystem && (updates.ip || updates.username || updates.password)) {
      await connectSystem({ ...updatedSystem, ...updates });
    }
  };

  const deleteSystem = async (systemId: number) => {
    setSystems(prev => prev.filter(system => system.id !== systemId));
    setConnections(prev => {
      const newMap = new Map(prev);
      newMap.delete(systemId);
      return newMap;
    });
  };

  const refreshSystem = async (systemId: number) => {
    const system = systems.find(s => s.id === systemId);
    if (system) {
      await connectSystem(system);
    }
  };

  const refreshAllSystems = async () => {
    for (const system of systems) {
      await refreshSystem(system.id);
    }
  };

  const startMonitoring = async (duration: number, interval: number) => {
    setMonitoring({ isActive: true });
    // Additional monitoring logic here
  };

  const stopMonitoring = async () => {
    setMonitoring({ isActive: false });
    // Additional stop monitoring logic here
  };

  // Load initial data
  useEffect(() => {
    const loadSystems = async () => {
      setLoading(true);
      try {
        // Connect all systems initially
        await refreshAllSystems();
      } catch (error) {
        console.error('Failed to load systems:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSystems();
  }, []); // Empty dependency array means this runs once on mount

  return {
    systems,
    connections,
    monitoring,
    loading,
    addSystem,
    updateSystem,
    deleteSystem,
    refreshSystem,
    refreshAllSystems,
    connectSystem,
    startMonitoring,
    stopMonitoring
  };
}
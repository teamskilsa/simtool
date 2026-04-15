// src/shared/users/systems/hooks/use-systems-config.ts
import { useState, useCallback } from 'react';
import { systemsConfig } from '../config/config';
import type { SystemConnection, SystemGroup } from '../types';

export function useSystemsConfig() {
  const [config, setConfig] = useState(systemsConfig);

  const getAllSystems = useCallback(() => {
    return [
      ...config.defaultGroup.systems,
      ...config.groups.flatMap(group => group.systems)
    ];
  }, [config]);

  const getSystemById = useCallback((id: string) => {
    return getAllSystems().find(system => system.id === id);
  }, [getAllSystems]);

  const getSystemsByType = useCallback((type: SystemConnection['type']) => {
    return getAllSystems().filter(system => system.type === type);
  }, [getAllSystems]);

  const addSystem = useCallback((system: SystemConnection, groupId: string = 'default') => {
    setConfig(prev => {
      if (groupId === 'default') {
        return {
          ...prev,
          defaultGroup: {
            ...prev.defaultGroup,
            systems: [...prev.defaultGroup.systems, system]
          }
        };
      }

      return {
        ...prev,
        groups: prev.groups.map(group => 
          group.id === groupId 
            ? { ...group, systems: [...group.systems, system] }
            : group
        )
      };
    });
  }, []);

  return {
    config,
    getAllSystems,
    getSystemById,
    getSystemsByType,
    addSystem
  };
}
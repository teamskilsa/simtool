// modules/systems/hooks/use-system-storage.ts
import { useState, useEffect } from 'react';
import type { System } from '../types';

export function useSystemStorage() {
  const [systems, setSystems] = useState<System[]>(() => {
    const saved = localStorage.getItem('systems');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('systems', JSON.stringify(systems));
  }, [systems]);

  const addSystem = (system: Partial<System>) => {
    setSystems(prev => [...prev, {
      id: Date.now(),
      name: system.name || '',
      type: system.type || 'Callbox',
      ip: system.ip || '',
      status: 'stopped',
      ...system
    }]);
  };

  const updateSystem = (id: number, updates: Partial<System>) => {
    setSystems(prev => prev.map(sys => 
      sys.id === id ? { ...sys, ...updates } : sys
    ));
  };

  const deleteSystem = (id: number) => {
    setSystems(prev => prev.filter(sys => sys.id !== id));
  };

  return { systems, addSystem, updateSystem, deleteSystem };
}


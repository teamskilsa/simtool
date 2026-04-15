import { useState, useMemo } from 'react';
import type { System, SystemFilters } from '../types';

export function useSystemsFilter(systems: System[]) {
  const [filters, setFilters] = useState<SystemFilters>({
    search: '',
    type: 'all',
    status: 'all',
    sortBy: 'name'
  });

  const filteredSystems = useMemo(() => {
    return systems.filter(system => {
      const matchesSearch = system.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                          system.ip.toLowerCase().includes(filters.search.toLowerCase());
      const matchesType = filters.type === 'all' || system.type === filters.type;
      const matchesStatus = filters.status === 'all' || system.status === filters.status;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [systems, filters]);

  return {
    filters,
    setFilters,
    filteredSystems
  };
}

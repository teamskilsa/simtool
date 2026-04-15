// ConfigList/hooks/useConfigList.ts

import { useState, useMemo } from 'react';
import { ConfigItem } from '../../../types';

export function useConfigList(configs: ConfigItem[]) {
  const [selectedConfigs, setSelectedConfigs] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameConfigId, setRenameConfigId] = useState<string | null>(null);
  const [isAssignToGroupOpen, setIsAssignToGroupOpen] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<string | null>(null);

  const groupedConfigs = useMemo(() => {
    return configs.reduce((acc, config) => {
      const group = config.group || 'Ungrouped';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(config);
      return acc;
    }, {} as Record<string, ConfigItem[]>);
  }, [configs]);

  const filteredConfigs = useMemo(() => {
    let filtered = configs;
    if (searchTerm) {
      filtered = filtered.filter(config => 
        config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.module.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (activeGroup) {
      filtered = filtered.filter(config => config.group === activeGroup);
    }
    return filtered;
  }, [configs, searchTerm, activeGroup]);

  const handleBulkSelect = (checked: boolean) => {
    if (checked) {
      setSelectedConfigs(new Set(filteredConfigs.map(c => c.id)));
    } else {
      setSelectedConfigs(new Set());
    }
  };

  const handleSingleSelect = (configId: string, checked: boolean) => {
    setSelectedConfigs(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(configId);
      } else {
        next.delete(configId);
      }
      return next;
    });
  };

  return {
    // States
    selectedConfigs,
    isCollapsed,
    searchTerm,
    activeGroup,
    isRenameDialogOpen,
    renameValue,
    renameConfigId,
    isAssignToGroupOpen,
    selectedForGroup,
    groupedConfigs,
    filteredConfigs,

    // Setters
    setSelectedConfigs,
    setIsCollapsed,
    setSearchTerm,
    setActiveGroup,
    setIsRenameDialogOpen,
    setRenameValue,
    setRenameConfigId,
    setIsAssignToGroupOpen,
    setSelectedForGroup,

    // Handlers
    handleBulkSelect,
    handleSingleSelect
  };
}
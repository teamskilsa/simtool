import { useEffect, useCallback } from 'react';
import { useGroupStore } from './store';
import { Group } from './types';

export const useGroupManagement = () => {
  const store = useGroupStore();
  
  const loadGroups = useCallback(async () => {
    await store.loadGroups();
  }, [store]);

  const createGroup = useCallback(async (group: Omit<Group, 'id'>) => {
    await store.createGroup(group);
  }, [store]);

  const updateGroup = useCallback(async (group: Group) => {
    await store.updateGroup(group);
  }, [store]);

  const deleteGroup = useCallback(async (groupId: string) => {
    await store.deleteGroup(groupId);
  }, [store]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return {
    groups: store.groups,
    filteredGroups: store.filteredGroups,
    selectedGroupId: store.selectedGroupId,
    loading: store.loading,
    error: store.error,
    loadGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    setSelectedGroup: store.setSelectedGroup,
    filterGroups: store.filterGroups
  };
};

export const useConfigManagement = (groupId: string | null) => {
  const store = useGroupStore();

  const addConfigs = useCallback(async (configIds: string[]) => {
    if (!groupId) return;
    await store.addConfigsToGroup(groupId, configIds);
  }, [store, groupId]);

  const removeConfigs = useCallback(async (configIds: string[]) => {
    if (!groupId) return;
    await store.removeConfigsFromGroup(groupId, configIds);
  }, [store, groupId]);

  return {
    configs: store.configs,
    selectedConfigs: store.selectedConfigs,
    toggleSelection: store.toggleConfigSelection,
    clearSelection: store.clearConfigSelection,
    addConfigs,
    removeConfigs
  };
};
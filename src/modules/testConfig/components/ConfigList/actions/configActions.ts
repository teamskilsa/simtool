// ConfigList/actions/configActions.ts

import { ConfigItem } from '../../../types';
import { groupService } from '../../../services/groups.service';

export const configActions = {
  handleDelete: async (
    configId: string,
    onDelete: (id: string) => void,
    setSelectedConfigs: (configs: Set<string>) => void
  ) => {
    onDelete(configId);
    setSelectedConfigs(prev => {
      const next = new Set(prev);
      next.delete(configId);
      return next;
    });
  },

  handleBulkDelete: async (
    selectedConfigs: Set<string>,
    onDelete: (id: string) => void,
    setSelectedConfigs: (configs: Set<string>) => void
  ) => {
    for (const id of selectedConfigs) {
      await configActions.handleDelete(id, onDelete, setSelectedConfigs);
    }
  },

  handleGroupAssign: async (
    userId: string,
    groupId: string,
    configId: string,
    loadConfigs: () => Promise<void>,
    onSuccess: () => void,
    onError: (error: Error) => void
  ) => {
    try {
      await groupService.addConfigToGroup(userId, groupId, configId);
      await loadConfigs();
      onSuccess();
    } catch (error) {
      onError(error as Error);
    }
  }
};
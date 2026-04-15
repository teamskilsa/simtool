// ConfigList/actions/groupActions.ts
import { groupService } from '../../../services/groups.service';
import { ConfigItem } from '../../../types';
import { toast } from '@/components/ui/use-toast';

export const groupActions = {
  addConfigToGroup: async (
    userId: string,
    groupId: string,
    configId: string,
    loadConfigs: () => Promise<void>
  ) => {
    try {
      await groupService.addConfigToGroup(userId, groupId, configId);
      await loadConfigs();
      toast({
        title: "Success",
        description: "Configuration added to group"
      });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add configuration to group",
        variant: "destructive"
      });
      return false;
    }
  },

  removeConfigFromGroup: async (
    userId: string,
    groupId: string,
    configId: string,
    loadConfigs: () => Promise<void>
  ) => {
    try {
      await groupService.removeConfigFromGroup(userId, groupId, configId);
      await loadConfigs();
      toast({
        title: "Success",
        description: "Configuration removed from group"
      });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove configuration from group",
        variant: "destructive"
      });
      return false;
    }
  },

  handleBulkGroupAssign: async (
    userId: string,
    groupId: string,
    configIds: string[],
    loadConfigs: () => Promise<void>
  ) => {
    const results = await Promise.all(
      configIds.map(configId => 
        groupActions.addConfigToGroup(userId, groupId, configId, loadConfigs)
      )
    );
    return results.every(result => result);
  }
};
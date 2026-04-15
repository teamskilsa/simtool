// groupStore.ts
import { create } from 'zustand';
import { groupService } from '../services/groups.service';
import { toast } from '@/components/ui/use-toast';
import { Group } from '../types/group.types';
import { ConfigItem } from '../types/testConfig.types';

interface GroupState {
  groups: Group[];
  configs: ConfigItem[];
  groupConfigs: Record<string, string[]>; // Maps groupId to array of configIds
  selectedGroupId: string | null;
  isLoading: boolean;
  error: string | null;
  loadingGroups: Record<string, boolean>;
  
  loadGroups: (userId: string) => Promise<void>;
  loadConfigs: (userId: string) => Promise<void>;
  loadGroupConfigs: (groupId: string) => Promise<void>;
  createGroup: (name: string, userId: string, parentId?: string) => Promise<boolean>;
  deleteGroup: (groupId: string, userId: string) => Promise<boolean>;
  updateGroup: (group: Group, userId: string) => Promise<boolean>;
  setSelectedGroup: (groupId: string | null) => void;
  addConfigToGroup: (configId: string, groupId: string, userId: string) => Promise<void>;
  removeConfigFromGroup: (configId: string, groupId: string, userId: string) => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  configs: [],
  groupConfigs: {},
  selectedGroupId: null,
  isLoading: false,
  error: null,
  loadingGroups: {},

  loadGroups: async (userId: string) => {
    try {
      set({ isLoading: true, error: null });
      const groups = await groupService.getGroups(userId);
      set({ groups });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load groups';
      set({ error: errorMessage });
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      set({ isLoading: false });
    }
  },

  loadConfigs: async (userId: string) => {
    try {
      const response = await fetch(`/api/configs?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to load configurations');
      }
      const configs = await response.json();
      set({ configs });
    } catch (error) {
      console.error('Failed to load configurations:', error);
      toast({
        title: "Error",
        description: "Failed to load configurations",
        variant: "destructive"
      });
    }
  },


  loadGroupConfigs: async (groupId: string) => {
    const state = get();
    if (state.loadingGroups[groupId]) {
      console.log('Skipping load - already loading:', groupId);
      return;
    }
  
    try {
      console.log('Starting load for group:', groupId);
      set(state => ({
        loadingGroups: { ...state.loadingGroups, [groupId]: true }
      }));
  
      const configs = await groupService.getGroupConfigs(groupId);
      console.log('Received configs:', configs);
  
      // Important: We need to ensure we're storing the config names as an array
      const configNames = configs.map((config: any) => 
        typeof config === 'string' ? config : config.name
      );
      console.log('Config names to store:', configNames);
  
      // Update group configs with the array of names
      set(state => ({
        groupConfigs: {
          ...state.groupConfigs,
          [groupId]: configNames // Store the actual array of config names
        },
        loadingGroups: {
          ...state.loadingGroups,
          [groupId]: false
        }
      }));
    } catch (error) {
      console.error('Failed to load group configs:', error);
      // Reset loading state on error
      set(state => ({
        loadingGroups: {
          ...state.loadingGroups,
          [groupId]: false
        }
      }));
    }
  },
  
  createGroup: async (name: string, userId: string, parentId?: string) => {
    try {
      set({ isLoading: true });
      const success = await groupService.createGroup({ name, parentId }, userId);
      if (success) {
        get().loadGroups(userId);
      }
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive"
      });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
 
  deleteGroup: async (groupId: string, userId: string) => {
    try {
      set({ isLoading: true });
      await groupService.deleteGroup(userId, groupId);
      
      set((state) => {
        // Create a new groupConfigs object without the deleted group
        const { [groupId]: deletedGroup, ...remainingConfigs } = state.groupConfigs;
        
        return {
          groups: state.groups.filter(g => g.id !== groupId),
          selectedGroupId: state.selectedGroupId === groupId ? null : state.selectedGroupId,
          groupConfigs: remainingConfigs,
          configs: state.configs, // Preserve existing configs
          isLoading: state.isLoading,
          error: state.error,
          loadingGroups: state.loadingGroups
        };
      });

      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive"
      });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  updateGroup: async (group: Group, userId: string) => {
    try {
      set({ isLoading: true });
      await groupService.updateGroup(group, userId);
      
      set(state => ({
        groups: state.groups.map(g => g.id === group.id ? group : g)
      }));

      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update group",
        variant: "destructive"
      });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  setSelectedGroup: (groupId: string | null) => {
    set({ selectedGroupId: groupId });
    if (groupId) {
      const state = get();
      if (!state.groupConfigs[groupId]) {
        get().loadGroupConfigs(groupId);
      }
    }
  },

  addConfigToGroup: async (configId: string, groupId: string, userId: string) => {
    try {
      await groupService.addConfigToGroup(userId, groupId, configId);
      await get().loadGroupConfigs(groupId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add configuration to group",
        variant: "destructive"
      });
    }
  },

  removeConfigFromGroup: async (configId: string, groupId: string, userId: string) => {
    try {
      await groupService.removeConfigFromGroup(userId, groupId, configId);
      await get().loadGroupConfigs(groupId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove configuration from group",
        variant: "destructive"
      });
    }
  }
}));
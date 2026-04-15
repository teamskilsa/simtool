import { create } from 'zustand';
import { Group, GroupSelectionState, ConfigItem } from './types';

interface GroupStore {
  // State
  groups: Group[];
  filteredGroups: Group[];
  selectedGroupId: string | null;
  configs: ConfigItem[];
  selectedConfigs: Set<string>;
  loading: boolean;
  error: string | null;

  // Group Actions
  setGroups: (groups: Group[]) => void;
  setSelectedGroup: (groupId: string | null) => void;
  filterGroups: (searchTerm: string) => void;
  loadGroups: () => Promise<void>;
  createGroup: (group: Omit<Group, 'id'>) => Promise<void>;
  updateGroup: (group: Group) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;

  // Config Actions
  setConfigs: (configs: ConfigItem[]) => void;
  toggleConfigSelection: (configId: string) => void;
  clearConfigSelection: () => void;
  addConfigsToGroup: (groupId: string, configIds: string[]) => Promise<void>;
  removeConfigsFromGroup: (groupId: string, configIds: string[]) => Promise<void>;
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  groups: [],
  filteredGroups: [],
  selectedGroupId: null,
  configs: [],
  selectedConfigs: new Set(),
  loading: false,
  error: null,

  setGroups: (groups) => set({ groups, filteredGroups: groups }),
  
  setSelectedGroup: (groupId) => set({ 
    selectedGroupId: groupId,
    selectedConfigs: new Set()
  }),

  filterGroups: (searchTerm) => {
    const { groups } = get();
    if (!searchTerm) {
      set({ filteredGroups: groups });
      return;
    }
    const term = searchTerm.toLowerCase();
    const filtered = groups.filter(group => 
      group.name.toLowerCase().includes(term) ||
      group.description?.toLowerCase().includes(term)
    );
    set({ filteredGroups: filtered });
  },

  loadGroups: async () => {
    try {
      set({ loading: true, error: null });
      const response = await fetch('/api/groups');
      if (!response.ok) throw new Error('Failed to load groups');
      const groups = await response.json();
      set({ groups, filteredGroups: groups });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load groups' });
    } finally {
      set({ loading: false });
    }
  },

  createGroup: async (group) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group })
      });
      if (!response.ok) throw new Error('Failed to create group');
      get().loadGroups();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create group' });
    } finally {
      set({ loading: false });
    }
  },

  updateGroup: async (group) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group })
      });
      if (!response.ok) throw new Error('Failed to update group');
      get().loadGroups();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update group' });
    } finally {
      set({ loading: false });
    }
  },

  deleteGroup: async (groupId) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete group');
      get().loadGroups();
      if (get().selectedGroupId === groupId) {
        set({ selectedGroupId: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete group' });
    } finally {
      set({ loading: false });
    }
  },

  setConfigs: (configs) => set({ configs }),
  
  toggleConfigSelection: (configId) => set(state => ({
    selectedConfigs: new Set(
      state.selectedConfigs.has(configId)
        ? Array.from(state.selectedConfigs).filter(id => id !== configId)
        : [...state.selectedConfigs, configId]
    )
  })),

  clearConfigSelection: () => set({ selectedConfigs: new Set() }),

  addConfigsToGroup: async (groupId, configIds) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch(`/api/groups/${groupId}/configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configIds })
      });
      if (!response.ok) throw new Error('Failed to add configs to group');
      get().loadGroups();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add configs' });
    } finally {
      set({ loading: false });
    }
  },

  removeConfigsFromGroup: async (groupId, configIds) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch(`/api/groups/${groupId}/configs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configIds })
      });
      if (!response.ok) throw new Error('Failed to remove configs from group');
      get().loadGroups();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to remove configs' });
    } finally {
      set({ loading: false });
    }
  }
}));
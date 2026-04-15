// store/scenario/scenarioStore.ts
import { create } from 'zustand';
import { ScenarioConfig } from '../../types/scenario.types';
import { scenarioService } from '../../services/scenario/scenario.service';

interface ScenarioState {
  scenarios: ScenarioConfig[];
  selectedScenario: ScenarioConfig | null;
  selectedGroupId: string | null;
  isLoading: boolean;
  error: string | null;

  loadScenarios: (userId: string) => Promise<void>;
  saveScenario: (userId: string, scenario: ScenarioConfig, groupId?: string) => Promise<void>;
  createGroup: (userId: string, name: string) => Promise<void>;
  deleteGroup: (userId: string, groupId: string) => Promise<void>;
  moveToGroup: (userId: string, scenarioId: string, groupId: string) => Promise<void>;
  selectScenario: (scenario: ScenarioConfig | null) => void;
  selectGroup: (groupId: string | null) => void;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenarios: [],
  selectedScenario: null,
  selectedGroupId: null,
  isLoading: false,
  error: null,

  loadScenarios: async (userId: string) => {
    try {
      set({ isLoading: true, error: null });
      const scenarios = await scenarioService.getScenarios(
        userId, 
        get().selectedGroupId || undefined
      );
      set({ scenarios, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load scenarios', 
        isLoading: false 
      });
    }
  },

  saveScenario: async (userId: string, scenario: ScenarioConfig, groupId?: string) => {
    console.log('ScenarioStore.saveScenario called with:', {
      userId,
      scenario,
      groupId
    });

    try {
      set({ isLoading: true, error: null });
      await scenarioService.saveScenario(userId, scenario, groupId);
      console.log('Scenario saved successfully, reloading scenarios...');
      await get().loadScenarios(userId);
      set({ isLoading: false });
    } catch (error) {
      console.error('ScenarioStore.saveScenario error:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to save scenario', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  createGroup: async (userId: string, name: string) => {
    try {
      set({ isLoading: true, error: null });
      await scenarioService.createGroup(userId, name);
      await get().loadScenarios(userId);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create group', 
        isLoading: false 
      });
    }
  },

  deleteGroup: async (userId: string, groupId: string) => {
    try {
      set({ isLoading: true, error: null });
      await scenarioService.deleteGroup(userId, groupId);
      if (get().selectedGroupId === groupId) {
        set({ selectedGroupId: null });
      }
      await get().loadScenarios(userId);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete group', 
        isLoading: false 
      });
    }
  },

  moveToGroup: async (userId: string, scenarioId: string, groupId: string) => {
    try {
      set({ isLoading: true, error: null });
      await scenarioService.moveToGroup(userId, scenarioId, groupId);
      await get().loadScenarios(userId);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to move scenario', 
        isLoading: false 
      });
    }
  },

  selectScenario: (scenario: ScenarioConfig | null) => {
    set({ selectedScenario: scenario });
  },

  selectGroup: (groupId: string | null) => {
    set({ selectedGroupId: groupId });
  }
}));
import { create } from 'zustand';
import { ExecutionStatus, ExecutionStep, TestComponent, ExecutionConfig } from '../../types';

interface ExecutionState {
  currentExecutionId: string | null;
  status: ExecutionStatus;
  steps: ExecutionStep[];
  components: TestComponent[];
  logs: string[];
  error: string | null;

  startExecution: (config: ExecutionConfig) => Promise<void>;
  stopExecution: () => Promise<void>;
  updateStatus: (executionId: string) => Promise<void>;
  resetExecution: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  currentExecutionId: null,
  status: 'pending',
  steps: [],
  components: [],
  logs: [],
  error: null,

  startExecution: async (config) => {
    try {
      // Implementation here
      set({ status: 'running', error: null });
    } catch (error) {
      set({ error: 'Failed to start execution' });
    }
  },

  stopExecution: async () => {
    try {
      // Implementation here
      set({ status: 'pending' });
    } catch (error) {
      set({ error: 'Failed to stop execution' });
    }
  },

  updateStatus: async (executionId) => {
    try {
      // Implementation here
      // Update steps and status
    } catch (error) {
      set({ error: 'Failed to update status' });
    }
  },

  resetExecution: () => {
    set({
      currentExecutionId: null,
      status: 'pending',
      steps: [],
      components: [],
      logs: [],
      error: null
    });
  }
}));

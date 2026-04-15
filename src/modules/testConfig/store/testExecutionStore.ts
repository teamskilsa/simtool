import { create } from 'zustand';
import { TestResult } from '@/modules/testConfig/types/test.types';
import { ConfigItem } from '@/modules/testConfig/types/testConfig.types';

interface TestExecutionState {
  activeTests: Map<string, TestResult>;
  testHistory: TestResult[];
  selectedTest: TestResult | null;
  
  // Actions
  startTest: (config: ConfigItem) => string;
  updateTestProgress: (result: TestResult) => void;
  completeTest: (result: TestResult) => void;
  selectTest: (testId: string | null) => void;
  clearHistory: () => void;
  
  // Getters
  getTestById: (testId: string) => TestResult | undefined;
  getLatestTestForConfig: (configId: string) => TestResult | undefined;
}

export const useTestExecutionStore = create<TestExecutionState>((set, get) => ({
  activeTests: new Map(),
  testHistory: [],
  selectedTest: null,

  startTest: (config: ConfigItem) => {
    const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTest: TestResult = {
      id: testId,
      configId: config.id,
      status: 'running',
      steps: [],
      startTime: new Date(),
      module: config.module
    };

    set(state => ({
      activeTests: new Map(state.activeTests).set(testId, newTest)
    }));

    return testId;
  },

  updateTestProgress: (result: TestResult) => {
    set(state => ({
      activeTests: new Map(state.activeTests).set(result.id, result)
    }));
  },

  completeTest: (result: TestResult) => {
    set(state => {
      const newActiveTests = new Map(state.activeTests);
      newActiveTests.delete(result.id);
      
      return {
        activeTests: newActiveTests,
        testHistory: [...state.testHistory, result]
      };
    });
  },

  selectTest: (testId: string | null) => {
    const state = get();
    const test = testId 
      ? state.activeTests.get(testId) || 
        state.testHistory.find(t => t.id === testId) ||
        null
      : null;
    
    set({ selectedTest: test });
  },

  clearHistory: () => set({ testHistory: [] }),

  getTestById: (testId: string) => {
    const state = get();
    return state.activeTests.get(testId) || 
           state.testHistory.find(t => t.id === testId);
  },

  getLatestTestForConfig: (configId: string) => {
    const state = get();
    return [...state.testHistory]
      .filter(t => t.configId === configId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
  }
}));
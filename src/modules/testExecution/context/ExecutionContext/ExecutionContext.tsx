import { createContext, useContext } from 'react';
import { ExecutionConfig, ExecutionStatus, ExecutionStep } from '../../types';

interface ExecutionContextType {
  status: ExecutionStatus;
  steps: ExecutionStep[];
  startExecution: (config: ExecutionConfig) => Promise<void>;
  stopExecution: () => Promise<void>;
  resetExecution: () => void;
}

export const ExecutionContext = createContext<ExecutionContextType | undefined>(undefined);

export const useExecutionContext = () => {
  const context = useContext(ExecutionContext);
  if (!context) {
    throw new Error('useExecutionContext must be used within ExecutionProvider');
  }
  return context;
};

import React, { useState, useCallback } from 'react';
import { ExecutionContext } from './ExecutionContext';
import { ExecutionConfig, ExecutionStatus, ExecutionStep } from '../../types';
import { executionService } from '../../services';
import { useToast } from '@/components/ui/use-toast';

export const ExecutionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ExecutionStatus>('pending');
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const { toast } = useToast();

  const startExecution = useCallback(async (config: ExecutionConfig) => {
    try {
      await executionService.startExecution(config);
      setStatus('running');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start execution',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const stopExecution = useCallback(async () => {
    try {
      // Implementation here
      setStatus('pending');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to stop execution',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const resetExecution = useCallback(() => {
    setStatus('pending');
    setSteps([]);
  }, []);

  return (
    <ExecutionContext.Provider
      value={{
        status,
        steps,
        startExecution,
        stopExecution,
        resetExecution
      }}
    >
      {children}
    </ExecutionContext.Provider>
  );
};

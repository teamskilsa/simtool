import { useState, useCallback } from 'react';
import { ExecutionConfig, ExecutionStatus, ExecutionStep } from '../../types';
import { executionService } from '../../services';
import { useToast } from '@/components/ui/use-toast';

export const useExecutionControl = () => {
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [status, setStatus] = useState<ExecutionStatus>('pending');
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const { toast } = useToast();

  const startExecution = useCallback(async (config: ExecutionConfig) => {
    try {
      const id = await executionService.startExecution(config);
      setExecutionId(id);
      setStatus('running');
      return id;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start execution',
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  const stopExecution = useCallback(async () => {
    if (!executionId) return;

    try {
      await executionService.stopExecution(executionId);
      setStatus('pending');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to stop execution',
        variant: 'destructive'
      });
      throw error;
    }
  }, [executionId, toast]);

  const updateStatus = useCallback(async () => {
    if (!executionId) return;

    try {
      const { status: newStatus, steps: newSteps } = 
        await executionService.getExecutionStatus(executionId);
      
      setStatus(newStatus);
      setSteps(newSteps);

      return newStatus;
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }, [executionId]);

  return {
    executionId,
    status,
    steps,
    startExecution,
    stopExecution,
    updateStatus
  };
};

import { useState, useEffect, useCallback } from 'react';
import { executionService } from '../../services';

export const useExecutionLogs = (executionId: string | null) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [lastTimestamp, setLastTimestamp] = useState<number>(0);

  const fetchLogs = useCallback(async () => {
    if (!executionId) return;

    try {
      const newLogs = await executionService.getExecutionLogs(executionId, lastTimestamp);
      
      if (newLogs.length > 0) {
        setLogs(prevLogs => [...prevLogs, ...newLogs]);
        setLastTimestamp(Date.now());
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }, [executionId, lastTimestamp]);

  useEffect(() => {
    if (!executionId) return;

    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, [executionId, fetchLogs]);

  return { logs };
};

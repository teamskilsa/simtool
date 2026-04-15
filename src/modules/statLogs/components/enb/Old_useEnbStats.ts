import { useState, useEffect, useCallback, useRef } from 'react';
import { useRemoteAPI } from '@/modules/remoteAPI';
import { 
  parseEnbStats,
  createTimeSeriesDataPoint, 
  type EnbStats 
} from '../utils/enbStatsHandler';

interface UseEnbStatsOptions {
  pollInterval?: number;
  autoConnect?: boolean;
  onStatsUpdate?: (stats: EnbStats) => void;
}

export function useEnbStats(ip: string, options: UseEnbStatsOptions = {}) {
  const {
    pollInterval = 5000,
    autoConnect = false,
    onStatsUpdate
  } = options;

  const {
    client,
    connected,
    error: connectionError,
    connect,
    disconnect,
    execute
  } = useRemoteAPI({
    server: ip,
    port: 9001,
    ssl: false
  });

  const [stats, setStats] = useState<EnbStats | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout>();

  const fetchStats = useCallback(async () => {
    if (!client || !connected) {
      console.log('Not connected, skipping fetch');
      return;
    }

    try {
      console.log('Fetching stats...');
      
      // Call execute with just the message name and let websocket-client.ts 
      // handle the message_id generation
      const response = await client.sendMessage({
        message: "stats",
        samples: true,
        rf: true,
        Initial_delay: 0.7
      });

      // Log the complete response
      console.log('Complete stats response:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.error) {
        throw new Error(response.error);
      }

      setStats(response);
      onStatsUpdate?.(response);
    } catch (err) {
      console.error('Stats fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch stats'));
    }
  }, [client, connected, onStatsUpdate]);

  const startMonitoring = useCallback(async () => {
    console.log('Starting monitoring...');
    try {
      if (!connected) {
        console.log('Connecting to', ip);
        await connect();
        console.log('Connected successfully');
      }

      setIsPolling(true);
      console.log('Initial fetch...');
      await fetchStats();
      console.log('Setting up polling interval:', pollInterval);
      pollIntervalRef.current = setInterval(fetchStats, pollInterval);
    } catch (err) {
      console.error('Start monitoring error:', err);
      setError(err instanceof Error ? err : new Error('Failed to start monitoring'));
      setIsPolling(false);
    }
  }, [connect, connected, fetchStats, pollInterval, ip]);

  const stopMonitoring = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setIsPolling(false);
    disconnect();
  }, [disconnect]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    stats,
    error: error || connectionError,
    isConnected: connected,
    startMonitoring,
    stopMonitoring,
  };
}
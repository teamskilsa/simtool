import { useState, useEffect, useCallback, useRef } from 'react';
import { useRemoteAPI } from '@/modules/remoteAPI';

interface UseEnbStatsOptions {
  pollInterval?: number;
  autoConnect?: boolean;
  onStatsUpdate?: (stats: any) => void;
  port?: number;
}

export function useEnbStats(ip: string, options: UseEnbStatsOptions = {}) {
  const {
    pollInterval = 5000,
    autoConnect = false,
    onStatsUpdate,
    port = 9001  // Default ENB port
  } = options;

  const remoteAPI = useRemoteAPI({
    server: ip,
    port: port,
    ssl: false
  });

  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout>();

  const fetchStats = useCallback(async () => {
    if (!remoteAPI.connected) {
      console.log(`Not connected to ${ip}:${port}, skipping fetch`);
      return;
    }

    try {
      console.log(`Fetching stats from ${ip}:${port}`);
      const response = await remoteAPI.execute('stats', {
        message: "stats",
        samples: true,
        rf: true,
        Initial_delay: 0.7
      });

      console.log('Stats response:', response);
      setStats(response);
      onStatsUpdate?.(response);
    } catch (err) {
      console.error('Stats fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch stats'));
    }
  }, [remoteAPI, ip, port, onStatsUpdate]);

  const startMonitoring = useCallback(async () => {
    console.log(`Starting monitoring on ${ip}:${port}`);
    try {
      if (!remoteAPI.connected) {
        console.log(`Connecting to ${ip}:${port}`);
        await remoteAPI.connect();
        console.log('Connected successfully');
      }

      setIsPolling(true);
      console.log('Initial fetch...');
      await fetchStats();
      console.log(`Setting up polling interval: ${pollInterval}ms`);
      pollIntervalRef.current = setInterval(fetchStats, pollInterval);
    } catch (err) {
      console.error('Start monitoring error:', err);
      setError(err instanceof Error ? err : new Error('Failed to start monitoring'));
      setIsPolling(false);
    }
  }, [remoteAPI, fetchStats, pollInterval, ip, port]);

  const stopMonitoring = useCallback(() => {
    console.log(`Stopping monitoring on ${ip}:${port}`);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setIsPolling(false);
    remoteAPI.disconnect();
  }, [remoteAPI, ip, port]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (remoteAPI.connected) {
        remoteAPI.disconnect();
      }
    };
  }, [remoteAPI]);

  return {
    stats,
    error: error || remoteAPI.error,
    isConnected: remoteAPI.connected,
    startMonitoring,
    stopMonitoring,
  };
}
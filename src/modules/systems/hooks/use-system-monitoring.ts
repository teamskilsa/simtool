// modules/systems/hooks/use-system-monitoring.ts
import { useState, useEffect, useCallback } from 'react';
import { toast } from "@/components/ui/use-toast";

interface SystemMetrics {
  cpu: {
    usage: number;
    temperature: number;
    cores: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    rx_bytes: number;
    tx_bytes: number;
    connections: number;
  };
  services: {
    lte: {
      status: 'running' | 'stopped' | 'error';
      uptime: number;
      error?: string;
    };
    ssh: {
      status: 'running' | 'stopped';
      connections: number;
    };
  };
}

export function useSystemMonitoring(systemId: string) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<number>(5000);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/systems/${systemId}/metrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      toast({
        title: "Monitoring Error",
        description: "Failed to fetch system metrics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [systemId]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, pollingInterval);
    
    return () => clearInterval(interval);
  }, [fetchMetrics, pollingInterval]);

  const setUpdateInterval = (ms: number) => {
    setPollingInterval(ms);
  };

  return {
    metrics,
    loading,
    error,
    setUpdateInterval,
    refreshMetrics: fetchMetrics
  };
}
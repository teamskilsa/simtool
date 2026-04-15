// modules/systems/hooks/use-system-stats.ts
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../types';

interface SystemStats {
  cpu: {
    usage: number;
    temperature: number;
    cores: Array<{
      model: string;
      speed: number;
      times: any;
    }>;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  uptime: number;
  load: number[];
  platform: string;
  release: string;
}

export function useSystemStats(system: System) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch(`http://${system.ip}:9050/api/stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch system stats');
      }
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [system.ip]);

  return { stats, loading, error, refresh: fetchStats };
}
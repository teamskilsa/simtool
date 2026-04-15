// modules/systems/components/shared/monitoring-stats.tsx
import { useSystemMonitoring } from '../../hooks/use-system-monitoring';
import { Loader2 } from 'lucide-react';

interface MonitoringStatsProps {
  systemId: string;
  themeConfig: any;
}

export function MonitoringStats({ systemId, themeConfig }: MonitoringStatsProps) {
  const { monitoring, loading, error } = useSystemMonitoring(systemId);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        {error}
      </div>
    );
  }

  const stats = monitoring || {
    pullDuration: 0,
    requestCount: 0,
    status: 'inactive' as const
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs text-gray-500">Pull Duration</div>
        <div className="text-sm font-medium">{stats.pullDuration}ms</div>
      </div>
      <div>
        <div className="text-xs text-gray-500">Requests</div>
        <div className="text-sm font-medium">{stats.requestCount}</div>
      </div>
    </div>
  );
}
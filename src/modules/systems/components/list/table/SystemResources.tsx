// modules/systems/components/list/table/SystemResources.tsx
import { Loader2 } from 'lucide-react';
import { formatBytes, formatUptime } from '../../../utils/format';
import type { SystemStats } from '../../../types';

interface SystemResourcesProps {
  stats: SystemStats | null;
  loading: boolean;
  error?: string | null;
}

export function SystemResources({ stats, loading, error }: SystemResourcesProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading stats...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-sm text-muted-foreground">
        Unable to fetch stats
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">CPU</div>
        <div className="text-sm">
          {stats.cpu.usage.toFixed(1)}%
          {stats.cpu.temperature > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({stats.cpu.temperature}°C)
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">Memory</div>
        <div className="text-sm">
          {stats.memory.usage.toFixed(1)}%
          <div className="text-xs text-muted-foreground">
            {formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">Load & Uptime</div>
        <div className="text-sm">
          {stats.load[0].toFixed(2)}
          <div className="text-xs text-muted-foreground">
            {formatUptime(stats.uptime)}
          </div>
        </div>
      </div>
    </div>
  );
}

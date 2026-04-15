// modules/systems/components/shared/stats-display.tsx
import { useSystemStats } from '../../hooks/use-system-stats';
import { Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { System } from '../../types';

interface StatsDisplayProps {
  system: System;
}

export function StatsDisplay({ system }: StatsDisplayProps) {
  const { stats, error, loading } = useSystemStats(system);

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-gray-500">Loading stats...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        Failed to load system stats
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <Tooltip>
        <TooltipTrigger>
          <div className="text-left">
            <div className="text-sm font-medium">CPU</div>
            <div className="text-2xl">{stats.cpu.usage.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">{stats.cpu.temperature}°C</div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div>CPU Temperature: {stats.cpu.temperature}°C</div>
            <div>Load Average: {stats.load.join(', ')}</div>
          </div>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger>
          <div className="text-left">
            <div className="text-sm font-medium">Memory</div>
            <div className="text-2xl">{stats.memory.usage.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">
              {Math.round(stats.memory.used / 1024)} GB / {Math.round(stats.memory.total / 1024)} GB
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div>Total: {Math.round(stats.memory.total / 1024)} GB</div>
            <div>Used: {Math.round(stats.memory.used / 1024)} GB</div>
            <div>Free: {Math.round(stats.memory.free / 1024)} GB</div>
          </div>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger>
          <div className="text-left">
            <div className="text-sm font-medium">Uptime</div>
            <div className="text-lg">
              {formatUptime(Date.now() / 1000 - stats.uptime)}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div>System started: {new Date(stats.uptime * 1000).toLocaleString()}</div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

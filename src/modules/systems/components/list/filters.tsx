// modules/systems/components/list/filters.tsx
import { Search, SlidersHorizontal, Play, Pause, RefreshCw } from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SystemFilters } from '../../types';

interface MonitoringConfig {
  isActive: boolean;
  pullDuration: number;
  refreshInterval: number;
}

const DEFAULT_MONITORING: MonitoringConfig = {
  isActive: false,
  pullDuration: 60,
  refreshInterval: 5
};

interface SystemsFiltersProps {
  filters: SystemFilters;
  setFilters: (filters: SystemFilters) => void;
  monitoring?: Partial<MonitoringConfig>;
  onStartMonitoring: (duration: number, interval: number) => void;
  onStopMonitoring: () => void;
}

export function SystemsFilters({ 
  filters, 
  setFilters, 
  monitoring = DEFAULT_MONITORING,
  onStartMonitoring,
  onStopMonitoring
}: SystemsFiltersProps) {
  const { theme, mode } = useTheme();
  const themeConfig = themes[theme];

  // Ensure monitoring has all required properties
  const monitoringConfig = {
    ...DEFAULT_MONITORING,
    ...monitoring
  };

  const handleDurationChange = (value: string) => {
    const duration = parseInt(value) || DEFAULT_MONITORING.pullDuration;
    setFilters({ 
      ...filters, 
      monitoringConfig: { 
        ...monitoringConfig,
        pullDuration: duration 
      }
    });
  };

  const handleIntervalChange = (value: string) => {
    const interval = parseInt(value) || DEFAULT_MONITORING.refreshInterval;
    setFilters({ 
      ...filters, 
      monitoringConfig: { 
        ...monitoringConfig,
        refreshInterval: interval
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[240px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search systems..."
          value={filters.search || ''}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className={`
            pl-9 pr-4 py-2 w-full 
            rounded-lg
            ${mode === 'light' ? 'bg-white/50' : 'bg-gray-900/50'}
            border-${theme}-200
            focus:border-${theme}-400
            focus:ring-${theme}-400
            focus:ring-2
            focus:ring-offset-0
            placeholder:text-gray-400
          `}
        />
      </div>

      {/* Type Filter */}
      <Select 
        value={filters.type || 'all'}
        onValueChange={(value) => setFilters({ ...filters, type: value })}
      >
        <SelectTrigger className="w-[160px] bg-white/90 dark:bg-gray-800/90">
          <SelectValue placeholder="System Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="Callbox">Callbox</SelectItem>
          <SelectItem value="UESim">UE Simulator</SelectItem>
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={filters.status || 'all'}
        onValueChange={(value) => setFilters({ ...filters, status: value })}
      >
        <SelectTrigger className="w-[160px] bg-white/90 dark:bg-gray-800/90">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="running">Running</SelectItem>
          <SelectItem value="warning">Warning</SelectItem>
          <SelectItem value="stopped">Stopped</SelectItem>
        </SelectContent>
      </Select>

      {/* Monitoring Controls */}
      <div className="flex items-center gap-3 bg-white/90 dark:bg-gray-800/90 p-2 rounded-lg">
        <Input
          type="number"
          placeholder="Duration (s)"
          value={monitoringConfig.pullDuration}
          onChange={(e) => handleDurationChange(e.target.value)}
          className="w-24 bg-white dark:bg-gray-700"
          min={1}
        />
        
        <Input
          type="number"
          placeholder="Interval (s)"
          value={monitoringConfig.refreshInterval}
          onChange={(e) => handleIntervalChange(e.target.value)}
          className="w-24 bg-white dark:bg-gray-700"
          min={1}
        />

        <Button
          variant="outline"
          onClick={() => monitoringConfig.isActive ? 
            onStopMonitoring() : 
            onStartMonitoring(
              monitoringConfig.pullDuration,
              monitoringConfig.refreshInterval
            )
          }
          className={`
            ${monitoringConfig.isActive 
              ? 'bg-red-100 hover:bg-red-200 text-red-700 border-red-200' 
              : 'bg-green-100 hover:bg-green-200 text-green-700 border-green-200'
            }
          `}
        >
          {monitoringConfig.isActive ? (
            <><Pause className="w-4 h-4 mr-2" /> Stop</>
          ) : (
            <><Play className="w-4 h-4 mr-2" /> Monitor</>
          )}
        </Button>

        <Button 
          variant="outline" 
          size="icon" 
          className="bg-white/90 dark:bg-gray-800/90"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>

        <Button 
          variant="outline" 
          size="icon"
          className="bg-white/90 dark:bg-gray-800/90"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
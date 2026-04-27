// modules/systems/components/list/filters.tsx
import { Search, SlidersHorizontal, Play, Pause } from 'lucide-react';
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
  refreshInterval: 5,
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
  onStopMonitoring,
}: SystemsFiltersProps) {
  const monitoringConfig = { ...DEFAULT_MONITORING, ...monitoring };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search systems…"
          value={filters.search ?? ''}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="pl-9 pr-4 py-2 w-full rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-colors text-sm"
        />
      </div>

      {/* Type filter */}
      <Select
        value={filters.type ?? 'all'}
        onValueChange={(v) => setFilters({ ...filters, type: v })}
      >
        <SelectTrigger className="w-[150px] bg-background border-input text-foreground">
          <SelectValue placeholder="System Type" />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="Callbox">Callbox</SelectItem>
          <SelectItem value="UESim">UE Simulator</SelectItem>
          <SelectItem value="MME">MME</SelectItem>
          <SelectItem value="SPGW">SPGW</SelectItem>
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={filters.status ?? 'all'}
        onValueChange={(v) => setFilters({ ...filters, status: v })}
      >
        <SelectTrigger className="w-[140px] bg-background border-input text-foreground">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="running">Running</SelectItem>
          <SelectItem value="warning">Warning</SelectItem>
          <SelectItem value="stopped">Stopped</SelectItem>
        </SelectContent>
      </Select>

      {/* Monitoring controls */}
      <div className="flex items-center gap-2 bg-muted/50 border border-border px-3 py-1.5 rounded-lg">
        <Input
          type="number"
          placeholder="Duration (s)"
          value={monitoringConfig.pullDuration}
          onChange={(e) => setFilters({
            ...filters,
            monitoringConfig: { ...monitoringConfig, pullDuration: parseInt(e.target.value) || 60 },
          })}
          className="w-24 h-7 text-sm bg-background border-input"
          min={1}
        />
        <Input
          type="number"
          placeholder="Interval (s)"
          value={monitoringConfig.refreshInterval}
          onChange={(e) => setFilters({
            ...filters,
            monitoringConfig: { ...monitoringConfig, refreshInterval: parseInt(e.target.value) || 5 },
          })}
          className="w-24 h-7 text-sm bg-background border-input"
          min={1}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            monitoringConfig.isActive
              ? onStopMonitoring()
              : onStartMonitoring(monitoringConfig.pullDuration, monitoringConfig.refreshInterval)
          }
          className={
            monitoringConfig.isActive
              ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
              : 'border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-500/10'
          }
        >
          {monitoringConfig.isActive ? (
            <><Pause className="w-3.5 h-3.5 mr-1.5" /> Stop</>
          ) : (
            <><Play className="w-3.5 h-3.5 mr-1.5" /> Monitor</>
          )}
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7 bg-background border-input">
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

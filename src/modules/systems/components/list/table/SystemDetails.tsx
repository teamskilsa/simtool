// modules/systems/components/list/table/SystemDetails.tsx
import { Cpu, HardDrive } from 'lucide-react';
import type { SystemStats } from '../../../types';

interface SystemDetailsProps {
  stats: SystemStats | null;
  loading: boolean;
}

export function SystemDetails({ stats, loading }: SystemDetailsProps) {
  if (loading || !stats) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Cpu className="w-4 h-4" />
          <span>{stats.cpu.cores.length} Cores</span>
          <span className="text-xs">({stats.cpu.cores[0].model})</span>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <HardDrive className="w-4 h-4" />
          <span>{stats.platform} ({stats.release})</span>
        </div>
      </div>
    </div>
  );
}

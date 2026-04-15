// modules/systems/components/shared/resource-usage.tsx
import { Loader2 } from 'lucide-react';

interface ResourceUsageProps {
  cpu?: number;
  memory?: number;
  systemId?: string;
}

export function ResourceUsage({ cpu = 0, memory = 0, systemId }: ResourceUsageProps) {
  return (
    <div className="flex items-center gap-4">
      <div>
        <div className="text-xs text-gray-500">CPU</div>
        <div className="text-sm font-medium">{cpu}%</div>
      </div>
      <div>
        <div className="text-xs text-gray-500">Memory</div>
        <div className="text-sm font-medium">{memory}%</div>
      </div>
    </div>
  );
}
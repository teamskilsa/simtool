// components/ScenarioCreator/TopologySelector.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network } from 'lucide-react';
import { TOPOLOGY_OPTIONS } from './constants';
import { cn } from '@/lib/utils';

interface TopologySelectorProps {
  selected?: string;
  onSelect: (topologyId: string) => void;
}

export function TopologySelector({ selected, onSelect }: TopologySelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-6 mt-6">
      {TOPOLOGY_OPTIONS.map((topology) => (
        <Card
          key={topology.id}
          className={cn(
            "p-4 cursor-pointer transition-all hover:shadow-md",
            selected === topology.id && "ring-2 ring-primary",
            "hover:scale-[1.02] active:scale-[0.98]"
          )}
          onClick={() => onSelect(topology.id)}
        >
          <div className="flex items-center gap-2 mb-3">
            <Network className="w-4 h-4" />
            <h3 className="font-medium">{topology.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {topology.description}
          </p>
          <div className="flex flex-wrap gap-1">
            {topology.modules.map(module => (
              <Badge 
                key={module} 
                variant={topology.optional?.includes(module) ? "outline" : "secondary"}
              >
                {module}
              </Badge>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
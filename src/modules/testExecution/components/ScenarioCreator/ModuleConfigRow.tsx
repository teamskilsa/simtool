// components/ScenarioCreator/ModuleConfigRow.tsx
import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModuleConfig } from './types';
import { cn } from "@/lib/utils";

interface ModuleConfigRowProps {
  module: string;
  config?: ModuleConfig;
  configs: Record<string, any[]>;
  onUpdate: (updates: Partial<ModuleConfig>) => void;
}

export function ModuleConfigRow({
  module,
  config,
  configs,
  onUpdate
}: ModuleConfigRowProps) {
  const defaultConfig: ModuleConfig = {
    moduleId: module,
    enabled: true,
    configId: '',
    ipAddress: '',
    isCustomIp: false,
    systemId: undefined
  };

  const currentConfig = config || defaultConfig;

  return (
    <div className={cn(
      "grid grid-cols-[auto_1fr_1fr] gap-4 p-6 rounded-lg",
      "bg-gradient-to-br from-background/40 to-muted/20",
      "border border-muted/20",
      "transition-all duration-200",
      "hover:shadow-md hover:border-muted/30"
    )}>
      <div className="flex items-center gap-2">
        <Checkbox 
          id={`${module}-enabled`}
          checked={currentConfig.enabled} 
          onCheckedChange={(checked) => onUpdate({ enabled: !!checked })}
          className="border-muted/50"
        />
        <Label 
          htmlFor={`${module}-enabled`}
          className="font-medium capitalize text-foreground/90"
        >
          {module}
        </Label>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground/90">IP Configuration</Label>
        <Input
          value={currentConfig.ipAddress}
          onChange={(e) => onUpdate({ ipAddress: e.target.value })}
          placeholder="Enter IP address"
          className="bg-background/50 border-muted/30"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground/90">Configuration</Label>
        <Select
          value={currentConfig.configId}
          onValueChange={(value) => onUpdate({ configId: value })}
        >
          <SelectTrigger className="bg-background/50 border-muted/30">
            <SelectValue placeholder={`Select ${module} config`} />
          </SelectTrigger>
          <SelectContent>
            {configs[module]?.map(config => (
              <SelectItem key={config.id} value={config.id}>
                {config.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
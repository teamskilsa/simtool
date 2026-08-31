// components/ScenarioCreator/ModuleConfigRow.tsx
import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModuleConfig } from './types';
import { cn } from "@/lib/utils";

/** Shared column template so the header and every row line up exactly.
 *  A fixed first column is essential — sizing it to `auto` made each row's
 *  inputs start at a different x depending on the module name length. */
export const MODULE_GRID =
  'grid grid-cols-1 sm:grid-cols-[minmax(150px,180px)_minmax(0,1fr)_minmax(0,1.3fr)] gap-3 sm:gap-4';

const MODULE_LABELS: Record<string, string> = {
  enb: 'eNB / gNB',
  mme: 'MME (core 1)',
  mme2: 'MME2 (core 2)',
  ims: 'IMS',
  ue_db: 'UE database',
  ue: 'UE',
  core: 'Core',
};

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

  // Merge (not ||): a partially-built row ({configId} only, from the first
  // dropdown pick) must still default enabled=true — `config || default`
  // made the checkbox visually untick as soon as a config was chosen.
  const currentConfig = { ...defaultConfig, ...config };
  const disabled = !currentConfig.enabled;
  // mme2 = second instance of the mme daemon — same config bucket
  const options = configs[module === 'mme2' ? 'mme' : module] ?? [];

  return (
    <div
      className={cn(
        MODULE_GRID,
        'items-center px-4 py-3 border-b border-border/60 last:border-0 transition-colors',
        disabled ? 'opacity-60' : 'hover:bg-muted/40',
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Checkbox
          id={`${module}-enabled`}
          checked={currentConfig.enabled}
          onCheckedChange={(checked) => onUpdate({ enabled: !!checked })}
        />
        <label
          htmlFor={`${module}-enabled`}
          className="text-sm font-medium text-foreground truncate cursor-pointer"
        >
          {MODULE_LABELS[module] ?? module}
        </label>
      </div>

      {/* Column labels live in the header row, not repeated per module —
          sm:sr-only keeps them for screen readers and for the stacked
          mobile layout where the header row is hidden. */}
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground sm:sr-only">IP address</span>
        <Input
          value={currentConfig.ipAddress}
          onChange={(e) => onUpdate({ ipAddress: e.target.value })}
          placeholder="Inherit from system"
          disabled={disabled}
          className="h-9 font-mono text-sm"
          aria-label={`${module} IP address`}
        />
      </div>

      <div className="min-w-0">
        <span className="text-xs text-muted-foreground sm:sr-only">Configuration</span>
        <Select
          value={currentConfig.configId}
          onValueChange={(value) => onUpdate({ configId: value })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9" aria-label={`${module} configuration`}>
            <SelectValue placeholder={options.length ? 'Select config' : 'No configs available'} />
          </SelectTrigger>
          <SelectContent>
            {options.map(config => (
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

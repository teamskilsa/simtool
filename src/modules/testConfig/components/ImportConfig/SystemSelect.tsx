// src/modules/testConfig/components/ImportConfig/SystemSelect.tsx
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server } from 'lucide-react';

interface SystemSelectProps {
  value: string;
  onChange: (value: string) => void;
  systems: Array<{ id: string; name: string; host: string; }>;
}

export const SystemSelect: React.FC<SystemSelectProps> = ({
  value,
  onChange,
  systems
}) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select System</label>
      <Select
        value={value}
        onValueChange={onChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choose a system..." />
        </SelectTrigger>
        <SelectContent>
          {systems.map((system) => (
            <SelectItem key={system.id} value={system.id}>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                <div className="flex flex-col">
                  <span>{system.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {system.host}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

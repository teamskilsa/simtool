// src/modules/testConfig/components/ImportConfig/ModuleSelect.tsx
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen } from 'lucide-react';
import { ModuleType } from '../../types';
import { MODULE_PATHS } from '../../utils/constants';

interface ModuleSelectProps {
  value: ModuleType | '';
  onChange: (value: ModuleType) => void;
  disabled?: boolean;
}

export const ModuleSelect: React.FC<ModuleSelectProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select Module</label>
      <Select
        value={value}
        onValueChange={(value) => onChange(value as ModuleType)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choose a module..." />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(MODULE_PATHS).map(([module, path]) => (
            <SelectItem key={module} value={module}>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                <span className="capitalize">{module}</span>
                <span className="text-xs text-muted-foreground">
                  ({path})
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

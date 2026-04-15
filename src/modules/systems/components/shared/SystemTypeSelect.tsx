// modules/systems/components/shared/SystemTypeSelect.tsx
import { Radio, Smartphone } from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { SystemType } from '../../types';

interface SystemTypeSelectProps {
  value: SystemType | '';
  onChange: (value: SystemType) => void;
}

export function SystemTypeSelect({ value, onChange }: SystemTypeSelectProps) {
  const { mode } = useTheme();

  const selectClass = `
    ${mode === 'light' 
      ? 'bg-white border-slate-200 focus:bg-white/95 hover:bg-slate-50' 
      : 'bg-slate-800 border-slate-700 focus:bg-slate-800/95 hover:bg-slate-700'
    }
    transition-colors
    focus:ring-2
    focus:ring-indigo-500/20
    focus:border-indigo-500/30
  `;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
        System Type
      </Label>
      <Select
        value={value}
        onValueChange={onChange}
      >
        <SelectTrigger className={selectClass}>
          <SelectValue placeholder="Select system type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Callbox">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4" />
              <span>Callbox</span>
            </div>
          </SelectItem>
          <SelectItem value="UESim">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              <span>UE Simulator</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

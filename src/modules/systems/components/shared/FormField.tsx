// modules/systems/components/shared/FormField.tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from '@/components/theme/context/theme-context';
import type { LucideIcon } from 'lucide-react';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
  icon?: LucideIcon;
  autoComplete?: string;
}

export function FormField({ 
  label, 
  value, 
  onChange, 
  placeholder,
  type = 'text',
  icon: Icon,
  autoComplete
}: FormFieldProps) {
  const { mode } = useTheme();

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-900 dark:text-slate-200">
        {label}
      </Label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`
            ${Icon ? 'pl-9' : 'pl-3'}
            ${mode === 'light' 
              ? 'bg-white border-slate-200 hover:bg-slate-50/50' 
              : 'bg-slate-800/75 border-slate-700 hover:bg-slate-800'
            }
            transition-colors
            focus:ring-2
            focus:ring-indigo-500/20
            focus:border-indigo-500/30
          `}
        />
      </div>
    </div>
  );
}
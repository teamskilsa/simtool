// modules/systems/components/shared/FormField.tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LucideIcon } from 'lucide-react';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'number';
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
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
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
            ${Icon ? 'pl-9' : ''}
            bg-background border-input text-foreground placeholder:text-muted-foreground
            hover:border-ring/50
            focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring/50
            transition-colors
          `}
        />
      </div>
    </div>
  );
}

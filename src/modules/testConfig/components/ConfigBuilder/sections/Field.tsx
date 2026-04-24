// Compact form field for config builder sections
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface FieldProps {
  label: string;
  value: any;
  onChange: (value: any) => void;
  type?: 'text' | 'number' | 'select' | 'checkbox';
  options?: { value: any; label: string }[];
  min?: number;
  max?: number;
  step?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function Field({ label, value, onChange, type = 'text', options, min, max, step, disabled, placeholder }: FieldProps) {
  if (type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox checked={Boolean(value)} onCheckedChange={onChange} disabled={disabled} />
        <span className="text-sm">{label}</span>
      </label>
    );
  }

  if (type === 'select' && options) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Select value={String(value)} onValueChange={v => onChange(options.find(o => String(o.value) === v)?.value ?? v)} disabled={disabled}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map(o => <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="h-8 text-sm"
        type={type}
        value={value ?? ''}
        onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}

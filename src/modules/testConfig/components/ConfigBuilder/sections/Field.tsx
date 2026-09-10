// Compact form field for config builder sections.
//
// Number inputs now actively validate against the [min, max] range and
// surface a red border + a one-line error message inline when the user
// types something out of range. Plain HTML5 `min`/`max` are hints —
// React-controlled inputs don't block typing — so without this layer a
// user could type cell_id=500 with max=255, save it, deploy, and only
// learn from Amarisoft ("field 'cell_id': range is [0:255]") that the
// value was bad.
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import React from 'react';

/** Shared label cell for inline mode — fixed width so every control in a
 *  row starts at the same x regardless of label length. */
function InlineLabel({ label, required, hint }: { label: string; required?: boolean; hint?: React.ReactNode }) {
  return (
    <Label className="text-xs text-muted-foreground w-[116px] shrink-0 leading-tight flex items-center gap-1">
      <span>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      {hint}
    </Label>
  );
}

interface FieldProps {
  label: string;
  /** Label sits to the LEFT of the control. This is what the Simnovator UI
   *  does and it roughly halves the height of a row, which is the single
   *  biggest density win — stacked labels doubled the vertical cost of every
   *  field. It is the DEFAULT; pass `inline={false}` for the stacked form,
   *  which only suits a full-width control that needs the horizontal room. */
  inline?: boolean;
  /** Marks the field required, shown as the same red asterisk Simnovator uses. */
  required?: boolean;
  /** Extra content rendered next to the label (e.g. an InfoHint icon). */
  hint?: React.ReactNode;
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

/**
 * Out-of-range check. Returns null when valid, a short message when not.
 * Empty / NaN values are treated as valid here so an in-progress edit
 * (user has just blanked the field to retype) doesn't flash red.
 */
function rangeError(value: any, min?: number, max?: number): string | null {
  if (min === undefined && max === undefined) return null;
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  if (min !== undefined && n < min) return `must be ≥ ${min}`;
  if (max !== undefined && n > max) return `must be ≤ ${max}`;
  return null;
}

export function Field({ label, value, onChange, type = 'text', options, min, max, step, disabled, placeholder, inline = true, required, hint }: FieldProps) {
  if (type === 'checkbox') {
    return (
      // The hint icon sits outside the <label> so clicking it opens the
      // tooltip instead of toggling the box.
      <div className="flex items-center gap-1.5 h-8">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={Boolean(value)} onCheckedChange={onChange} disabled={disabled} />
          <span className="text-xs text-muted-foreground leading-tight">{label}</span>
        </label>
        {hint}
      </div>
    );
  }

  if (type === 'select' && options) {
    if (inline) {
      return (
        <div className="flex items-center gap-2">
          <InlineLabel label={label} required={required} hint={hint} />
          <Select
            value={String(value)}
            onValueChange={v => onChange(options.find(o => String(o.value) === v)?.value ?? v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-sm flex-1 min-w-0"><SelectValue /></SelectTrigger>
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
        <Select value={String(value)} onValueChange={v => onChange(options.find(o => String(o.value) === v)?.value ?? v)} disabled={disabled}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map(o => <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const err = type === 'number' ? rangeError(value, min, max) : null;
  const showRangeHint = type === 'number' && (min !== undefined || max !== undefined) && !err;
  const rangeHint = (() => {
    if (min !== undefined && max !== undefined) return `${min}–${max}`;
    if (min !== undefined) return `≥ ${min}`;
    if (max !== undefined) return `≤ ${max}`;
    return null;
  })();

  if (inline) {
    return (
      <div className="flex items-center gap-2">
        <InlineLabel label={label} required={required} hint={hint} />
        <div className="flex-1 min-w-0">
          <Input
            className={cn('h-8 text-sm', err && 'border-destructive focus-visible:ring-destructive/40')}
            type={type}
            value={value ?? ''}
            onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            min={min} max={max} step={step} disabled={disabled}
            placeholder={placeholder ?? (showRangeHint && rangeHint ? rangeHint : undefined)}
            aria-invalid={!!err}
            title={err ? `${label}: ${err}` : undefined}
          />
          {err && <p className="text-[11px] text-destructive mt-0.5">{err}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {showRangeHint && rangeHint && (
          <span className="text-[10px] text-muted-foreground/70 font-mono">{rangeHint}</span>
        )}
      </div>
      <Input
        className={cn(
          'h-8 text-sm',
          err && 'border-destructive focus-visible:ring-destructive/40',
        )}
        type={type}
        value={value ?? ''}
        onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={!!err}
      />
      {err && (
        <p className="text-[11px] text-destructive">
          {label}: {err}
          {min !== undefined && max !== undefined && ` (range ${min}–${max})`}
        </p>
      )}
    </div>
  );
}

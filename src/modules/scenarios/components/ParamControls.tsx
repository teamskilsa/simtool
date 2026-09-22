// Scenario parameters as labelled controls instead of an invisible JSON blob.
//
// Numbers get a number input with its unit, booleans a switch, and a list of
// 0-based cell indexes (params.pair) gets one picker per entry showing the
// cells actually running on the callbox — "Cell 4 — n78 3580 MHz". The raw
// JSON stays one click away under "Advanced" for anything unusual.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Braces, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CellInfo, MobilityScenario } from '../types';
import { cellLabel, cellRadioLabel, paramSpecs, type ParamSpec } from '../lib/cellLabel';

export interface ParamControlsProps {
  scenario: MobilityScenario | null;
  cells: CellInfo[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}

/** ms shown as seconds once it gets long enough to be awkward in ms. */
const msHint = (ms: unknown) => {
  const n = Number(ms);
  return Number.isFinite(n) && n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} s` : '';
};

function CellPicker({ value, cells, onChange, disabled }: {
  value: number; cells: CellInfo[]; onChange: (v: number) => void; disabled?: boolean;
}) {
  if (!cells.length) {
    return (
      <Input
        className="num h-8 text-xs"
        type="number"
        min={0}
        value={String(value)}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        title="Cell index (0-based) — connect to the callbox to pick by name"
      />
    );
  }
  return (
    <Select value={String(value)} onValueChange={v => onChange(Number(v))} disabled={disabled}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a cell" /></SelectTrigger>
      <SelectContent>
        {cells.map((c, i) => (
          <SelectItem key={c.id} value={String(i)} description={`index ${i} · PCI ${c.pci}${c.scells.length ? ` · aggregates ${c.scells.join(', ')}` : ''}`}>
            {cellLabel(c)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ParamField({ spec, value, cells, onChange, disabled }: {
  spec: ParamSpec; value: unknown; cells: CellInfo[]; onChange: (v: unknown) => void; disabled?: boolean;
}) {
  const label = (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs font-medium">{spec.label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{spec.key}</span>
    </span>
  );

  if (spec.kind === 'boolean') {
    return (
      <div className="space-y-1">
        {label}
        <div className="flex h-8 items-center gap-2">
          <Switch checked={!!value} onCheckedChange={v => onChange(v)} disabled={disabled} />
          <span className="text-xs text-muted-foreground">{value ? 'on' : 'off'}</span>
        </div>
        {spec.help && <p className="text-[11px] leading-snug text-muted-foreground">{spec.help}</p>}
      </div>
    );
  }

  if (spec.kind === 'cellIndexList') {
    const list = Array.isArray(value) ? (value as number[]) : [];
    return (
      <div className="space-y-1 sm:col-span-2">
        {label}
        <div className={cn('grid gap-1', list.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {list.map((v, i) => (
            <CellPicker
              key={i}
              value={v}
              cells={cells}
              disabled={disabled}
              onChange={n => onChange(list.map((x, j) => (j === i ? n : x)))}
            />
          ))}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {spec.help ?? 'Cells the scenario works with, as 0-based indexes into the running config.'}
          {cells.length > 0 && list.length > 0 && (
            <> Now: {list.map(i => (cells[i] ? `cell ${cells[i].id} (${cellRadioLabel(cells[i])})` : `index ${i} — no such cell`)).join(' ↔ ')}.</>
          )}
        </p>
      </div>
    );
  }

  const unitHint = spec.kind === 'ms' ? msHint(value) : '';
  return (
    <div className="space-y-1">
      {label}
      <div className="relative">
        <Input
          className="num h-8 pr-10 text-xs"
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          disabled={disabled}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        {spec.unit && <span className="pointer-events-none absolute right-2 top-1.5 text-[11px] text-muted-foreground">{spec.unit}</span>}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {spec.help}{spec.help && unitHint ? ' ' : ''}{unitHint && <span className="num">= {unitHint}</span>}
      </p>
    </div>
  );
}

export function ParamControls({ scenario, cells, values, onChange, disabled }: ParamControlsProps) {
  const [advanced, setAdvanced] = useState(false);
  const [draft, setDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const specs = useMemo(() => paramSpecs(scenario, cells.length), [scenario, cells.length]);

  // The textarea only re-syncs when it is opened or the scenario changes, so
  // typing in it is not fought by the controls above.
  useEffect(() => { setDraft(JSON.stringify(values, null, 2)); setJsonError(null); }, [advanced, scenario?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!scenario || specs.length === 0) {
    return <p className="text-xs text-muted-foreground">This scenario has no parameters.</p>;
  }

  const reset = () => onChange({ ...(scenario.params ?? {}) });
  const dirty = JSON.stringify(values) !== JSON.stringify(scenario.params ?? {});

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Kicker>Parameters</Kicker>
        <span className="text-[11px] text-muted-foreground">What the run will do — change anything before starting.</span>
        <div className="ml-auto flex items-center gap-1">
          {dirty && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={reset} disabled={disabled}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />Defaults
            </Button>
          )}
          <Button size="sm" variant={advanced ? 'secondary' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setAdvanced(a => !a)}>
            <Braces className="mr-1 h-3.5 w-3.5" />Advanced
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        {specs.map(spec => (
          <ParamField
            key={spec.key}
            spec={spec}
            cells={cells}
            value={values[spec.key]}
            disabled={disabled}
            onChange={v => onChange({ ...values, [spec.key]: v })}
          />
        ))}
      </div>

      {advanced && (
        <div className="space-y-1 rounded border border-border p-2">
          <Kicker>Raw JSON</Kicker>
          <Textarea
            className="min-h-[120px] font-mono text-[11px]"
            value={draft}
            disabled={disabled}
            onChange={e => {
              setDraft(e.target.value);
              try {
                const parsed = JSON.parse(e.target.value);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) { setJsonError(null); onChange(parsed); }
                else setJsonError('Parameters must be a JSON object');
              } catch (err: any) { setJsonError(err.message); }
            }}
          />
          {jsonError && <p className="text-[11px] text-destructive">{jsonError}</p>}
        </div>
      )}
    </div>
  );
}

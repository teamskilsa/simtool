// Cell "Essentials" — identity + band + carrier in ONE dense pane.
//
// Replaces the separate Identity and Band & Frequency BoxedSections. Those
// put two bordered boxes inside the tab pane (itself inside a card), and
// laid out at md:grid-cols-3, so a 1456px screen showed three fields per
// row with ~350px of width given to a field holding "500".
//
// This follows the UE Simulator idiom used elsewhere in the app: a single
// Card, a compact py-3 header, and a `grid-cols-2 sm:grid-cols-4` body.
// Eight fields land in two rows instead of four, with no nested boxes.
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioTower } from 'lucide-react';
import { Field } from './Field';
import { SectionToolbar } from './SectionToolbar';
import { InfoHint } from '../InfoHint';
import { NR_BANDS, getBandSpec, BANDWIDTH_OPTIONS, SCS_OPTIONS } from '../constants';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

/** Band-derived value: shown, not asked for. Matches input height so it
 *  sits on the same baseline as the real fields in the grid. */
function Derived({ label, value, from }: { label: string; value: string; from: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs flex items-center gap-1">
        {label}
        <InfoHint>Set by {from}. Change the band to change it.</InfoHint>
      </Label>
      <div className="h-10 flex items-center px-3 rounded-md border border-dashed border-border bg-muted/40">
        <span className="text-sm text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

export function CellEssentials({ form, onChange }: Props) {
  const spec = getBandSpec(form.band);
  const isFR2 = (spec?.fr ?? form.fr2) === 1;
  const bwOpts = isFR2 ? BANDWIDTH_OPTIONS.FR2 : BANDWIDTH_OPTIONS.FR1;
  const scsOpts = spec
    ? SCS_OPTIONS.filter(o => spec.scs.includes(o.value as number))
    : SCS_OPTIONS;

  const bandLabel = spec ? `band ${spec.label.split(' ')[0]}` : 'the band';
  const ssbOn = form.ssbArfcn !== null && form.ssbArfcn !== undefined;

  const handleBandChange = (band: number) => {
    const next = getBandSpec(band);
    onChange('band', band);
    if (!next) return;
    onChange('fr2', next.fr);
    onChange('nrTdd', next.duplex);
    onChange('dlNrArfcn', next.defaultArfcn);
    const bwList = next.fr === 1 ? BANDWIDTH_OPTIONS.FR2 : BANDWIDTH_OPTIONS.FR1;
    if (!bwList.some(o => o.value === form.nrBandwidth)) {
      onChange('nrBandwidth', next.fr === 1 ? 100 : 20);
    }
    if (!next.scs.includes(form.subcarrierSpacing)) {
      onChange('subcarrierSpacing', next.scs[0]);
    }
  };

  const handleLoad = (data: any) => {
    Object.entries(data).forEach(([k, v]) => onChange(k, v));
  };

  const currentCell = {
    cellId: form.cellId, band: form.band, nrBandwidth: form.nrBandwidth,
    subcarrierSpacing: form.subcarrierSpacing, dlNrArfcn: form.dlNrArfcn,
    nrTdd: form.nrTdd, fr2: form.fr2, ssbArfcn: form.ssbArfcn,
  };

  return (
    <Card>
      <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <RadioTower className="h-4 w-4" /> Cell
          <InfoHint>
            Duplex mode and frequency range follow the band — n78 is FR1 TDD.
            Bandwidth and subcarrier spacing are limited to what the band supports.
          </InfoHint>
        </CardTitle>
        <SectionToolbar type="cell" currentData={currentCell} onLoad={handleLoad} />
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Cell ID" value={form.cellId} onChange={v => onChange('cellId', v)}
            type="number" min={0} max={1007} />

          <div className="space-y-1">
            <Label className="text-xs">Band</Label>
            <Select value={String(form.band)} onValueChange={v => handleBandChange(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Select band" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>FR1 — sub-6 GHz</SelectLabel>
                  {NR_BANDS.filter(b => b.fr === 0).map(b => (
                    <SelectItem key={b.value} value={String(b.value)}
                      description={b.duplex === 1 ? 'TDD' : 'FDD'}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>FR2 — mmWave</SelectLabel>
                  {NR_BANDS.filter(b => b.fr === 1).map(b => (
                    <SelectItem key={b.value} value={String(b.value)} description="TDD">
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Derived label="Mode" value={form.nrTdd === 1 ? 'TDD' : 'FDD'} from={bandLabel} />
          <Derived
            label="Frequency Range"
            value={form.fr2 === 1 ? 'FR2 (mmWave)' : 'FR1 (sub-6)'}
            from={bandLabel}
          />

          <Field label="Bandwidth (MHz)" value={form.nrBandwidth}
            onChange={v => onChange('nrBandwidth', v)} type="select" options={bwOpts} />
          <Field label="Subcarrier Spacing" value={form.subcarrierSpacing}
            onChange={v => onChange('subcarrierSpacing', v)} type="select" options={scsOpts} />
          <Field label="DL NR-ARFCN" value={form.dlNrArfcn}
            onChange={v => onChange('dlNrArfcn', v)} type="number" min={0} max={3279165} />

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <Label className="text-xs flex items-center gap-1">
                SSB ARFCN
                <InfoHint>
                  Off → omitted, and Amarisoft derives the SSB position from
                  band + DL ARFCN. On → emits{' '}
                  <code className="font-mono">gscn</code> in{' '}
                  <code className="font-mono">nr_cell_list[]</code>.
                </InfoHint>
              </Label>
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer shrink-0">
                <Checkbox
                  checked={ssbOn}
                  onCheckedChange={v => onChange('ssbArfcn', v === true ? 0 : null)}
                />
                Set
              </label>
            </div>
            <Input
              type="number" min={0} max={26639}
              placeholder={ssbOn ? 'GSCN' : 'auto'}
              disabled={!ssbOn}
              value={ssbOn ? (form.ssbArfcn as number) : ''}
              onChange={e => {
                const raw = e.target.value.trim();
                onChange('ssbArfcn', raw === '' ? 0 : Number(raw));
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

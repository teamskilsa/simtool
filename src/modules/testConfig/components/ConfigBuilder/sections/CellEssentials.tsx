// Cell "Essentials", laid out the way the Simnovator 4.0 UI does it.
//
// The density there comes from three things, none of which this builder was
// doing:
//   1. The label sits BESIDE the control, not above it. That alone halves
//      the height of every row.
//   2. Groups are separated by a thin rule, not wrapped in a bordered card.
//      No boxes inside boxes.
//   3. Only a genuinely coupled pair gets its own small bordered block
//      (Simnovator does this for "Antenna Configuration" and nothing else).
//
// Eight fields that previously filled four rows of three now fit two rows
// of four, at roughly half the row height.
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Field } from './Field';
import { SectionToolbar } from './SectionToolbar';
import { InfoHint } from '../InfoHint';
import { BoxedSection, FIELD_GRID } from '../BoxedSection';
import { NR_BANDS, getBandSpec, BANDWIDTH_OPTIONS, SCS_OPTIONS } from '../constants';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

/** Band-derived value: displayed, not asked for. Same inline shape and
 *  height as a real field so the grid stays on one baseline. */
function Derived({ label, value, from }: { label: string; value: string; from: string }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground w-[116px] shrink-0 leading-tight flex items-center gap-1">
        {label}
        <InfoHint>Set by {from}. Change the band to change it.</InfoHint>
      </Label>
      <div className="h-8 flex-1 min-w-0 flex items-center px-3 rounded-md border border-dashed border-border bg-muted/40">
        <span className="text-sm text-muted-foreground truncate">{value}</span>
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
    cellId: form.cellId, pci: form.pci, band: form.band, nrBandwidth: form.nrBandwidth,
    subcarrierSpacing: form.subcarrierSpacing, dlNrArfcn: form.dlNrArfcn,
    nrTdd: form.nrTdd, fr2: form.fr2, ssbArfcn: form.ssbArfcn,
  };

  return (
    <BoxedSection
      title="Cell"
      hint="Duplex mode and frequency range follow the band — n78 is FR1 TDD. Bandwidth and subcarrier spacing are limited to what the band allows."
      action={<SectionToolbar type="cell" currentData={currentCell} onLoad={handleLoad} />}
    >
      <div className={FIELD_GRID}>
        <Field
          label="Cell ID" required inline
          hint={<InfoHint>Amarisoft cell_id — the gNB's identifier for this cell. Distinct from PCI.</InfoHint>}
          value={form.cellId} onChange={v => onChange('cellId', v)}
          type="number" min={0} max={65535}
        />

        <Field
          label="PCI" required inline
          hint={<InfoHint>Physical Cell ID (n_id_cell), 0–1007. Must be distinct per cell in a multi-cell gNB, or UEs cannot tell the cells apart.</InfoHint>}
          value={form.pci} onChange={v => onChange('pci', v)}
          type="number" min={0} max={1007}
        />

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-[116px] shrink-0 leading-tight">
            Band<span className="text-destructive ml-0.5">*</span>
          </Label>
          <Select value={String(form.band)} onValueChange={v => handleBandChange(Number(v))}>
            <SelectTrigger className="h-8 text-sm flex-1 min-w-0">
              <SelectValue placeholder="Select band" />
            </SelectTrigger>
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

        <Derived label="Duplex Mode" value={form.nrTdd === 1 ? 'TDD' : 'FDD'} from={bandLabel} />
        <Derived
          label="Freq. Range"
          value={form.fr2 === 1 ? 'FR2 (mmWave)' : 'FR1 (sub-6)'}
          from={bandLabel}
        />

        <Field
          label="Bandwidth" required inline
          value={form.nrBandwidth} onChange={v => onChange('nrBandwidth', v)}
          type="select" options={bwOpts}
        />
        <Field
          label="Subcarrier Sp." required inline
          value={form.subcarrierSpacing} onChange={v => onChange('subcarrierSpacing', v)}
          type="select" options={scsOpts}
        />
        <Field
          label="DL NR-ARFCN" required inline
          value={form.dlNrArfcn} onChange={v => onChange('dlNrArfcn', v)}
          type="number" min={0} max={3279165}
        />

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-[116px] shrink-0 leading-tight flex items-center gap-1">
            SSB ARFCN
            <InfoHint>
              Off → omitted, and Amarisoft derives the SSB position from band +
              DL ARFCN. On → emits <code className="font-mono">gscn</code> in{' '}
              <code className="font-mono">nr_cell_list[]</code>.
            </InfoHint>
          </Label>
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <Input
              type="number" min={0} max={26639}
              className="h-8 text-sm flex-1 min-w-0"
              placeholder={ssbOn ? 'GSCN' : 'auto'}
              disabled={!ssbOn}
              value={ssbOn ? (form.ssbArfcn as number) : ''}
              onChange={e => {
                const raw = e.target.value.trim();
                onChange('ssbArfcn', raw === '' ? 0 : Number(raw));
              }}
            />
            <Checkbox
              checked={ssbOn}
              onCheckedChange={v => onChange('ssbArfcn', v === true ? 0 : null)}
              title="Override the auto-derived SSB position"
            />
          </div>
        </div>
      </div>
    </BoxedSection>
  );
}

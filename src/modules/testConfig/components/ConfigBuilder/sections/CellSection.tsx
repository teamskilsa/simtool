// NR Cell — identity + (conditional) TDD pattern. SSB Configuration moved
// to Layers/SSB; Band, Antenna, RF, Channel Sim render alongside in the
// merged Cell tab.
import { Field } from './Field';
import { SectionToolbar } from './SectionToolbar';
import { BoxedSection } from '../BoxedSection';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function CellSection({ form, onChange }: Props) {
  const currentCell = {
    cellId: form.cellId, nrTdd: form.nrTdd, fr2: form.fr2,
    band: form.band, nrBandwidth: form.nrBandwidth, subcarrierSpacing: form.subcarrierSpacing,
    dlNrArfcn: form.dlNrArfcn, ssbPosBitmap: form.ssbPosBitmap, tddPattern: form.tddPattern,
  };
  const handleLoad = (data: any, _name?: string) => {
    Object.entries(data).forEach(([k, v]) => onChange(k, v));
  };

  return (
    <div className="space-y-4">
      <SectionToolbar type="cell" currentData={currentCell} onLoad={handleLoad} />

      <BoxedSection title="Identity" subtitle="Cell ID + duplex mode + frequency range">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Cell ID" value={form.cellId} onChange={v => onChange('cellId', v)} type="number" min={0} max={1007} />
          <Field label="Mode" value={form.nrTdd} onChange={v => onChange('nrTdd', v)} type="select"
            options={[{ value: 0, label: 'FDD' }, { value: 1, label: 'TDD' }]} />
          <Field label="Frequency Range" value={form.fr2} onChange={v => onChange('fr2', v)} type="select"
            options={[{ value: 0, label: 'FR1 (sub-6)' }, { value: 1, label: 'FR2 (mmWave)' }]} />
        </div>
      </BoxedSection>

      {form.nrTdd === 1 && (
        <BoxedSection title="TDD Pattern" subtitle="DL/UL slot and symbol configuration">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Field label="Period (ms)" value={form.tddPattern.period} onChange={v => onChange('tddPattern', { ...form.tddPattern, period: v })} type="number" step="0.125" />
            <Field label="DL Slots" value={form.tddPattern.dlSlots} onChange={v => onChange('tddPattern', { ...form.tddPattern, dlSlots: v })} type="number" />
            <Field label="DL Symbols" value={form.tddPattern.dlSymbols} onChange={v => onChange('tddPattern', { ...form.tddPattern, dlSymbols: v })} type="number" />
            <Field label="UL Slots" value={form.tddPattern.ulSlots} onChange={v => onChange('tddPattern', { ...form.tddPattern, ulSlots: v })} type="number" />
            <Field label="UL Symbols" value={form.tddPattern.ulSymbols} onChange={v => onChange('tddPattern', { ...form.tddPattern, ulSymbols: v })} type="number" />
          </div>
        </BoxedSection>
      )}
    </div>
  );
}

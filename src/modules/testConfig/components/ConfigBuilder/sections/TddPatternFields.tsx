// TDD slot pattern. Split out of CellSection so the Cell tab can collapse
// it — it only applies to TDD bands and is rarely changed once set.
import { Field } from './Field';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function TddPatternFields({ form, onChange }: Props) {
  const set = (k: string, v: any) => onChange('tddPattern', { ...form.tddPattern, [k]: v });
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Field label="Period (ms)" value={form.tddPattern.period} onChange={v => set('period', v)} type="number" step="0.125" />
      <Field label="DL Slots" value={form.tddPattern.dlSlots} onChange={v => set('dlSlots', v)} type="number" />
      <Field label="DL Symbols" value={form.tddPattern.dlSymbols} onChange={v => set('dlSymbols', v)} type="number" />
      <Field label="UL Slots" value={form.tddPattern.ulSlots} onChange={v => set('ulSlots', v)} type="number" />
      <Field label="UL Symbols" value={form.tddPattern.ulSymbols} onChange={v => set('ulSymbols', v)} type="number" />
    </div>
  );
}

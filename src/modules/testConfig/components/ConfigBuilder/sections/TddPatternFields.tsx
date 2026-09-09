// TDD slot pattern — inline labels, thin heading rule, no card. Matches the
// Simnovator layout used across the Cell tab.
import { Field } from './Field';
import { InfoHint } from '../InfoHint';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function TddPatternFields({ form, onChange }: Props) {
  const set = (k: string, v: any) => onChange('tddPattern', { ...form.tddPattern, [k]: v });
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
        TDD Pattern
        <InfoHint>
          DL/UL split within each period. Emitted as
          <code className="font-mono"> tdd_ul_dl_config</code> on the cell.
        </InfoHint>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-2.5">
        <Field inline label="Period (ms)" value={form.tddPattern.period} onChange={v => set('period', v)} type="number" step="0.125" />
        <Field inline label="DL Slots" value={form.tddPattern.dlSlots} onChange={v => set('dlSlots', v)} type="number" />
        <Field inline label="DL Symbols" value={form.tddPattern.dlSymbols} onChange={v => set('dlSymbols', v)} type="number" />
        <Field inline label="UL Slots" value={form.tddPattern.ulSlots} onChange={v => set('ulSlots', v)} type="number" />
        <Field inline label="UL Symbols" value={form.tddPattern.ulSymbols} onChange={v => set('ulSymbols', v)} type="number" />
      </div>
    </div>
  );
}

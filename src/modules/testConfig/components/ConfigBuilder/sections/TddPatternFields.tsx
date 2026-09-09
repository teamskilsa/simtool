// TDD slot pattern. Card + dense grid to match the UE Simulator idiom used
// across the app; five short numeric fields fit one row from `sm` up.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';
import { Field } from './Field';
import { InfoHint } from '../InfoHint';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function TddPatternFields({ form, onChange }: Props) {
  const set = (k: string, v: any) => onChange('tddPattern', { ...form.tddPattern, [k]: v });
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gauge className="h-4 w-4" /> TDD Pattern
          <InfoHint>
            DL/UL split within each period. Emitted as
            <code className="font-mono"> tdd_ul_dl_config</code> in the cell.
          </InfoHint>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Field label="Period (ms)" value={form.tddPattern.period} onChange={v => set('period', v)} type="number" step="0.125" />
          <Field label="DL Slots" value={form.tddPattern.dlSlots} onChange={v => set('dlSlots', v)} type="number" />
          <Field label="DL Symbols" value={form.tddPattern.dlSymbols} onChange={v => set('dlSymbols', v)} type="number" />
          <Field label="UL Slots" value={form.tddPattern.ulSlots} onChange={v => set('ulSlots', v)} type="number" />
          <Field label="UL Symbols" value={form.tddPattern.ulSymbols} onChange={v => set('ulSymbols', v)} type="number" />
        </div>
      </CardContent>
    </Card>
  );
}

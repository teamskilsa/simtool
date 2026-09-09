import { Field } from '../Field';
import { BoxedSection, FIELD_GRID } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

const SIB_OPTIONS = [
  { value: 'SIB2', label: 'SIB2 - RACH + UL params' },
  { value: 'SIB3', label: 'SIB3 - Intra-freq reselection' },
  { value: 'SIB4', label: 'SIB4 - Inter-freq reselection' },
  { value: 'SIB5', label: 'SIB5 - Inter-RAT reselection' },
];

export function SibsLayer({ form, onChange }: Props) {
  const L = form.layers;
  const set = (k: string, v: any) => onChange('layers', { ...L, [k]: v });

  const toggleSib = (sibId: string) => {
    const current = L.sibScheduledSibs || [];
    const next = current.includes(sibId)
      ? current.filter(s => s !== sibId)
      : [...current, sibId];
    set('sibScheduledSibs', next);
  };

  return (
    <BoxedSection title="SIBs" hint="SIB1 cell-selection flags, the SI broadcast period, and which SIBs are scheduled. Hover a SIB chip for what it carries.">
      <div className={FIELD_GRID}>
        <Field label="SI Period (rf)" value={L.sibSiPeriodicity} onChange={v => set('sibSiPeriodicity', v)} type="select"
          options={[8, 16, 32, 64, 128, 160, 256, 512].map(v => ({ value: v, label: 'rf' + v }))} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Field label="Cell Barred" value={L.sibCellBarred} onChange={v => set('sibCellBarred', v)} type="checkbox" />
          <Field label="Intra-Freq Resel." value={L.sibIntraFreqReselection} onChange={v => set('sibIntraFreqReselection', v)} type="checkbox" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 xl:col-span-2">
          {SIB_OPTIONS.map(opt => {
            const on = (L.sibScheduledSibs || []).includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleSib(opt.value)}
                title={opt.label}
                className={`px-2.5 h-8 text-xs font-medium rounded-md border transition-colors ${
                  on
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {opt.value}
              </button>
            );
          })}
        </div>
      </div>
    </BoxedSection>
  );
}

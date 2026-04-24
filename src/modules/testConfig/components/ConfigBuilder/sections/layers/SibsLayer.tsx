import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

const SIB_OPTIONS = [
  { value: 'SIB2', label: 'SIB2 (RACH + UL params)' },
  { value: 'SIB3', label: 'SIB3 (Intra-freq reselection)' },
  { value: 'SIB4', label: 'SIB4 (Inter-freq reselection)' },
  { value: 'SIB5', label: 'SIB5 (Inter-RAT reselection)' },
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
    <div className="space-y-4">
      <BoxedSection title="SIB1 — Cell Selection">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Cell Barred" value={L.sibCellBarred} onChange={v => set('sibCellBarred', v)} type="checkbox" />
          <Field label="Intra-Freq Reselection" value={L.sibIntraFreqReselection} onChange={v => set('sibIntraFreqReselection', v)} type="checkbox" />
        </div>
      </BoxedSection>

      <BoxedSection title="SI Broadcast" subtitle="System Information broadcast periodicity and scheduling">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="SI Periodicity (frames)" value={L.sibSiPeriodicity} onChange={v => set('sibSiPeriodicity', v)} type="select"
            options={[
              { value: 8,   label: 'rf8' },
              { value: 16,  label: 'rf16' },
              { value: 32,  label: 'rf32' },
              { value: 64,  label: 'rf64' },
              { value: 128, label: 'rf128' },
              { value: 160, label: 'rf160' },
              { value: 256, label: 'rf256' },
              { value: 512, label: 'rf512' },
            ]} />
        </div>
      </BoxedSection>

      <BoxedSection title="Scheduled SIBs" subtitle="Click to toggle which SIBs are broadcast">
        <div className="flex flex-wrap gap-2">
          {SIB_OPTIONS.map(opt => {
            const on = (L.sibScheduledSibs || []).includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleSib(opt.value)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </BoxedSection>
    </div>
  );
}

import { BoxedSection } from '../../BoxedSection';
import type { LTEFormState } from '../../lteConstants';

interface Props { form: LTEFormState; onChange: (key: string, value: any) => void; }

// Reusable algo-preference picker (LTE flavour)
function AlgoSelector({ label, hint, value, options, onChange }: {
  label: string; hint?: string;
  value: string[]; options: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (algo: string) => {
    if (value.includes(algo)) onChange(value.filter(a => a !== algo));
    else onChange([...value, algo]);
  };
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-800">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map(algo => (
          <button
            key={algo}
            type="button"
            onClick={() => toggle(algo)}
            className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
              value.includes(algo)
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {algo}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        Active order: <span className="font-mono">{value.join(' → ') || '(none)'}</span>
      </p>
    </div>
  );
}

export function SecurityLte({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      <BoxedSection title="Ciphering Algorithms" subtitle="enb.cfg: cell_list[].cipher_algo_pref — UE selects the first supported one. EEA0 is always last.">
        <AlgoSelector
          label="Order of preference"
          value={form.cipherAlgoPref}
          options={['eea0', 'eea1', 'eea2', 'eea3']}
          onChange={v => onChange('cipherAlgoPref', v)}
        />
      </BoxedSection>

      <BoxedSection title="Integrity Algorithms" subtitle="enb.cfg: cell_list[].integ_algo_pref — EIA0 is always last.">
        <AlgoSelector
          label="Order of preference"
          value={form.integAlgoPref}
          options={['eia0', 'eia1', 'eia2', 'eia3']}
          onChange={v => onChange('integAlgoPref', v)}
        />
      </BoxedSection>
    </div>
  );
}

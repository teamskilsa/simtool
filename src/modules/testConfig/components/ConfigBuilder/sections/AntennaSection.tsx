// Antennas & Gain — count + TX/RX gain. Per Amarisoft docs, tx_gain / rx_gain
// can be a scalar (applied to every antenna path) or an array (one value per
// path). The user picks via the "Per-antenna gain" toggle.
//
// Defaults bump with antenna count when the user hasn't customised them, and
// SDR rf_driver.args switches between dev0 and dev0+dev1 at the 4-antenna
// threshold automatically.
import { Field } from './Field';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { BoxedSection } from '../BoxedSection';
import type { NRFormState } from '../constants';
import { defaultGains, defaultRfArgs, gainArrayFromScalar, gainAsScalar } from '../rfDefaults';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function AntennaSection({ form, onChange }: Props) {
  const txIsArray = Array.isArray(form.txGain);
  const rxIsArray = Array.isArray(form.rxGain);

  // Auto-bump gain on antenna change when current values match the previous
  // count's defaults — i.e. the user never customised them.
  const handleAntennaCountChange = (key: 'nAntennaDl' | 'nAntennaUl', value: number) => {
    const prev = defaultGains('nr', form.nAntennaDl);
    const userTouched = gainAsScalar(form.txGain) !== prev.txGain || gainAsScalar(form.rxGain) !== prev.rxGain;
    onChange(key, value);

    if (key === 'nAntennaDl' && !userTouched) {
      const next = defaultGains('nr', value);
      onChange('txGain', txIsArray ? gainArrayFromScalar(next.txGain, value) : next.txGain);
      if (!rxIsArray) onChange('rxGain', next.rxGain);
    }
    // Resize per-antenna arrays to match the new count, padding with the
    // last value (or default) so existing entries are preserved.
    if (key === 'nAntennaDl' && txIsArray) {
      const arr = form.txGain as number[];
      const fill = arr[arr.length - 1] ?? defaultGains('nr', value).txGain;
      onChange('txGain', Array.from({ length: value }, (_, i) => arr[i] ?? fill));
    }
    if (key === 'nAntennaUl' && rxIsArray) {
      const arr = form.rxGain as number[];
      const fill = arr[arr.length - 1] ?? defaultGains('nr', value).rxGain;
      onChange('rxGain', Array.from({ length: value }, (_, i) => arr[i] ?? fill));
    }
    // SDR args also depends on antenna count (1 or 2 SDRs).
    if (key === 'nAntennaDl' && form.rfMode === 'sdr' && form.rfArgs === defaultRfArgs('sdr', form.nAntennaDl)) {
      onChange('rfArgs', defaultRfArgs('sdr', value));
    }
  };

  const togglePerAntenna = (enabled: boolean) => {
    if (enabled) {
      const tx = gainAsScalar(form.txGain);
      const rx = gainAsScalar(form.rxGain);
      onChange('txGain', gainArrayFromScalar(tx, form.nAntennaDl));
      onChange('rxGain', gainArrayFromScalar(rx, form.nAntennaUl));
    } else {
      onChange('txGain', gainAsScalar(form.txGain));
      onChange('rxGain', gainAsScalar(form.rxGain));
    }
  };

  const resetGains = () => {
    const d = defaultGains('nr', form.nAntennaDl);
    onChange('txGain', txIsArray ? gainArrayFromScalar(d.txGain, form.nAntennaDl) : d.txGain);
    onChange('rxGain', rxIsArray ? gainArrayFromScalar(d.rxGain, form.nAntennaUl) : d.rxGain);
  };

  const updateArrayEntry = (key: 'txGain' | 'rxGain', idx: number, value: number) => {
    const current = (form[key] as number[]).slice();
    current[idx] = value;
    onChange(key, current);
  };

  const isPerAntenna = txIsArray || rxIsArray;

  return (
    <BoxedSection
      title="Antennas & Gain"
      subtitle="DL/UL antenna counts. TX/RX gain accepts a single value or one value per antenna path (Amarisoft tx_gain / rx_gain array form)."
      action={
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={resetGains} title="Reset gains to defaults for current antenna count">
          <RotateCcw className="w-3 h-3" />
          Reset gains
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Downlink Antennas"
          value={form.nAntennaDl}
          onChange={v => handleAntennaCountChange('nAntennaDl', v)}
          type="select"
          options={[{ value: 1, label: '1 (SISO)' }, { value: 2, label: '2 (2x2 MIMO)' }, { value: 4, label: '4 (4x4 MIMO)' }, { value: 8, label: '8 (8x8 MIMO)' }]}
        />
        <Field
          label="Uplink Antennas"
          value={form.nAntennaUl}
          onChange={v => handleAntennaCountChange('nAntennaUl', v)}
          type="select"
          options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }]}
        />
      </div>

      {/* Per-antenna toggle */}
      <div className="mt-4 flex items-center gap-3 px-1">
        <Field
          label="Per-antenna gain"
          value={isPerAntenna}
          onChange={v => togglePerAntenna(!!v)}
          type="checkbox"
        />
        <p className="text-[11px] text-muted-foreground -mt-0.5">
          {isPerAntenna
            ? 'Each antenna path has its own gain (emits as array).'
            : 'Same gain applied to every antenna path (emits as scalar).'}
        </p>
      </div>

      {/* Single-value form */}
      {!isPerAntenna && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <Field label="TX Gain (dB)" value={form.txGain as number} onChange={v => onChange('txGain', v)} type="number" min={0} max={120} />
          <Field label="RX Gain (dB)" value={form.rxGain as number} onChange={v => onChange('rxGain', v)} type="number" min={0} max={80} />
        </div>
      )}

      {/* Per-antenna arrays */}
      {isPerAntenna && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">TX Gain (dB) — per DL antenna</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: form.nAntennaDl }).map((_, i) => (
                <Field
                  key={`tx-${i}`}
                  label={`Ant ${i}`}
                  value={(form.txGain as number[])[i] ?? 90}
                  onChange={v => updateArrayEntry('txGain', i, v)}
                  type="number" min={0} max={120}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">RX Gain (dB) — per UL antenna</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: form.nAntennaUl }).map((_, i) => (
                <Field
                  key={`rx-${i}`}
                  label={`Ant ${i}`}
                  value={(form.rxGain as number[])[i] ?? 60}
                  onChange={v => updateArrayEntry('rxGain', i, v)}
                  type="number" min={0} max={80}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </BoxedSection>
  );
}

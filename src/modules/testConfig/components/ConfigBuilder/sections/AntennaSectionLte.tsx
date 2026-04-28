// LTE antenna configuration — count + TX/RX gain. Same UX as the NR
// AntennaSection: gain auto-bumps with antenna count when at the prior
// default; SDR args auto-update for 4-antenna setups.
import { Field } from './Field';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { BoxedSection } from '../BoxedSection';
import type { LTEFormState } from '../lteConstants';
import { defaultGains, defaultRfArgs } from '../rfDefaults';

interface Props { form: LTEFormState; onChange: (key: string, value: any) => void; }

export function AntennaSectionLte({ form, onChange }: Props) {
  const handleAntennaCountChange = (key: 'nAntennaDl' | 'nAntennaUl', value: number) => {
    const prev = defaultGains('lte', form.nAntennaDl);
    const userTouched = form.txGain !== prev.txGain || form.rxGain !== prev.rxGain;
    onChange(key, value);
    if (key === 'nAntennaDl' && !userTouched) {
      const next = defaultGains('lte', value);
      onChange('txGain', next.txGain);
      onChange('rxGain', next.rxGain);
    }
    if (key === 'nAntennaDl' && form.rfMode === 'sdr' && form.rfArgs === defaultRfArgs('sdr', form.nAntennaDl)) {
      onChange('rfArgs', defaultRfArgs('sdr', value));
    }
  };

  const resetGains = () => {
    const d = defaultGains('lte', form.nAntennaDl);
    onChange('txGain', d.txGain);
    onChange('rxGain', d.rxGain);
  };

  return (
    <BoxedSection
      title="Antennas & Gain"
      subtitle="DL/UL antenna counts + TX/RX gain. Gain auto-adjusts with antenna count unless you customise it."
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
          options={[{ value: 1, label: '1 (SISO)' }, { value: 2, label: '2 (2x2 MIMO)' }, { value: 4, label: '4 (4x4 MIMO)' }]}
        />
        <Field
          label="Uplink Antennas"
          value={form.nAntennaUl}
          onChange={v => handleAntennaCountChange('nAntennaUl', v)}
          type="select"
          options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <Field label="TX Gain (dB)" value={form.txGain} onChange={v => onChange('txGain', v)} type="number" min={0} max={120} />
        <Field label="RX Gain (dB)" value={form.rxGain} onChange={v => onChange('rxGain', v)} type="number" min={0} max={80} />
      </div>
    </BoxedSection>
  );
}

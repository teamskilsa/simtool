import { Field } from './Field';
import { SectionToolbar } from './SectionToolbar';
import { BoxedSection } from '../BoxedSection';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function RFSection({ form, onChange }: Props) {
  const currentRf = {
    rfMode: form.rfMode, nAntennaDl: form.nAntennaDl, nAntennaUl: form.nAntennaUl,
    txGain: form.txGain, rxGain: form.rxGain, rxAntenna: form.rxAntenna,
  };
  const handleLoad = (data: any, _name?: string) => {
    Object.entries(data).forEach(([k, v]) => onChange(k, v));
  };

  return (
    <div className="space-y-4">
      <SectionToolbar type="rf" currentData={currentRf} onLoad={handleLoad} />

      <BoxedSection title="RF Driver" subtitle="Radio frontend selection and gain">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="RF Mode" value={form.rfMode} onChange={v => onChange('rfMode', v)} type="select"
            options={[
              { value: 'sdr', label: 'SDR' },
              { value: 'split', label: 'Split 7.2 (DU)' },
              { value: 'ip', label: 'IP' },
            ]} />
          <Field label="TX Gain (dB)" value={form.txGain} onChange={v => onChange('txGain', v)} type="number" min={0} max={100} />
          <Field label="RX Gain (dB)" value={form.rxGain} onChange={v => onChange('rxGain', v)} type="number" min={0} max={100} />
        </div>
        <div className="mt-4">
          <Field label="RX Antenna" value={form.rxAntenna} onChange={v => onChange('rxAntenna', v)} placeholder="rx" />
        </div>
      </BoxedSection>
    </div>
  );
}

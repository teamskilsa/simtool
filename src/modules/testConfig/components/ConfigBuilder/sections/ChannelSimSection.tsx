import { Field } from './Field';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function ChannelSimSection({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Field label="Enable Channel Simulator" value={form.channelSim} onChange={v => onChange('channelSim', v)} type="checkbox" />

      {form.channelSim && (
        <>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Channel Model</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel Type" value={form.channelType} onChange={v => onChange('channelType', v)} type="select"
              options={[
                { value: 'AWGN', label: 'AWGN' },
                { value: 'TDLA30', label: 'TDLA30 (30 ns)' },
                { value: 'TDLB100', label: 'TDLB100 (100 ns)' },
                { value: 'TDLC300', label: 'TDLC300 (300 ns)' },
                { value: 'TDL', label: 'TDL (General)' },
              ]} />
            <Field label="Noise Level (dB)" value={form.noiseLevel} onChange={v => onChange('noiseLevel', v)} type="number" />
          </div>
        </>
      )}
    </div>
  );
}

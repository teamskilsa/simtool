import { Field } from './Field';
import { BoxedSection, FIELD_GRID } from '../BoxedSection';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function ChannelSimSection({ form, onChange }: Props) {
  return (
    <BoxedSection
      title="Channel Simulator"
      hint="Off by default. When enabled, the gNB applies a fading profile and noise floor to the radio link instead of running clean."
    >
      <div className={FIELD_GRID}>
        <Field label="Enabled" value={form.channelSim} onChange={v => onChange('channelSim', v)} type="checkbox" />

        {form.channelSim && (
          <>
            <Field label="Channel Type" value={form.channelType} onChange={v => onChange('channelType', v)} type="select"
              options={[
                { value: 'AWGN', label: 'AWGN' },
                { value: 'TDLA30', label: 'TDLA30 (30 ns)' },
                { value: 'TDLB100', label: 'TDLB100 (100 ns)' },
                { value: 'TDLC300', label: 'TDLC300 (300 ns)' },
                { value: 'TDL', label: 'TDL (General)' },
              ]} />
            <Field label="Noise Level (dB)" value={form.noiseLevel} onChange={v => onChange('noiseLevel', v)} type="number" />
          </>
        )}
      </div>
    </BoxedSection>
  );
}

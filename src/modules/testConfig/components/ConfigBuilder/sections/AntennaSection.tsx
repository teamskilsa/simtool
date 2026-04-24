import { Field } from './Field';
import { BoxedSection } from '../BoxedSection';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function AntennaSection({ form, onChange }: Props) {
  return (
    <BoxedSection title="Antenna Configuration" subtitle="DL / UL antenna counts (shared across all cells)">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Downlink Antennas" value={form.nAntennaDl} onChange={v => onChange('nAntennaDl', v)} type="select"
          options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }, { value: 8, label: '8' }]} />
        <Field label="Uplink Antennas" value={form.nAntennaUl} onChange={v => onChange('nAntennaUl', v)} type="select"
          options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }]} />
      </div>
    </BoxedSection>
  );
}

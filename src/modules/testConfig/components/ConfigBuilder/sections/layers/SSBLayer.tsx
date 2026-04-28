// SSB layer — SSB Period and DMRS Position. Lives in the Layers tab so the
// Cell tab stays focused on identity / band / TDD / RF / antenna.
import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function SSBLayer({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      <BoxedSection title="SSB Configuration" subtitle="enb.cfg: nr_cell_default.{ssb_period, dmrs_type_a_pos}">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="SSB Period (ms)"
            value={form.ssbPeriod}
            onChange={v => onChange('ssbPeriod', v)}
            type="number" min={5} max={160}
          />
          <Field
            label="DMRS Position"
            value={form.dmrsTypeAPos}
            onChange={v => onChange('dmrsTypeAPos', v)}
            type="select"
            options={[{ value: 2, label: 'Pos 2' }, { value: 3, label: 'Pos 3' }]}
          />
        </div>
      </BoxedSection>

      <BoxedSection title="SSB Position Bitmap" subtitle="enb.cfg: nr_cell_list[].ssb_pos_bitmap — which SSB positions are transmitted within a half-frame">
        <Field
          label="Bitmap"
          value={form.ssbPosBitmap}
          onChange={v => onChange('ssbPosBitmap', v)}
          placeholder="10000000"
        />
      </BoxedSection>
    </div>
  );
}

// SSB layer - period, DMRS position, and the in-half-frame position bitmap.
//
// Note: the SSB ARFCN (GSCN override) lives over in the Cell group next to
// DL NR-ARFCN, since they're frequency-domain neighbours and users expect
// them side by side.
import { Field } from '../Field';
import { BoxedSection, FIELD_GRID } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function SSBLayer({ form, onChange }: Props) {
  return (
    <BoxedSection
      title="SSB"
      hint="Emitted as nr_cell_default.{ssb_period, dmrs_type_a_pos} and nr_cell_list[].ssb_pos_bitmap - which SSB positions are transmitted within a half-frame."
    >
      <div className={FIELD_GRID}>
        <Field label="SSB Period (ms)" value={form.ssbPeriod} onChange={v => onChange('ssbPeriod', v)} type="number" min={5} max={160} />
        <Field label="DMRS Position" value={form.dmrsTypeAPos} onChange={v => onChange('dmrsTypeAPos', v)} type="select"
          options={[{ value: 2, label: 'Pos 2' }, { value: 3, label: 'Pos 3' }]} />
        <Field label="Position Bitmap" value={form.ssbPosBitmap} onChange={v => onChange('ssbPosBitmap', v)} placeholder="10000000" />
      </div>
    </BoxedSection>
  );
}

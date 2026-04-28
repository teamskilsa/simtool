import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { LTEFormState } from '../../lteConstants';

interface Props { form: LTEFormState; onChange: (key: string, value: any) => void; }

export function MacLte({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      <BoxedSection title="HARQ" subtitle="enb.cfg: cell_list[].mac_config.{ul,dl}_max_harq_tx — max retransmissions">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="UL Max HARQ Tx" value={form.ulMaxHarqTx} onChange={v => onChange('ulMaxHarqTx', v)} type="number" min={1} max={28} />
          <Field label="DL Max HARQ Tx" value={form.dlMaxHarqTx} onChange={v => onChange('dlMaxHarqTx', v)} type="number" min={1} max={28} />
        </div>
      </BoxedSection>

      <BoxedSection title="PHICH" subtitle="enb.cfg: cell_list[].phich_*">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Duration" value={form.phichDuration} onChange={v => onChange('phichDuration', v)} type="select"
            options={[{ value: 'normal', label: 'Normal' }, { value: 'extended', label: 'Extended' }]} />
          <Field label="Resource" value={form.phichResource} onChange={v => onChange('phichResource', v)} type="select"
            options={[
              { value: '1/6', label: '1/6' }, { value: '1/2', label: '1/2' },
              { value: '1', label: '1' }, { value: '2', label: '2' },
            ]} />
        </div>
      </BoxedSection>

      <BoxedSection title="Cyclic Prefix">
        <Field label="CP Mode" value={form.cpMode} onChange={v => onChange('cpMode', v)} type="select"
          options={[{ value: 'normal', label: 'Normal' }, { value: 'extended', label: 'Extended' }]} />
      </BoxedSection>
    </div>
  );
}

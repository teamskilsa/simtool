import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { LTEFormState } from '../../lteConstants';

interface Props { form: LTEFormState; onChange: (key: string, value: any) => void; }

export function FrequentlyUsedLte({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      <BoxedSection title="Scheduling" subtitle="enb.cfg: cell_list[].sr_period / cqi_period / inactivity_timer">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="SR Period (ms)" value={form.srPeriod} onChange={v => onChange('srPeriod', v)} type="number" min={1} />
          <Field label="CQI Period (ms)" value={form.cqiPeriod} onChange={v => onChange('cqiPeriod', v)} type="number" min={1} />
          <Field label="Inactivity Timer (ms)" value={form.inactivityTimer} onChange={v => onChange('inactivityTimer', v)} type="number" min={0} />
        </div>
      </BoxedSection>

      <BoxedSection title="Cell Access" subtitle="SIB1 reselection + UE power limits">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Min RX Level (dBm)" value={form.qRxLevMin} onChange={v => onChange('qRxLevMin', v)} type="number" min={-140} max={-44} />
          <Field label="Max UE Power (dBm)" value={form.pMax} onChange={v => onChange('pMax', v)} type="number" min={-30} max={33} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <Field label="Cell Barred" value={form.cellBarred} onChange={v => onChange('cellBarred', v)} type="checkbox" />
          <Field label="Intra-Freq Reselection" value={form.intraFreqReselection} onChange={v => onChange('intraFreqReselection', v)} type="checkbox" />
        </div>
      </BoxedSection>

      <BoxedSection title="System Information" subtitle="enb.cfg: cell_list[].si_*">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="SI Code Rate" value={form.siCoderate} onChange={v => onChange('siCoderate', v)} type="number" min={0.05} max={1.0} step="0.05" />
          <Field label="SI Window Length (ms)" value={form.siWindowLength} onChange={v => onChange('siWindowLength', v)} type="number" min={1} max={40} />
        </div>
      </BoxedSection>

      <BoxedSection title="Bearers">
        <Field label="DRB Config File" value={form.drbConfig} onChange={v => onChange('drbConfig', v)} placeholder="drb.cfg" />
      </BoxedSection>
    </div>
  );
}

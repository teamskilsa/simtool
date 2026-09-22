import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { LTEFormState } from '../../lteConstants';

interface Props { form: LTEFormState; onChange: (key: string, value: any) => void; }

export function FrequentlyUsedLte({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      <BoxedSection title="Scheduling" subtitle="enb.cfg: cell_list[].sr_period / cqi_period / inactivity_timer">
        <div className="cfg-field-grid">
          <Field label="SR Period (ms)" value={form.srPeriod} onChange={v => onChange('srPeriod', v)} type="number" min={1} />
          <Field label="CQI Period (ms)" value={form.cqiPeriod} onChange={v => onChange('cqiPeriod', v)} type="number" min={1} />
          <Field label="Inactivity (ms)" value={form.inactivityTimer} onChange={v => onChange('inactivityTimer', v)} type="number" min={0} />
        </div>
      </BoxedSection>

      <BoxedSection title="Cell Access" subtitle="SIB1 reselection + UE power limits">
        <div className="cfg-field-grid">
          <Field label="Min RX Level (dBm)" value={form.qRxLevMin} onChange={v => onChange('qRxLevMin', v)} type="number" min={-140} max={-44} />
          <Field label="Max UE Pwr (dBm)" value={form.pMax} onChange={v => onChange('pMax', v)} type="number" min={-30} max={33} />
        </div>
        <div className="cfg-field-grid mt-3">
          <Field label="Cell Barred" value={form.cellBarred} onChange={v => onChange('cellBarred', v)} type="checkbox" />
          <Field label="Intra-Freq Reselection" value={form.intraFreqReselection} onChange={v => onChange('intraFreqReselection', v)} type="checkbox" />
        </div>
      </BoxedSection>

      <BoxedSection title="System Information" subtitle="enb.cfg: cell_list[].si_*">
        <div className="cfg-field-grid">
          <Field label="SI Code Rate" value={form.siCoderate} onChange={v => onChange('siCoderate', v)} type="number" min={0.05} max={1.0} step="0.05" />
          <Field label="SI Window Length (ms)" value={form.siWindowLength} onChange={v => onChange('siWindowLength', v)} type="number" min={1} max={40} />
        </div>
      </BoxedSection>

      {(form.cells?.length ?? 1) > 1 && (
        <BoxedSection title="Mobility" subtitle="enb.cfg: cell_list[].ncell_list, cell_default.{meas_config_desc, meas_gap_config, ho_from_meas}">
          <div className="cfg-field-grid">
            <Field
              label="Handover from measurement reports"
              value={form.hoFromMeas !== false}
              onChange={v => onChange('hoFromMeas', v)}
              type="checkbox"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Every cell lists the other {(form.cells?.length ?? 1) - 1} cells of this eNB as neighbours, so manual
            handover (web UI / remote API) always works. When on, the eNB also sends A1/A2 + A3 measurements
            with gap pattern gp0 and hands over on the A3 report.
          </p>
        </BoxedSection>
      )}

      <BoxedSection title="Bearers">
        <Field label="DRB Config File" value={form.drbConfig} onChange={v => onChange('drbConfig', v)} placeholder="drb.cfg" />
      </BoxedSection>
    </div>
  );
}

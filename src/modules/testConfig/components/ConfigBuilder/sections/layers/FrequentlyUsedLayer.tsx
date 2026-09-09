import { Field } from '../Field';
import { BoxedSection, FIELD_GRID } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function FrequentlyUsedLayer({ form, onChange }: Props) {
  const L = form.layers;
  const set = (k: string, v: any) => onChange('layers', { ...L, [k]: v });

  return (
    <BoxedSection
      title="Frequently Used"
      hint="Scheduling intervals, higher-order modulation, dynamic power control and cell-access limits - the handful of nr_cell_default fields that get changed on most runs."
    >
      <div className={FIELD_GRID}>
        <Field label="SR Period (slots)" value={L.srPeriod} onChange={v => set('srPeriod', v)} type="number" min={1} />
        <Field label="CQI Period (slots)" value={L.cqiPeriod} onChange={v => set('cqiPeriod', v)} type="number" min={1} />
        <Field label="Inactivity (ms)" value={L.inactivityTimer} onChange={v => set('inactivityTimer', v)} type="number" min={0} />
        <Field label="Max UE Pwr (dBm)" value={L.pMax} onChange={v => set('pMax', v)} type="number" min={-30} max={33} />
        <Field label="Min RX Level (dBm)" value={L.qRxLevMin} onChange={v => set('qRxLevMin', v)} type="number" />
        <Field label="PUSCH SNR (dB)" value={L.dpcPuschSnrTarget} onChange={v => set('dpcPuschSnrTarget', v)} type="number" />
        <Field label="PUCCH SNR (dB)" value={L.dpcPucchSnrTarget} onChange={v => set('dpcPucchSnrTarget', v)} type="number" />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Field label="DPC" value={L.dpc} onChange={v => set('dpc', v)} type="checkbox" />
          <Field label="DL 256QAM" value={L.dl256qam} onChange={v => set('dl256qam', v)} type="checkbox" />
          <Field label="UL 64QAM" value={L.ul64qam} onChange={v => set('ul64qam', v)} type="checkbox" />
        </div>
      </div>
    </BoxedSection>
  );
}

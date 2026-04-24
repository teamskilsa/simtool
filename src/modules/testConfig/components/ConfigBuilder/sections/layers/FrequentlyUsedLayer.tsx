import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function FrequentlyUsedLayer({ form, onChange }: Props) {
  const L = form.layers;
  const set = (k: string, v: any) => onChange('layers', { ...L, [k]: v });

  return (
    <div className="space-y-4">
      <BoxedSection title="Scheduling & Periodicity" subtitle="Common scheduling intervals">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="SR Period (slots)" value={L.srPeriod} onChange={v => set('srPeriod', v)} type="number" min={1} />
          <Field label="CQI Period (slots)" value={L.cqiPeriod} onChange={v => set('cqiPeriod', v)} type="number" min={1} />
          <Field label="Inactivity Timer (ms)" value={L.inactivityTimer} onChange={v => set('inactivityTimer', v)} type="number" min={0} />
        </div>
      </BoxedSection>

      <BoxedSection title="Modulation" subtitle="Enable higher-order modulation schemes">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="DL 256QAM" value={L.dl256qam} onChange={v => set('dl256qam', v)} type="checkbox" />
          <Field label="UL 64QAM" value={L.ul64qam} onChange={v => set('ul64qam', v)} type="checkbox" />
        </div>
      </BoxedSection>

      <BoxedSection title="Power Control (DPC)" subtitle="Dynamic power control SNR targets">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="DPC Enabled" value={L.dpc} onChange={v => set('dpc', v)} type="checkbox" />
          <Field label="PUSCH SNR Target (dB)" value={L.dpcPuschSnrTarget} onChange={v => set('dpcPuschSnrTarget', v)} type="number" />
          <Field label="PUCCH SNR Target (dB)" value={L.dpcPucchSnrTarget} onChange={v => set('dpcPucchSnrTarget', v)} type="number" />
        </div>
      </BoxedSection>

      <BoxedSection title="Cell Access" subtitle="Cell reselection + UE power limits">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Max UE Power (dBm)" value={L.pMax} onChange={v => set('pMax', v)} type="number" min={-30} max={33} />
          <Field label="Min RX Level (dBm)" value={L.qRxLevMin} onChange={v => set('qRxLevMin', v)} type="number" />
        </div>
      </BoxedSection>
    </div>
  );
}

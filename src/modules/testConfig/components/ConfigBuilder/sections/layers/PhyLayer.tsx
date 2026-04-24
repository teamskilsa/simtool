import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function PhyLayer({ form, onChange }: Props) {
  const L = form.layers;
  const set = (k: string, v: any) => onChange('layers', { ...L, [k]: v });

  return (
    <div className="space-y-4">
      <BoxedSection title="MCS Table" subtitle="Modulation and Coding Scheme table selection">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="PDSCH MCS Table" value={L.pdschMcsTable} onChange={v => set('pdschMcsTable', v)} type="select"
            options={[
              { value: 'qam64',      label: '64-QAM' },
              { value: 'qam256',     label: '256-QAM' },
              { value: 'qam64LowSE', label: '64-QAM Low Spectral Efficiency' },
            ]} />
          <Field label="PUSCH MCS Table" value={L.puschMcsTable} onChange={v => set('puschMcsTable', v)} type="select"
            options={[
              { value: 'qam64',      label: '64-QAM' },
              { value: 'qam256',     label: '256-QAM' },
              { value: 'qam64LowSE', label: '64-QAM Low Spectral Efficiency' },
            ]} />
        </div>
      </BoxedSection>

      <BoxedSection title="PRACH" subtitle="Physical Random Access Channel">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="PRACH Config Index" value={L.prachConfigIndex} onChange={v => set('prachConfigIndex', v)} type="number" min={0} max={262} />
          <Field label="Root Sequence Index" value={L.prachRootSeqIndex} onChange={v => set('prachRootSeqIndex', v)} type="number" min={0} max={137} />
        </div>
      </BoxedSection>

      <BoxedSection title="PUSCH / PMI" subtitle="Uplink layers and precoding matrix reporting">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="PUSCH Max Layers" value={L.puschMaxLayers} onChange={v => set('puschMaxLayers', v)} type="select"
            options={[
              { value: 1, label: '1 layer' },
              { value: 2, label: '2 layers' },
              { value: 4, label: '4 layers' },
            ]} />
          <Field label="PMI Report" value={L.pmiReportEnabled} onChange={v => set('pmiReportEnabled', v)} type="checkbox" />
        </div>
      </BoxedSection>
    </div>
  );
}

import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function RlcPdcpLayer({ form, onChange }: Props) {
  const L = form.layers;
  const set = (k: string, v: any) => onChange('layers', { ...L, [k]: v });

  return (
    <div className="space-y-4">
      <BoxedSection title="RLC" subtitle="Radio Link Control configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="RLC Mode" value={L.rlcMode} onChange={v => set('rlcMode', v)} type="select"
            options={[{ value: 'am', label: 'Acknowledged Mode (AM)' }, { value: 'um', label: 'Unacknowledged Mode (UM)' }]} />
          <Field label="SN Length (bits)" value={L.rlcSnLength} onChange={v => set('rlcSnLength', v)} type="select"
            options={[{ value: 6, label: '6' }, { value: 12, label: '12' }, { value: 18, label: '18' }]} />
          <Field label="T-Reordering (ms)" value={L.rlcTReordering} onChange={v => set('rlcTReordering', v)} type="number" min={0} max={200} />
          <Field label="Max Retx Threshold" value={L.rlcMaxRetxThreshold} onChange={v => set('rlcMaxRetxThreshold', v)} type="number" min={1} max={32} />
        </div>
      </BoxedSection>

      <BoxedSection title="PDCP" subtitle="Packet Data Convergence Protocol">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="PDCP SN Size (bits)" value={L.pdcpSnSize} onChange={v => set('pdcpSnSize', v)} type="select"
            options={[{ value: 12, label: '12' }, { value: 18, label: '18' }]} />
          <Field label="Discard Timer (ms)" value={L.pdcpDiscardTimer} onChange={v => set('pdcpDiscardTimer', v)} type="number" min={0} />
        </div>
      </BoxedSection>
    </div>
  );
}

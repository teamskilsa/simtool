import { Field } from '../Field';
import { BoxedSection, FIELD_GRID } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function RlcPdcpLayer({ form, onChange }: Props) {
  const L = form.layers;
  const set = (k: string, v: any) => onChange('layers', { ...L, [k]: v });

  return (
    <BoxedSection title="RLC & PDCP" hint="Radio Link Control mode and timers, plus PDCP sequence-number size and discard timer.">
      <div className={FIELD_GRID}>
        <Field label="RLC Mode" value={L.rlcMode} onChange={v => set('rlcMode', v)} type="select"
          options={[{ value: 'am', label: 'Acknowledged (AM)' }, { value: 'um', label: 'Unacknowledged (UM)' }]} />
        <Field label="RLC SN (bits)" value={L.rlcSnLength} onChange={v => set('rlcSnLength', v)} type="select"
          options={[{ value: 6, label: '6' }, { value: 12, label: '12' }, { value: 18, label: '18' }]} />
        <Field label="T-Reordering (ms)" value={L.rlcTReordering} onChange={v => set('rlcTReordering', v)} type="number" min={0} max={200} />
        <Field label="Max Retx" value={L.rlcMaxRetxThreshold} onChange={v => set('rlcMaxRetxThreshold', v)} type="number" min={1} max={32} />
        <Field label="PDCP SN (bits)" value={L.pdcpSnSize} onChange={v => set('pdcpSnSize', v)} type="select"
          options={[{ value: 12, label: '12' }, { value: 18, label: '18' }]} />
        <Field label="Discard Timer (ms)" value={L.pdcpDiscardTimer} onChange={v => set('pdcpDiscardTimer', v)} type="number" min={0} />
      </div>
    </BoxedSection>
  );
}

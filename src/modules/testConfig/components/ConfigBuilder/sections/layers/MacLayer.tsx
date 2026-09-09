import { Field } from '../Field';
import { BoxedSection, FIELD_GRID } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function MacLayer({ form, onChange }: Props) {
  const L = form.layers;
  const set = (k: string, v: any) => onChange('layers', { ...L, [k]: v });

  return (
    <BoxedSection title="MAC" hint="HARQ retransmission limits and the random-access timers.">
      <div className={FIELD_GRID}>
        <Field label="DL Max HARQ Tx" value={L.dlMaxHarqTx} onChange={v => set('dlMaxHarqTx', v)} type="number" min={1} max={32} />
        <Field label="UL Max HARQ Tx" value={L.ulMaxHarqTx} onChange={v => set('ulMaxHarqTx', v)} type="number" min={1} max={32} />
        <Field label="Msg3 Max HARQ" value={L.msg3MaxHarqTx} onChange={v => set('msg3MaxHarqTx', v)} type="number" min={1} max={32} />
        <Field label="RA Window (slots)" value={L.raResponseWindowSize} onChange={v => set('raResponseWindowSize', v)} type="number" min={1} max={20} />
        <Field label="Contention (ms)" value={L.macContentionResolutionTimer} onChange={v => set('macContentionResolutionTimer', v)} type="number" min={8} max={64} />
      </div>
    </BoxedSection>
  );
}

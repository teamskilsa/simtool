import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function MacLayer({ form, onChange }: Props) {
  const L = form.layers;
  const set = (k: string, v: any) => onChange('layers', { ...L, [k]: v });

  return (
    <div className="space-y-4">
      <BoxedSection title="HARQ" subtitle="Hybrid ARQ retransmission limits">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="DL Max HARQ Tx" value={L.dlMaxHarqTx} onChange={v => set('dlMaxHarqTx', v)} type="number" min={1} max={32} />
          <Field label="UL Max HARQ Tx" value={L.ulMaxHarqTx} onChange={v => set('ulMaxHarqTx', v)} type="number" min={1} max={32} />
          <Field label="Msg3 Max HARQ Tx" value={L.msg3MaxHarqTx} onChange={v => set('msg3MaxHarqTx', v)} type="number" min={1} max={32} />
        </div>
      </BoxedSection>

      <BoxedSection title="Random Access" subtitle="RACH timers and windows">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="RA Response Window (slots)" value={L.raResponseWindowSize} onChange={v => set('raResponseWindowSize', v)} type="number" min={1} max={20} />
          <Field label="Contention Resolution Timer (ms)" value={L.macContentionResolutionTimer} onChange={v => set('macContentionResolutionTimer', v)} type="number" min={8} max={64} />
        </div>
      </BoxedSection>
    </div>
  );
}

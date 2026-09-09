import { Field } from '../Field';
import { BoxedSection, FIELD_GRID } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function RrcNasLayer({ form, onChange }: Props) {
  const L = form.layers;
  const set = (k: string, v: any) => onChange('layers', { ...L, [k]: v });

  return (
    <BoxedSection title="RRC & NAS" hint="How long an idle or inactive UE is held before release, and the idle-mode paging cycle.">
      <div className={FIELD_GRID}>
        <Field label="RRC Inactivity (ms)" value={L.rrcInactivityTimer} onChange={v => set('rrcInactivityTimer', v)} type="number" min={0} />
        <Field label="UE Inactivity (ms)" value={L.ueInactivityTimer} onChange={v => set('ueInactivityTimer', v)} type="number" min={0} />
        <Field label="Paging Cycle" value={L.paging.defaultCycle} onChange={v => set('paging', { ...L.paging, defaultCycle: v })} type="select"
          options={[
            { value: 32,  label: 'rf32' },
            { value: 64,  label: 'rf64' },
            { value: 128, label: 'rf128' },
            { value: 256, label: 'rf256' },
          ]} />
      </div>
    </BoxedSection>
  );
}

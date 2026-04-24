import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { NRFormState } from '../../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function RrcNasLayer({ form, onChange }: Props) {
  const L = form.layers;
  const set = (k: string, v: any) => onChange('layers', { ...L, [k]: v });

  return (
    <div className="space-y-4">
      <BoxedSection title="Inactivity Timers" subtitle="When to release idle / inactive UEs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="RRC Inactivity Timer (ms)" value={L.rrcInactivityTimer} onChange={v => set('rrcInactivityTimer', v)} type="number" min={0} />
          <Field label="UE Inactivity Timer (ms)" value={L.ueInactivityTimer} onChange={v => set('ueInactivityTimer', v)} type="number" min={0} />
        </div>
      </BoxedSection>

      <BoxedSection title="Paging" subtitle="Default paging cycle for idle mode UEs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Default Paging Cycle (frames)" value={L.paging.defaultCycle} onChange={v => set('paging', { ...L.paging, defaultCycle: v })} type="select"
            options={[
              { value: 32,  label: 'rf32' },
              { value: 64,  label: 'rf64' },
              { value: 128, label: 'rf128' },
              { value: 256, label: 'rf256' },
            ]} />
        </div>
      </BoxedSection>
    </div>
  );
}

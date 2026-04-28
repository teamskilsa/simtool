// Power & DPC layer — Dynamic Power Control SNR targets only.
//
// Antenna count + TX/RX gain moved to the Cell tab's Antennas & Gain section
// (gain auto-bumps with antenna count). RF mode/args are now in the dedicated
// RF Driver section under Cell.
import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { LTEFormState } from '../../lteConstants';

interface Props { form: LTEFormState; onChange: (key: string, value: any) => void; }

export function PowerLte({ form, onChange }: Props) {
  return (
    <BoxedSection title="Dynamic Power Control" subtitle="enb.cfg: cell_list[].dpc + dpc_*_snr_target">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="DPC Enabled" value={form.dpc} onChange={v => onChange('dpc', v)} type="checkbox" />
        <Field label="PUSCH SNR Target (dB)" value={form.dpcPuschSnrTarget} onChange={v => onChange('dpcPuschSnrTarget', v)} type="number" min={-10} max={40} disabled={!form.dpc} />
        <Field label="PUCCH SNR Target (dB)" value={form.dpcPucchSnrTarget} onChange={v => onChange('dpcPucchSnrTarget', v)} type="number" min={-10} max={40} disabled={!form.dpc} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        Antenna count and TX/RX gain are in <span className="font-medium">Cell → Antennas &amp; Gain</span>.
      </p>
    </BoxedSection>
  );
}

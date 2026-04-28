import { Field } from '../Field';
import { BoxedSection } from '../../BoxedSection';
import type { LTEFormState } from '../../lteConstants';

interface Props { form: LTEFormState; onChange: (key: string, value: any) => void; }

export function PowerLte({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      <BoxedSection title="Dynamic Power Control" subtitle="enb.cfg: cell_list[].dpc + dpc_*_snr_target">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="DPC Enabled" value={form.dpc} onChange={v => onChange('dpc', v)} type="checkbox" />
          <Field label="PUSCH SNR Target (dB)" value={form.dpcPuschSnrTarget} onChange={v => onChange('dpcPuschSnrTarget', v)} type="number" min={-10} max={40} />
          <Field label="PUCCH SNR Target (dB)" value={form.dpcPucchSnrTarget} onChange={v => onChange('dpcPucchSnrTarget', v)} type="number" min={-10} max={40} />
        </div>
      </BoxedSection>

      <BoxedSection title="Antennas" subtitle="enb.cfg: cell_list[].n_antenna_{dl,ul}">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="DL Antennas" value={form.nAntennaDl} onChange={v => onChange('nAntennaDl', v)} type="number" min={1} max={4} />
          <Field label="UL Antennas" value={form.nAntennaUl} onChange={v => onChange('nAntennaUl', v)} type="number" min={1} max={4} />
        </div>
      </BoxedSection>

      <BoxedSection title="RF Gains" subtitle="enb.cfg: tx_gain / rx_gain (in dB)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="TX Gain (dB)" value={form.txGain} onChange={v => onChange('txGain', v)} type="number" min={0} max={120} />
          <Field label="RX Gain (dB)" value={form.rxGain} onChange={v => onChange('rxGain', v)} type="number" min={0} max={80} />
        </div>
      </BoxedSection>
    </div>
  );
}

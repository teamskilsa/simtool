// MME / S1 connection info for LTE eNB configs
import { Field } from './Field';
import { BoxedSection } from '../BoxedSection';
import type { LTEFormState } from '../lteConstants';

interface Props { form: LTEFormState; onChange: (key: string, value: any) => void; }

export function MmeInfoSectionLte({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      <BoxedSection
        title="MME / S1 Connection"
        subtitle="enb.cfg: mme_list[].mme_addr + gtp_addr — where this eNB connects to the EPC"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="MME Address" value={form.mmeAddr} onChange={v => onChange('mmeAddr', v)} placeholder="127.0.1.100" />
          <Field label="GTP Address" value={form.gtpAddr} onChange={v => onChange('gtpAddr', v)} placeholder="127.0.1.1" />
        </div>
      </BoxedSection>

      <BoxedSection title="eNB Identity" subtitle="enb.cfg: enb_id (high 20 bits of SIB1.cellIdentifier)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="eNB ID" value={form.enbId} onChange={v => onChange('enbId', v)} placeholder="0x1A2D0" />
          <Field label="TAC" value={form.tac} onChange={v => onChange('tac', v)} type="number" min={0} max={65535} />
        </div>
      </BoxedSection>

      <BoxedSection title="PLMN" subtitle="enb.cfg: cell_list[].plmn_list[]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="MCC" value={form.plmn.mcc} onChange={v => onChange('plmn', { ...form.plmn, mcc: v })} placeholder="001" />
          <Field label="MNC" value={form.plmn.mnc} onChange={v => onChange('plmn', { ...form.plmn, mnc: v })} placeholder="01" />
          <div className="space-y-2">
            <Field label="Attach without PDN" value={form.attachWithoutPdn} onChange={v => onChange('attachWithoutPdn', v)} type="checkbox" />
            <Field label="PLMN Reserved" value={form.plmnReserved} onChange={v => onChange('plmnReserved', v)} type="checkbox" />
          </div>
        </div>
      </BoxedSection>
    </div>
  );
}

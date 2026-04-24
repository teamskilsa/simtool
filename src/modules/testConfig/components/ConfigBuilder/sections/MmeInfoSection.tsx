// MME / AMF connection info (for enb.cfg): where the gNB/eNB connects to the core
import { Field } from './Field';
import { BoxedSection } from '../BoxedSection';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function MmeInfoSection({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      <BoxedSection title="AMF / MME Connection" subtitle="Where this gNB/eNB connects to the 5G Core / EPC">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="AMF / MME Address" value={form.amfAddr} onChange={v => onChange('amfAddr', v)} placeholder="127.0.1.100" />
          <Field label="GTP Address" value={form.gtpAddr} onChange={v => onChange('gtpAddr', v)} placeholder="127.0.1.1" />
        </div>
      </BoxedSection>

      <BoxedSection title="gNB / eNB Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="gNB ID" value={form.gnbId} onChange={v => onChange('gnbId', v)} placeholder="0x12345" />
          <Field label="TAC" value={form.tac} onChange={v => onChange('tac', v)} type="number" min={0} max={65535} />
        </div>
      </BoxedSection>

      <BoxedSection title="PLMN">
        <div className="grid grid-cols-2 gap-4">
          <Field label="MCC" value={form.plmn.mcc} onChange={v => onChange('plmn', { ...form.plmn, mcc: v })} placeholder="001" />
          <Field label="MNC" value={form.plmn.mnc} onChange={v => onChange('plmn', { ...form.plmn, mnc: v })} placeholder="01" />
        </div>
      </BoxedSection>
    </div>
  );
}

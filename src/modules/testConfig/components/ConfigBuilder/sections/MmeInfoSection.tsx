// MME / AMF connection info (for enb.cfg / gnb.cfg).
//
// Scope: these fields are CONFIG-WIDE (top-level keys in the cfg, not per-cell).
//   amf_list[].amf_addr, gtp_addr, gnb_id / enb_id all live at the root of
//   the file. PLMN is technically per-cell (cell_list[].plmn_list[]), but
//   for typical single-PLMN deployments we let the user set one PLMN that
//   the generator applies to every cell.
import { Field } from './Field';
import { BoxedSection } from '../BoxedSection';
import { Info } from 'lucide-react';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function MmeInfoSection({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Scope banner */}
      <div className="flex items-start gap-2 p-3 rounded-md border border-blue-200 bg-blue-50/40 text-xs text-blue-900">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-600" />
        <div>
          <span className="font-medium">Config-wide settings.</span> These apply to the
          whole gNB/eNB process — every cell in this config registers to the same AMF/MME
          and shares the gNB/eNB ID. For per-cell PLMN overrides edit cell_list[].plmn_list directly.
        </div>
      </div>

      <BoxedSection title="AMF / MME Connection" subtitle="cfg root: amf_list[].amf_addr (NR) / mme_list[].mme_addr (LTE) + gtp_addr">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="AMF / MME Address" value={form.amfAddr} onChange={v => onChange('amfAddr', v)} placeholder="127.0.1.100" />
          <Field label="GTP Address" value={form.gtpAddr} onChange={v => onChange('gtpAddr', v)} placeholder="127.0.1.1" />
        </div>
      </BoxedSection>

      <BoxedSection title="gNB / eNB Identity" subtitle="cfg root: gnb_id (NR) / enb_id (LTE) + tac">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="gNB ID" value={form.gnbId} onChange={v => onChange('gnbId', v)} placeholder="0x12345" />
          <Field label="TAC" value={form.tac} onChange={v => onChange('tac', v)} type="number" min={0} max={65535} />
        </div>
      </BoxedSection>

      <BoxedSection title="PLMN" subtitle="Applied to every cell — for per-cell overrides edit cell_list[].plmn_list directly">
        <div className="grid grid-cols-2 gap-4">
          <Field label="MCC" value={form.plmn.mcc} onChange={v => onChange('plmn', { ...form.plmn, mcc: v })} placeholder="001" />
          <Field label="MNC" value={form.plmn.mnc} onChange={v => onChange('plmn', { ...form.plmn, mnc: v })} placeholder="01" />
        </div>
      </BoxedSection>
    </div>
  );
}

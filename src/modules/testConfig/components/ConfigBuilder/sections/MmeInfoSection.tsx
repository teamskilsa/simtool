// MME / AMF connection info (for enb.cfg / gnb.cfg).
//
// Scope: these fields are CONFIG-WIDE (top-level keys in the cfg, not per-cell).
//   amf_list[].amf_addr, gtp_addr, gnb_id / enb_id and license_server all live
//   at the root of the file. PLMN is technically per-cell
//   (cell_list[].plmn_list[]), but for typical single-PLMN deployments we let
//   the user set one PLMN that the generator applies to every cell.
import { Field } from './Field';
import { BoxedSection, FIELD_GRID } from '../BoxedSection';
import { Info } from 'lucide-react';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function MmeInfoSection({ form, onChange }: Props) {
  const lic = form.licenseServer ?? { serverAddr: '', tag: '' };
  const setLic = (k: 'serverAddr' | 'tag', v: string) =>
    onChange('licenseServer', { ...lic, [k]: v });

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 p-2.5 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-px text-muted-foreground/70" />
        <div>
          <span className="font-medium text-foreground">Config-wide settings.</span> These
          apply to the whole gNB/eNB process — every cell in this config registers to the
          same AMF/MME and shares the gNB/eNB ID. For per-cell PLMN overrides edit{' '}
          <code className="font-mono">cell_list[].plmn_list</code> directly.
        </div>
      </div>

      <BoxedSection
        title="AMF / MME Connection"
        hint="cfg root: amf_list[].amf_addr (NR) / mme_list[].mme_addr (LTE) + gtp_addr"
      >
        <div className={FIELD_GRID}>
          <Field label="AMF / MME Addr" value={form.amfAddr} onChange={v => onChange('amfAddr', v)} placeholder="127.0.1.100" />
          <Field label="GTP Address" value={form.gtpAddr} onChange={v => onChange('gtpAddr', v)} placeholder="127.0.1.1" />
        </div>
      </BoxedSection>

      <BoxedSection title="gNB / eNB Identity" hint="cfg root: gnb_id (NR) / enb_id (LTE) + tac">
        <div className={FIELD_GRID}>
          <Field label="gNB ID" value={form.gnbId} onChange={v => onChange('gnbId', v)} placeholder="0x12345" />
          <Field label="TAC" value={form.tac} onChange={v => onChange('tac', v)} type="number" min={0} max={65535} />
        </div>
      </BoxedSection>

      <BoxedSection
        title="License Server"
        hint="cfg root: license_server. Amarisoft will not start a daemon it cannot licence, and each running instance needs its own seat — two cores sharing one tag is the classic two-core failure. Leave the address blank only if the box licences some other way; the line is then omitted."
      >
        <div className={FIELD_GRID}>
          <Field
            label="Server Address"
            value={lic.serverAddr}
            onChange={v => setLic('serverAddr', v)}
            placeholder="192.168.0.11:9051"
          />
          <Field
            label="Tag"
            value={lic.tag}
            onChange={v => setLic('tag', v)}
            placeholder="oran-enb"
          />
        </div>
      </BoxedSection>

      <BoxedSection
        title="PLMN"
        hint="Applied to every cell — for per-cell overrides edit cell_list[].plmn_list directly"
      >
        <div className={FIELD_GRID}>
          <Field label="MCC" value={form.plmn.mcc} onChange={v => onChange('plmn', { ...form.plmn, mcc: v })} placeholder="001" />
          <Field label="MNC" value={form.plmn.mnc} onChange={v => onChange('plmn', { ...form.plmn, mnc: v })} placeholder="01" />
        </div>
      </BoxedSection>
    </div>
  );
}

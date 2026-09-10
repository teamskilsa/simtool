// MME / S1 connection info for LTE eNB configs.
//
// Scope: CONFIG-WIDE (top-level keys in enb.cfg, not per-cell).
//   mme_list[], gtp_addr, enb_id, en_dc_support and license_server all live
//   at root. PLMN sits inside cell_list[].plmn_list — for typical single-PLMN
//   deployments we set one PLMN that the generator broadcasts on every cell.
import { Field } from './Field';
import { BoxedSection, FIELD_GRID } from '../BoxedSection';
import { InfoHint } from '../InfoHint';
import { Info } from 'lucide-react';
import type { LTEFormState } from '../lteConstants';

interface Props { form: LTEFormState; onChange: (key: string, value: any) => void; }

export function MmeInfoSectionLte({ form, onChange }: Props) {
  const lic = form.licenseServer ?? { serverAddr: '', tag: '' };
  const setLic = (k: 'serverAddr' | 'tag', v: string) =>
    onChange('licenseServer', { ...lic, [k]: v });

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 p-2.5 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-px text-muted-foreground/70" />
        <div>
          <span className="font-medium text-foreground">Config-wide settings.</span> All
          cells in this eNB connect to the same MME via S1 and share the eNB ID. PLMN below
          is applied to every cell — for per-cell overrides edit{' '}
          <code className="font-mono">cell_list[].plmn_list</code> directly.
        </div>
      </div>

      <BoxedSection
        title="MME / S1 Connection"
        hint="enb.cfg: mme_list[].mme_addr + gtp_addr — where this eNB connects to the EPC"
      >
        <div className={FIELD_GRID}>
          <Field label="MME Address" value={form.mmeAddr} onChange={v => onChange('mmeAddr', v)} placeholder="127.0.1.100" />
          <Field label="GTP Address" value={form.gtpAddr} onChange={v => onChange('gtpAddr', v)} placeholder="127.0.1.1" />
        </div>
      </BoxedSection>

      <BoxedSection title="eNB Identity" hint="enb.cfg: enb_id (high 20 bits of SIB1.cellIdentifier) + tac + en_dc_support">
        <div className={FIELD_GRID}>
          <Field label="eNB ID" value={form.enbId} onChange={v => onChange('enbId', v)} placeholder="0x1A2D0" />
          <Field label="TAC" value={form.tac} onChange={v => onChange('tac', v)} type="number" min={0} max={65535} />
          <Field
            label="EN-DC Support"
            value={form.enDcSupport ?? false}
            onChange={v => onChange('enDcSupport', v)}
            type="checkbox"
            hint={<InfoHint>enb.cfg root: en_dc_support. Lets this eNB act as the LTE anchor of an EN-DC (NSA) pair. Only written to the file when on.</InfoHint>}
          />
        </div>
      </BoxedSection>

      <BoxedSection
        title="License Server"
        hint="enb.cfg root: license_server. Amarisoft will not start a daemon it cannot licence, and each running instance needs its own seat. Leave the address blank only if the box licences some other way; the line is then omitted."
      >
        <div className={FIELD_GRID}>
          <Field label="Server Address" value={lic.serverAddr} onChange={v => setLic('serverAddr', v)} placeholder="192.168.0.11:9051" />
          <Field label="Tag" value={lic.tag} onChange={v => setLic('tag', v)} placeholder="oran-enb" />
        </div>
      </BoxedSection>

      <BoxedSection title="PLMN" hint="enb.cfg: cell_list[].plmn_list[]">
        <div className={FIELD_GRID}>
          <Field label="MCC" value={form.plmn.mcc} onChange={v => onChange('plmn', { ...form.plmn, mcc: v })} placeholder="001" />
          <Field label="MNC" value={form.plmn.mnc} onChange={v => onChange('plmn', { ...form.plmn, mnc: v })} placeholder="01" />
          <Field label="Attach w/o PDN" value={form.attachWithoutPdn} onChange={v => onChange('attachWithoutPdn', v)} type="checkbox" />
          <Field label="PLMN Reserved" value={form.plmnReserved} onChange={v => onChange('plmnReserved', v)} type="checkbox" />
        </div>
      </BoxedSection>
    </div>
  );
}

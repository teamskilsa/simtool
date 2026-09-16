// Step 2 — Subscriber.
//
// One chip per UE group; the active group's form in four columns like
// Simnovator: identity · SIM credentials · capability · link adaptation.
// "Total UEs" and the Advanced toggle sit on the right of the chip row.
'use client';

import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GroupChips } from '../GroupChips';
import { makeSubscriberGroup } from '../../defaults';
import { supiToImsi, totalUesOfGroups } from './subscriberUtil';
import type {
  AutoOrNumber, CellStepData, ProtectionScheme, SubscriberGroup, SubscriberStepData,
} from '../../types';

interface Props {
  data: SubscriberStepData;
  cell: CellStepData;
  activeIdx: number;
  onActiveChange: (i: number) => void;
  onChange: (next: SubscriberStepData) => void;
  /** Removal is owned by the parent so User Plane / Traffic / Mobility
   *  references to group ids are remapped in the same update. */
  onRemoveGroup: (idx: number) => void;
}

const AUTO_OR: { value: AutoOrNumber; label: string }[] = [
  { value: 'Auto', label: 'Auto' },
  ...Array.from({ length: 16 }, (_, i) => ({ value: i as AutoOrNumber, label: String(i) })),
];

const RI_OR: { value: AutoOrNumber; label: string }[] = [
  { value: 'Auto', label: 'Auto' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' },
];

export function SubscriberStep({ data, cell, activeIdx, onActiveChange, onChange, onRemoveGroup }: Props) {
  const isNr = cell.ratType === '5G:SA';
  const g = data.groups[activeIdx] ?? data.groups[0];

  const patch = (p: Partial<SubscriberGroup>) => {
    onChange({ ...data, groups: data.groups.map((x, i) => (i === activeIdx ? { ...x, ...p } : x)) });
  };

  const addGroup = () => {
    const next = makeSubscriberGroup(data.groups.length, cell.ratType, {
      algorithm: g.algorithm, sharedKey: g.sharedKey, opType: g.opType, opValue: g.opValue,
      servingCell: g.servingCell, mncDigits: g.mncDigits,
    });
    onChange({ ...data, groups: [...data.groups, next] });
    onActiveChange(data.groups.length);
  };

  const removeGroup = (idx: number) => {
    if (data.groups.length <= 1) return;
    onRemoveGroup(idx);
    onActiveChange(Math.max(0, Math.min(activeIdx, data.groups.length - 2)));
  };

  const firstImsi = supiToImsi(g.startingSupi);
  const lastImsi = supiToImsi(g.startingSupi, Math.max(0, g.ueCount - 1) * Math.max(1, g.nextSupi));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <GroupChips
          label="UE Group"
          count={data.groups.length}
          active={activeIdx}
          onSelect={onActiveChange}
          onAdd={addGroup}
          onRemove={removeGroup}
          max={16}
          detail={i => `${data.groups[i].ueCount} UE`}
        />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">Total UEs:</span>
            <span className="font-semibold text-primary">{totalUesOfGroups(data.groups)}</span>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch checked={data.advanced} onCheckedChange={v => onChange({ ...data, advanced: !!v })} />
            <span>Advanced</span>
          </label>
        </div>
      </div>

      <div className="wizard-cols">
        {/* Column 1 — identity */}
        <div className="space-y-3">
          <Field label="UE Count" required type="number" value={g.ueCount} min={1} max={5000} onChange={v => patch({ ueCount: Math.max(1, Math.round(v)) })} />
          <Field
            label="Serving Cell" required type="select" value={g.servingCell}
            options={cell.cells.map(c => ({ value: c.id, label: String(c.id) }))}
            onChange={v => patch({ servingCell: Number(v) })}
            hint={<InfoHint>The cell this group is expected to camp on. Recorded for the report and the overview; the UE itself selects the strongest cell it decodes.</InfoHint>}
          />
          <Field
            label="Starting SUPI" required value={g.startingSupi} onChange={v => patch({ startingSupi: String(v).replace(/\D/g, '') })}
            hint={<InfoHint>Numeric form, leading zeros dropped: 1010123456001 is SUPI 001010123456001. First UE = {firstImsi}, last = {lastImsi}.</InfoHint>}
          />
          <Field label="Next SUPI" required type="number" value={g.nextSupi} min={1} onChange={v => patch({ nextSupi: Math.max(1, Math.round(v)) })} hint={<InfoHint>Increment between consecutive UEs.</InfoHint>} />
          <Field
            label="MNC Digits" required type="select" value={g.mncDigits}
            options={[{ value: 2, label: '2' }, { value: 3, label: '3' }]}
            onChange={v => patch({ mncDigits: Number(v) as 2 | 3 })}
          />
          <Field
            label="Protection Scheme" required type="select" value={g.protectionScheme}
            options={(['Null', 'Profile A', 'Profile B'] as ProtectionScheme[]).map(p => ({ value: p, label: p }))}
            onChange={v => patch({ protectionScheme: v })}
            hint={<InfoHint>SUCI concealment (ecc_params.scheme). Null sends the SUPI in clear; Profile A/B conceal it with the home network public key entered under Advanced, identified by the key ID below.</InfoHint>}
          />
          <Field label="Public Key ID" required type="number" value={g.publicKeyId} min={0} max={3} onChange={v => patch({ publicKeyId: v })} hint={<InfoHint>0 only with the Null scheme; 1–3 for Profile A/B.</InfoHint>} />
          <Field label="Routing Indicator" required value={g.routingIndicator} onChange={v => patch({ routingIndicator: String(v).replace(/\D/g, '').slice(0, 4) })} />
        </div>

        {/* Column 2 — SIM */}
        <div className="space-y-3">
          <Field
            label="Algorithm" required type="select" value={g.algorithm}
            options={[{ value: 'Milenage', label: 'Milenage' }, { value: 'XOR', label: 'XOR' }, { value: 'TUAK', label: 'TUAK' }]}
            onChange={v => patch({ algorithm: v })}
          />
          <Field label="Shared Key (K)" required value={g.sharedKey} onChange={v => patch({ sharedKey: String(v).trim() })} placeholder="32 hex chars" />
          <Field label="Increment Shared Key" type="number" value={g.incrementSharedKey} min={0} onChange={v => patch({ incrementSharedKey: Math.max(0, Math.round(v)) })} hint={<InfoHint>Added to K for each successive UE. 0 = every UE shares the same K.</InfoHint>} />

          {g.algorithm !== 'XOR' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name={`optype-${g.id}`} checked={g.opType === 'OP'} onChange={() => patch({ opType: 'OP' })} className="accent-primary" />
                  OP
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name={`optype-${g.id}`} checked={g.opType === 'OPc'} onChange={() => patch({ opType: 'OPc' })} className="accent-primary" />
                  OPc <span className="text-destructive">*</span>
                </label>
                <Input className="h-8 text-sm flex-1 min-w-0" value={g.opValue} onChange={e => patch({ opValue: e.target.value.trim() })} placeholder="32 hex chars" />
              </div>
            </div>
          )}

          <Field label="SQN" value={g.sqn} onChange={v => patch({ sqn: String(v).trim() })} placeholder="optional, hex" />
          <Field
            label="RES Len" required type="select" value={g.resLen}
            options={[4, 8, 16].map(n => ({ value: n, label: String(n) }))}
            onChange={v => patch({ resLen: Number(v) as 4 | 8 | 16 })}
            hint={<InfoHint>Length of the authentication response in bytes.</InfoHint>}
          />

          <CheckGrid
            label="Integrity Algorithm" required
            items={[
              { key: 'nia0', label: 'NIA0' }, { key: 'nia1', label: 'NIA1' },
              { key: 'nia2', label: 'NIA2' }, { key: 'nia3', label: 'NIA3' },
            ]}
            values={g.integrity as unknown as Record<string, boolean>}
            onChange={(k, v) => patch({ integrity: { ...g.integrity, [k]: v } })}
          />
          <CheckGrid
            label="Cipher Algorithm" required
            items={[
              { key: 'nea0', label: 'NEA0' }, { key: 'nea1', label: 'NEA1' },
              { key: 'nea2', label: 'NEA2' }, { key: 'nea3', label: 'NEA3' },
            ]}
            values={g.cipher as unknown as Record<string, boolean>}
            onChange={(k, v) => patch({ cipher: { ...g.cipher, [k]: v } })}
          />
          <Field
            label="External SIM" type="select" value={g.externalSim ? 'True' : 'False'}
            options={[{ value: 'False', label: 'False' }, { value: 'True', label: 'True' }]}
            onChange={v => patch({ externalSim: v === 'True' })}
            hint={<InfoHint>Use a physical SIM in a card reader instead of the K/OPc above (ext_sim).</InfoHint>}
          />
        </div>

        {/* Column 3 — capability */}
        <div className="space-y-3">
          <Field
            label="AS Release" required type="select" value={g.asRelease}
            options={[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(n => ({ value: n, label: String(n) }))}
            onChange={v => patch({ asRelease: Number(v) })}
          />
          <Field
            label="UE Category Type" required type="select" value={g.ueCategoryType}
            options={[{ value: 'Combined', label: 'Combined' }, { value: 'NR', label: 'NR' }, { value: 'LTE', label: 'LTE' }]}
            onChange={v => patch({ ueCategoryType: v })}
            hint={<InfoHint>Combined = the UE reports both LTE and NR capability.</InfoHint>}
          />
          <Field
            label="UE Category" required type="select" value={g.ueCategory}
            options={isNr
              ? [{ value: 'NR', label: 'NR' }]
              : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'].map(c => ({ value: c, label: c }))}
            onChange={v => patch({ ueCategory: String(v) })}
          />
          <Field
            label="Attach PDN Type" required type="select" value={g.attachPdnType}
            options={[{ value: 'Normal', label: 'Normal' }, { value: 'Emergency', label: 'Emergency' }]}
            onChange={v => patch({ attachPdnType: v })}
          />
          <Field
            label="PDN Type" required type="select" value={g.pdnType}
            options={[{ value: 'IPv4', label: 'IPv4' }, { value: 'IPv6', label: 'IPv6' }, { value: 'IPv4v6', label: 'IPv4v6' }]}
            onChange={v => patch({ pdnType: v })}
          />
          <Field label="Default APN" value={g.defaultApn} onChange={v => patch({ defaultApn: String(v) })} placeholder="from network if empty" />

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-[116px] shrink-0 flex items-center gap-1">
              Voice Capability <InfoHint>Whether the UE advertises IMS voice support.</InfoHint>
            </Label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={g.vonrSupport} onCheckedChange={v => patch({ vonrSupport: !!v })} />
              {isNr ? 'VoNR Support' : 'VoLTE Support'}
            </label>
          </div>

          <Field
            label="Network Slicing" required type="select" value={g.networkSlicing}
            options={[{ value: 'Disable', label: 'Disable' }, { value: 'Enable', label: 'Enable' }]}
            onChange={v => patch({ networkSlicing: v })}
            hint={<InfoHint>When enabled the S-NSSAI below is requested at registration (default_nssai).</InfoHint>}
          />
          {g.networkSlicing === 'Enable' && (
            <div className="flex items-center gap-2 pl-[124px]">
              <Input type="number" className="h-8 w-20 text-sm" value={g.nssai[0]?.sst ?? 1} min={0} max={255}
                onChange={e => patch({ nssai: [{ sst: parseInt(e.target.value, 10) || 0, sd: g.nssai[0]?.sd ?? '' }] })} placeholder="SST" />
              <Input className="h-8 flex-1 text-sm" value={g.nssai[0]?.sd ?? ''}
                onChange={e => patch({ nssai: [{ sst: g.nssai[0]?.sst ?? 1, sd: e.target.value.trim() }] })} placeholder="SD (optional, e.g. 0x010203)" />
            </div>
          )}

          <CheckGrid
            label="Access Class Value"
            items={[11, 12, 13, 14, 15].map(n => ({ key: String(n), label: String(n) }))}
            values={Object.fromEntries([11, 12, 13, 14, 15].map(n => [String(n), g.accessClass.includes(n)]))}
            onChange={(k, v) => {
              const n = parseInt(k, 10);
              const set = new Set(g.accessClass);
              if (v) set.add(n); else set.delete(n);
              patch({ accessClass: [...set].sort((a, b) => a - b) });
            }}
            hint="Special access classes the SIM carries (11–15)."
          />
          <CheckGrid
            label="UAC Access Identities"
            items={[{ key: 'uacMps', label: 'MPS' }, { key: 'uacMcs', label: 'MCS' }]}
            values={{ uacMps: g.uacMps, uacMcs: g.uacMcs }}
            onChange={(k, v) => patch({ [k]: v } as Partial<SubscriberGroup>)}
            hint="Unified access control identities for priority services."
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-[116px] shrink-0">RRC Inactive</Label>
            <Checkbox checked={g.rrcInactive} onCheckedChange={v => patch({ rrcInactive: !!v })} />
          </div>
        </div>

        {/* Column 4 — link adaptation */}
        <div className="space-y-3">
          <Field label="BLER Override" required type="number" value={g.blerOverride} min={0} max={100} onChange={v => patch({ blerOverride: v })} hint={<InfoHint>Target BLER in percent the test tool aims for. 0 = leave link adaptation alone.</InfoHint>} />
          <Field label="CQI" required type="select" value={g.cqi} options={AUTO_OR} onChange={v => patch({ cqi: v === 'Auto' ? 'Auto' : Number(v) })} hint={<InfoHint>Fixed CQI report, or Auto to report the measured value.</InfoHint>} />
          <Field label="RI" required type="select" value={g.ri} options={RI_OR} onChange={v => patch({ ri: v === 'Auto' ? 'Auto' : Number(v) })} hint={<InfoHint>Fixed rank indicator.</InfoHint>} />
          <Field label="PMI" required type="select" value={g.pmi} options={AUTO_OR} onChange={v => patch({ pmi: v === 'Auto' ? 'Auto' : Number(v) })} hint={<InfoHint>Fixed precoding matrix indicator.</InfoHint>} />

          {data.advanced && (
            <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2 mt-2">
              <div className="text-xs font-semibold text-foreground">Advanced</div>
              <Field label="IMEISV" value={g.imeisv} onChange={v => patch({ imeisv: String(v).replace(/\D/g, '').slice(0, 16) })} placeholder="4085780000000102" hint={<InfoHint>16 digits. Digits 9–14 are replaced by the UE number, so UE 64 becomes …006402, as Simnovator numbers them.</InfoHint>} />
              {g.protectionScheme !== 'Null' && (
                <Field label="Home NW public key" required value={g.homeNetworkPublicKey} onChange={v => patch({ homeNetworkPublicKey: String(v).trim() })} placeholder={g.protectionScheme === 'Profile A' ? '32 bytes hex' : '33 bytes hex'} hint={<InfoHint>ecc_params.home_nw_public_key: 32 bytes for Profile A, 33 for Profile B.</InfoHint>} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckGrid({ label, required, items, values, onChange, hint }: {
  label: string; required?: boolean;
  items: { key: string; label: string }[];
  values: Record<string, boolean>;
  onChange: (key: string, v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Label className="text-xs text-muted-foreground w-[116px] shrink-0 leading-tight flex items-center gap-1 pt-1">
        <span>{label}{required && <span className="text-destructive ml-0.5">*</span>}</span>
        {hint && <InfoHint>{hint}</InfoHint>}
      </Label>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {items.map(it => (
          <label key={it.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox checked={!!values[it.key]} onCheckedChange={v => onChange(it.key, !!v)} />
            {it.label}
          </label>
        ))}
      </div>
    </div>
  );
}

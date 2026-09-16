// Step 1 — Network.
//
// The core's identity on the left (core type, PLMN, TAC, the MME/AMF
// identifiers and the GTP-U bind address) and what it advertises to the UE
// on the right (names, DCNR, CP-CIoT, interworking, eDRX), with the 5GC
// slice list under it. Laid out like the UE-SIM Cell step: inline labels,
// sub-groups in a muted box, no viewport breakpoints.
'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { plmnString } from '../../derive';
import type { CoreType, EpsInterworking, NetworkStepData } from '../../types';

const BOOL_OPTIONS = [{ value: 'False', label: 'False' }, { value: 'True', label: 'True' }];

const CORE_TYPES: { value: CoreType; label: string }[] = [
  { value: 'EPC', label: 'EPC (4G)' },
  { value: '5GC', label: '5GC (5G)' },
  { value: 'Combined', label: 'Combined (EPC + 5GC)' },
];

const INTERWORKING: { value: EpsInterworking; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'with_n26', label: 'with_n26' },
  { value: 'without_n26', label: 'without_n26' },
];

export function NetworkStep({ data, onChange }: { data: NetworkStepData; onChange: (next: NetworkStepData) => void }) {
  const patch = (p: Partial<NetworkStepData>) => onChange({ ...data, ...p });

  const fiveG = data.coreType !== 'EPC';

  const patchSlice = (idx: number, p: Partial<{ sst: number; sd: string }>) => {
    patch({ nssai: data.nssai.map((s, i) => (i === idx ? { ...s, ...p } : s)) });
  };

  return (
    <div className="space-y-5">
      <div className="wizard-cols">
        {/* Column 1 — identity */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground">Identity</div>
          <Field
            label="Core Type" required type="select" value={data.coreType}
            options={CORE_TYPES}
            onChange={v => patch({ coreType: v as CoreType })}
            hint={<InfoHint>Which core the box presents. ltemme serves both; the choice decides which interworking and IMS-VoPS keys are written.</InfoHint>}
          />
          <Field
            label="MCC" required value={data.mcc}
            onChange={v => patch({ mcc: String(v).replace(/\D/g, '').slice(0, 3) })}
            placeholder="3 digits"
          />
          <Field
            label="MNC" required value={data.mnc}
            onChange={v => patch({ mnc: String(v).replace(/\D/g, '').slice(0, 3) })}
            placeholder="2 or 3 digits"
          />
          <div className="pl-[124px] -mt-2 text-[11px] text-muted-foreground font-mono">
            PLMN {plmnString(data.mcc, data.mnc)}
          </div>
          <Field
            label="TAC" required type="number" value={data.tac} min={0} max={65535}
            onChange={v => patch({ tac: Math.max(0, Math.round(v)) })}
            hint={<InfoHint>Recorded on the config; the cell broadcasts the TAC, not the core.</InfoHint>}
          />
          <Field
            label="MME Group ID" required type="number" value={data.mmeGroupId} min={0} max={65535}
            onChange={v => patch({ mmeGroupId: Math.max(0, Math.round(v)) })}
          />
          <Field
            label="MME Code" required type="number" value={data.mmeCode} min={0} max={255}
            onChange={v => patch({ mmeCode: Math.max(0, Math.round(v)) })}
          />
          <Field
            label="GTP-U Address" required value={data.gtpAddr}
            onChange={v => patch({ gtpAddr: String(v).trim() })}
            hint={<InfoHint>Bind address for GTP-U; the S1AP/NGAP SCTP connection binds on the same address by default.</InfoHint>}
          />
        </div>

        {/* Column 2 — capabilities */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground">Capabilities</div>
          <Field label="Network Name" value={data.networkName} onChange={v => patch({ networkName: String(v) })} />
          <Field label="Network Short Name" value={data.networkShortName} onChange={v => patch({ networkShortName: String(v) })} />
          <Field
            label="DCNR Support" type="select" value={data.dcnrSupport ? 'True' : 'False'}
            options={BOOL_OPTIONS}
            onChange={v => patch({ dcnrSupport: v === 'True' })}
            hint={<InfoHint>Advertises EN-DC to the UE.</InfoHint>}
          />
          <Field
            label="CP-CIoT Optimisation" type="select" value={data.cpCiotOpt ? 'True' : 'False'}
            options={BOOL_OPTIONS}
            onChange={v => patch({ cpCiotOpt: v === 'True' })}
          />
          <Field
            label="15 Bearers" type="select" value={data.fifteenBearers ? 'True' : 'False'}
            options={BOOL_OPTIONS}
            onChange={v => patch({ fifteenBearers: v === 'True' })}
          />
          {data.coreType === 'Combined' && (
            <Field
              label="EPS ↔ 5GS Interworking" required type="select" value={data.epsInterworking}
              options={INTERWORKING}
              onChange={v => patch({ epsInterworking: v as EpsInterworking })}
            />
          )}
          <Field
            label="eDRX" type="select" value={data.edrx ? 'True' : 'False'}
            options={BOOL_OPTIONS}
            onChange={v => patch({ edrx: v === 'True' })}
          />
          {data.edrx && (
            <Field
              label="eDRX Cycle" type="number" value={data.edrxCycleForced} min={0} max={15}
              onChange={v => patch({ edrxCycleForced: Math.max(0, Math.round(v)) })}
            />
          )}

          {fiveG && (
            <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2">
              <div className="text-xs font-semibold text-foreground">Network Slices (NSSAI)</div>
              {data.nssai.length === 0 && (
                <div className="text-[11px] text-muted-foreground">No slices; the AMF advertises none.</div>
              )}
              {data.nssai.map((slice, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="number" className="h-8 w-20 text-sm" value={slice.sst} min={0} max={255}
                    onChange={e => patchSlice(i, { sst: parseInt(e.target.value, 10) || 0 })}
                    placeholder="SST"
                  />
                  <Input
                    className="h-8 flex-1 min-w-0 text-sm" value={slice.sd}
                    onChange={e => patchSlice(i, { sd: e.target.value.trim() })}
                    placeholder="optional, e.g. 0x000001"
                  />
                  <button
                    type="button"
                    title="Remove slice"
                    onClick={() => patch({ nssai: data.nssai.filter((_, j) => j !== i) })}
                    className="p-1 rounded text-muted-foreground hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button
                type="button" variant="outline" size="sm" className="text-xs"
                onClick={() => patch({ nssai: [...data.nssai, { sst: 1, sd: '' }] })}
              >
                Add slice
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

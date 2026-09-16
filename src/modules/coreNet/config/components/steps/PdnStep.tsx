// Step 2 — PDN / APN.
//
// One chip per APN; the active APN's form in three columns: what the APN is
// on the left, the address pool it hands out in the middle, and the bearer
// QoS (plus the 5G slice flows) on the right. The pool column says in so
// many words whether the pool can actually cover the subscribers the next
// step creates, which is the mistake this form exists to catch.
'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GroupChips } from '@/modules/ueSim/testcase/components/GroupChips';
import { QCI_OPTIONS, defaultErab, makePdn } from '../../defaults';
import { poolCapacity } from '../../derive';
import type {
  CoreType, Erab, PdnEntry, PdnSlice, PdnStepData, PdnType,
  PreemptionCapability, PreemptionVulnerability,
} from '../../types';

interface Props {
  data: PdnStepData;
  activeIdx: number;
  onActiveChange: (i: number) => void;
  onChange: (next: PdnStepData) => void;
  subscriberCount: number;
  /** Slices are 5GC-only; the parent passes the Network step's core type. */
  coreType?: CoreType;
}

const MAX_PDNS = 8;

const BOOL_OPTIONS = [{ value: 'False', label: 'False' }, { value: 'True', label: 'True' }];

const PDN_TYPES: { value: PdnType; label: string }[] = [
  { value: 'ipv4', label: 'ipv4' },
  { value: 'ipv6', label: 'ipv6' },
  { value: 'ipv4v6', label: 'ipv4v6' },
  { value: 'non-ip', label: 'non-ip' },
];

const CAPABILITY: { value: PreemptionCapability; label: string }[] = [
  { value: 'may_trigger_pre_emption', label: 'may trigger' },
  { value: 'shall_not_trigger_pre_emption', label: 'shall not' },
];

const VULNERABILITY: { value: PreemptionVulnerability; label: string }[] = [
  { value: 'pre_emptable', label: 'pre-emptable' },
  { value: 'not_pre_emptable', label: 'not pre-emptable' },
];

const TH = 'h-8 px-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';
const TD = 'px-2 py-1 text-xs';

export function PdnStep({ data, activeIdx, onActiveChange, onChange, subscriberCount, coreType = 'Combined' }: Props) {
  const pdn = data.pdns[activeIdx] ?? data.pdns[0];
  const fiveG = coreType !== 'EPC';

  const patchPdn = (p: Partial<PdnEntry>) => {
    onChange({ ...data, pdns: data.pdns.map((x, i) => (i === activeIdx ? { ...x, ...p } : x)) });
  };

  const addPdn = () => {
    if (data.pdns.length >= MAX_PDNS) return;
    // A free id, and a 10.10.N.x pool no other APN already uses.
    const ids = new Set(data.pdns.map(p => p.id));
    let id = 0;
    while (ids.has(id)) id += 1;
    const octets = new Set(data.pdns.map(p => Number(p.firstIpAddr.split('.')[2])).filter(n => Number.isFinite(n)));
    let n = 1;
    while (octets.has(n)) n += 1;
    const next = makePdn(id, {
      apn: `apn${id}`,
      firstIpAddr: `10.10.${n}.2`,
      lastIpAddr: `10.10.${n}.254`,
    });
    onChange({ ...data, pdns: [...data.pdns, next] });
    onActiveChange(data.pdns.length);
  };

  const removePdn = (idx: number) => {
    if (data.pdns.length <= 1) return;
    const pdns = data.pdns.filter((_, i) => i !== idx).map((p, i) => ({ ...p, id: i }));
    onChange({ ...data, pdns });
    onActiveChange(Math.max(0, Math.min(activeIdx, pdns.length - 1)));
  };

  const patchErab = (idx: number, p: Partial<Erab>) => {
    patchPdn({ erabs: pdn.erabs.map((e, i) => (i === idx ? { ...e, ...p } : e)) });
  };

  const patchSlice = (idx: number, p: Partial<PdnSlice>) => {
    patchPdn({ slices: pdn.slices.map((s, i) => (i === idx ? { ...s, ...p } : s)) });
  };

  const patchFlow = (sliceIdx: number, flowIdx: number, p: Partial<Erab>) => {
    patchSlice(sliceIdx, {
      qosFlows: pdn.slices[sliceIdx].qosFlows.map((f, i) => (i === flowIdx ? { ...f, ...p } : f)),
    });
  };

  const showIpv4 = pdn.pdnType !== 'ipv6' && pdn.pdnType !== 'non-ip';
  const showIpv6 = pdn.pdnType === 'ipv6' || pdn.pdnType === 'ipv4v6';
  const capacity = poolCapacity(pdn);
  const short = capacity != null && capacity < subscriberCount;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <GroupChips
          label="APN"
          count={data.pdns.length}
          active={activeIdx}
          onSelect={onActiveChange}
          onAdd={addPdn}
          onRemove={removePdn}
          max={MAX_PDNS}
          detail={i => data.pdns[i].apn}
        />
        <div className="text-[11px] text-muted-foreground">The first APN is the default one.</div>
      </div>

      <div className="wizard-cols">
        {/* Column 1 — what the APN is */}
        <div className="space-y-3">
          <Field
            label="APN Name" required value={pdn.apn}
            onChange={v => patchPdn({ apn: String(v).trim() })}
          />
          <Field
            label="PDN Type" required type="select" value={pdn.pdnType}
            options={PDN_TYPES}
            onChange={v => patchPdn({ pdnType: v as PdnType })}
          />
          <Field
            label="Emergency APN" type="select" value={pdn.emergency ? 'True' : 'False'}
            options={BOOL_OPTIONS}
            onChange={v => patchPdn({ emergency: v === 'True' })}
            hint={<InfoHint>Marks the APN usable for emergency (SOS) bearers.</InfoHint>}
          />
          <Field
            label="Gateway" value={pdn.gateway}
            onChange={v => patchPdn({ gateway: String(v).trim() })}
            placeholder="first pool address if empty"
          />
          <Field
            label="TUN Setup Script" value={data.tunSetupScript}
            onChange={v => onChange({ ...data, tunSetupScript: String(v).trim() })}
            hint={<InfoHint>Called once per PDN to create the network interface. No script, no interface.</InfoHint>}
          />
        </div>

        {/* Column 2 — the address pool */}
        <div className="space-y-3">
          {showIpv4 && (
            <>
              <Field
                label="First IP Address" required value={pdn.firstIpAddr}
                onChange={v => patchPdn({ firstIpAddr: String(v).trim() })}
              />
              <Field
                label="Last IP Address" required value={pdn.lastIpAddr}
                onChange={v => patchPdn({ lastIpAddr: String(v).trim() })}
              />
              <Field
                label="Address Shift" type="number" value={pdn.ipAddrShift} min={0} max={8}
                onChange={v => patchPdn({ ipAddrShift: Math.max(0, Math.round(v)) })}
                hint={<InfoHint>Allocated addresses are spaced 2^shift apart. 0 allocates consecutively.</InfoHint>}
              />
            </>
          )}
          {showIpv6 && (
            <>
              <Field
                label="First IPv6 Prefix" value={pdn.firstIpv6Prefix}
                onChange={v => patchPdn({ firstIpv6Prefix: String(v).trim() })}
              />
              <Field
                label="Last IPv6 Prefix" value={pdn.lastIpv6Prefix}
                onChange={v => patchPdn({ lastIpv6Prefix: String(v).trim() })}
              />
            </>
          )}
          <Field
            label="DNS Address" value={pdn.dnsAddr}
            onChange={v => patchPdn({ dnsAddr: String(v) })}
            hint={<InfoHint>One or more, comma separated.</InfoHint>}
          />
          <Field
            label="P-CSCF Address" value={pdn.pCscfAddr}
            onChange={v => patchPdn({ pCscfAddr: String(v) })}
            hint={<InfoHint>Needed for an IMS APN.</InfoHint>}
          />
          {capacity != null && (
            <div className={`pl-[124px] text-[11px] ${short ? 'text-destructive' : 'text-muted-foreground'}`}>
              Pool holds {capacity} addresses for {subscriberCount} subscribers
            </div>
          )}
        </div>

        {/* Column 3 — bearer QoS */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground">Bearer QoS</div>
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TH}>QCI</TableHead>
                  <TableHead className={TH}>Priority</TableHead>
                  <TableHead className={TH}>Pre-emption capability</TableHead>
                  <TableHead className={TH}>Vulnerability</TableHead>
                  <TableHead className={TH}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pdn.erabs.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className={TD}>
                      <Select value={String(e.qci)} onValueChange={v => patchErab(i, { qci: Number(v) })}>
                        <SelectTrigger className="h-7 w-[64px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {QCI_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className={TD}>
                      <Input
                        type="number" className="h-7 w-16 text-xs" value={e.priorityLevel} min={1} max={15}
                        onChange={ev => patchErab(i, { priorityLevel: parseInt(ev.target.value, 10) || 1 })}
                      />
                    </TableCell>
                    <TableCell className={TD}>
                      <Select
                        value={e.preemptionCapability}
                        onValueChange={v => patchErab(i, { preemptionCapability: v as PreemptionCapability })}
                      >
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CAPABILITY.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className={TD}>
                      <Select
                        value={e.preemptionVulnerability}
                        onValueChange={v => patchErab(i, { preemptionVulnerability: v as PreemptionVulnerability })}
                      >
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VULNERABILITY.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className={TD}>
                      <button
                        type="button"
                        title="Remove bearer"
                        onClick={() => patchPdn({ erabs: pdn.erabs.filter((_, j) => j !== i) })}
                        className="p-1 rounded text-muted-foreground hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            type="button" variant="outline" size="sm" className="text-xs"
            onClick={() => patchPdn({ erabs: [...pdn.erabs, defaultErab(9)] })}
          >
            Add bearer
          </Button>

          {fiveG && (
            <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2">
              <div className="text-xs font-semibold text-foreground">Slices</div>
              {pdn.slices.length === 0 && (
                <div className="text-[11px] text-muted-foreground">No slice-specific flows; the bearers above apply.</div>
              )}
              {pdn.slices.map((slice, si) => (
                <div key={si} className="rounded-md border border-border/60 bg-background px-2 py-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" className="h-7 w-16 text-xs" value={slice.sst} min={0} max={255}
                      onChange={e => patchSlice(si, { sst: parseInt(e.target.value, 10) || 0 })}
                      placeholder="SST"
                    />
                    <Input
                      className="h-7 flex-1 min-w-0 text-xs" value={slice.sd}
                      onChange={e => patchSlice(si, { sd: e.target.value.trim() })}
                      placeholder="SD (optional)"
                    />
                    <button
                      type="button"
                      title="Remove slice"
                      onClick={() => patchPdn({ slices: pdn.slices.filter((_, j) => j !== si) })}
                      className="p-1 rounded text-muted-foreground hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {slice.qosFlows.map((flow, fi) => (
                    <div key={fi} className="flex items-center gap-2 pl-2">
                      <Select value={String(flow.qci)} onValueChange={v => patchFlow(si, fi, { qci: Number(v) })}>
                        <SelectTrigger className="h-7 w-[72px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {QCI_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number" className="h-7 w-16 text-xs" value={flow.priorityLevel} min={1} max={15}
                        onChange={e => patchFlow(si, fi, { priorityLevel: parseInt(e.target.value, 10) || 1 })}
                      />
                      <span className="text-[10px] text-muted-foreground">5QI / priority</span>
                      <button
                        type="button"
                        title="Remove flow"
                        onClick={() => patchSlice(si, { qosFlows: slice.qosFlows.filter((_, j) => j !== fi) })}
                        className="p-1 rounded text-muted-foreground hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button" variant="outline" size="sm" className="text-xs h-7"
                    onClick={() => patchSlice(si, { qosFlows: [...slice.qosFlows, defaultErab(9)] })}
                  >
                    Add flow
                  </Button>
                </div>
              ))}
              <Button
                type="button" variant="outline" size="sm" className="text-xs"
                onClick={() => patchPdn({ slices: [...pdn.slices, { sst: 1, sd: '', qosFlows: [defaultErab(9)] }] })}
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

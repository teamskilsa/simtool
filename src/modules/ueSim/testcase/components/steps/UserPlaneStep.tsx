'use client';
// Step 3 — User Plane.
//
// One chip per user-plane profile; the active profile's form in three
// columns like Simnovator: flow identity (type, group, APN, PDN, target
// address/port, transport) · traffic shape (which only IPERF and PING
// have) · timing. The offered-load line under the grid is computed by the
// parent from the whole test case (aggregateMbps in derive.ts) because it
// needs the UE counts of every group, which this step does not own.

import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GroupChips } from '../GroupChips';
import { makeUserPlaneProfile } from '../../defaults';
import type {
  Bitrate, BitrateUnit, DataType, GroupSelector, PdnType, SubscriberStepData, TransferAction,
  UserPlaneProfile, UserPlaneStepData,
} from '../../types';

interface Props {
  data: UserPlaneStepData;
  subscriber: SubscriberStepData;
  activeIdx: number;
  onActiveChange: (i: number) => void;
  onChange: (next: UserPlaneStepData) => void;
  /** Offered load across every UE in Mbps, from aggregateMbps(tc, 'DL'|'UL'). */
  aggregate?: { dl: number; ul: number };
}

const MAX_PROFILES = 8;
const DATA_TYPES: DataType[] = ['IPERF', 'PING', 'HTTP', 'None'];
const PDN_TYPES: PdnType[] = ['IPv4', 'IPv6', 'IPv4v6'];
const TRANSFER_ACTIONS: TransferAction[] = ['Both', 'DL', 'UL'];
const BITRATE_UNITS: BitrateUnit[] = ['Kbps', 'Mbps', 'Gbps'];

export function UserPlaneStep({ data, subscriber, activeIdx, onActiveChange, onChange, aggregate }: Props) {
  const p = data.profiles[activeIdx] ?? data.profiles[0];

  const patch = (patchValue: Partial<UserPlaneProfile>) => {
    onChange({ ...data, profiles: data.profiles.map((x, i) => (i === activeIdx ? { ...x, ...patchValue } : x)) });
  };

  const addProfile = () => {
    if (data.profiles.length >= MAX_PROFILES) return;
    // Same target as the current profile, but a port range of its own so two
    // flows to the same group do not collide (each UE uses startingPort + index).
    const next = makeUserPlaneProfile(data.profiles.length, {
      destinationIp: p.destinationIp, transportProtocol: p.transportProtocol, pdnType: p.pdnType, apnName: p.apnName,
      startingPort: Math.min(65535, p.startingPort + 1000),
    });
    onChange({ ...data, profiles: [...data.profiles, next] });
    onActiveChange(data.profiles.length);
  };

  const removeProfile = (idx: number) => {
    if (data.profiles.length <= 1) return;
    const profiles = data.profiles.filter((_, i) => i !== idx).map((x, i) => ({ ...x, id: i }));
    onChange({ ...data, profiles });
    onActiveChange(Math.max(0, Math.min(activeIdx, profiles.length - 1)));
  };

  const groupOptions: { value: GroupSelector; label: string }[] = [
    { value: 'all', label: 'Apply to All' },
    ...subscriber.groups.map(g => ({ value: g.id as GroupSelector, label: `UE Group ${g.id}` })),
  ];

  const isIperf = p.dataType === 'IPERF';
  const showDl = p.fileTransferAction !== 'UL';
  const showUl = p.fileTransferAction !== 'DL';

  return (
    <div className="space-y-5">
      <GroupChips
        label="UserPlane"
        count={data.profiles.length}
        active={activeIdx}
        onSelect={onActiveChange}
        onAdd={addProfile}
        onRemove={removeProfile}
        max={MAX_PROFILES}
        detail={i => data.profiles[i].dataType}
      />

      <div className="wizard-cols">
        {/* Column 1 — flow identity */}
        <div className="space-y-3">
          <Field
            label="Data Type" required type="select" value={p.dataType}
            options={DATA_TYPES.map(t => ({ value: t, label: t }))}
            onChange={v => patch({ dataType: v })}
          />
          <Field
            label="Subscriber Group" type="select" value={p.subscriberGroup}
            options={groupOptions}
            onChange={v => patch({ subscriberGroup: v === 'all' ? 'all' : Number(v) })}
            hint={<InfoHint>Which UE groups run this flow. "Apply to All" covers every group on the Subscriber step.</InfoHint>}
          />
          <Field label="APN Name" value={p.apnName} onChange={v => patch({ apnName: String(v).trim() })} placeholder="default APN" />
          <Field
            label="PDN Type" required type="select" value={p.pdnType}
            options={PDN_TYPES.map(t => ({ value: t, label: t }))}
            onChange={v => patch({ pdnType: v })}
          />
          {p.dataType === 'HTTP' ? (
            <Field
              label="Destination URL" required value={p.destinationUrl}
              onChange={v => patch({ destinationUrl: String(v).trim() })}
              placeholder="http://host/path"
              hint={<InfoHint>Fetched repeatedly for the session (global_traffic http dest_url). The lab app server has no HTTP server, so point this at a real one.</InfoHint>}
            />
          ) : (
            <Field
              label="Destination IP Address" required value={p.destinationIp}
              onChange={v => patch({ destinationIp: String(v).trim() })}
              placeholder="e.g. 20.10.10.1"
              hint={<InfoHint>The app server's data-plane address. In the lab that is 20.10.10.1.</InfoHint>}
            />
          )}
          {isIperf && (
            <>
              <Field
                label="Starting Port" required type="number" value={p.startingPort} min={1} max={65535}
                onChange={v => patch({ startingPort: Math.round(v) })}
                hint={<InfoHint>First port of the range (port_range). The app server opens two iperf3 servers per UE from here: DL on the even port, UL on the odd one, so 10 UEs use 20 ports.</InfoHint>}
              />
              <Field
                label="Transport Protocol" required type="select" value={p.transportProtocol}
                options={[{ value: 'UDP', label: 'UDP' }, { value: 'TCP', label: 'TCP' }]}
                onChange={v => patch({ transportProtocol: v })}
              />
            </>
          )}
        </div>

        {/* Column 2 — traffic shape */}
        <div className="space-y-3">
          {isIperf && (
            <>
              <Field
                label="File Transfer Action" required type="select" value={p.fileTransferAction}
                options={TRANSFER_ACTIONS.map(a => ({ value: a, label: a }))}
                onChange={v => patch({ fileTransferAction: v })}
                hint={<InfoHint>Both = a DL and a UL iperf flow per UE. DL alone or UL alone hides the other bitrate.</InfoHint>}
              />
              <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2">
                <div className="text-xs font-semibold text-foreground">Data Bitrate</div>
                {showDl && <BitrateRow label="DL Bitrate" value={p.dlBitrate} onChange={dlBitrate => patch({ dlBitrate })} />}
                {showUl && <BitrateRow label="UL Bitrate" value={p.ulBitrate} onChange={ulBitrate => patch({ ulBitrate })} />}
              </div>
              <Field
                label="Payload Length (bytes)" type="number" value={p.payloadLength} min={1} max={65535}
                onChange={v => patch({ payloadLength: Math.round(v) })}
              />
              <Field
                label="MTU Size (bytes)" required type="number" value={p.mtuSize} min={576} max={9000}
                onChange={v => patch({ mtuSize: Math.round(v) })}
              />
            </>
          )}

          {p.dataType === 'PING' && (
            <>
              <Field
                label="Packet Size (bytes)" required type="number" value={p.payloadLength} min={8} max={65507}
                onChange={v => patch({ payloadLength: Math.round(v) })}
              />
              <Field
                label="Interval (sec)" required type="number" value={p.pingInterval} min={0.2} step="0.1"
                onChange={v => patch({ pingInterval: v })}
                hint={<InfoHint>Seconds between echo requests.</InfoHint>}
              />
              <Field
                label="Packets" required type="number" value={p.pingCount} min={1}
                onChange={v => patch({ pingCount: Math.max(1, Math.round(v)) })}
                hint={<InfoHint>Echo requests per session (packet_count).</InfoHint>}
              />
            </>
          )}

          {p.dataType === 'HTTP' && (
            <p className="text-xs text-muted-foreground">The URL is requested in a loop for the session duration.</p>
          )}

          {p.dataType === 'None' && (
            <p className="text-xs text-muted-foreground">No user-plane traffic for this profile.</p>
          )}
        </div>

        {/* Column 3 — timing */}
        <div className="space-y-3">
          <Field
            label="Start Delay (sec)" required type="number" value={p.startDelay} min={0}
            onChange={v => patch({ startDelay: Math.max(0, v) })}
            hint={<InfoHint>Seconds after the UE powers on before traffic starts.</InfoHint>}
          />
          <Field
            label="Duration (sec)" required type="number" value={p.duration} min={1}
            onChange={v => patch({ duration: v })}
          />
          <Field
            label="Loop" type="select" value={p.loop ? 'True' : 'False'}
            options={[{ value: 'False', label: 'False' }, { value: 'True', label: 'True' }]}
            onChange={v => patch({ loop: v === 'True' })}
            hint={<InfoHint>Repeat the session (data_loop_count / inter_data_loop_delay on the UE's traffic entry).</InfoHint>}
          />
          {p.loop && (
            <>
              <Field
                label="Sessions" required type="number" value={p.loopCount} min={2}
                onChange={v => patch({ loopCount: Math.max(2, Math.round(v)) })}
                hint={<InfoHint>Total sessions, including the first.</InfoHint>}
              />
              <Field
                label="Gap (sec)" required type="number" value={p.loopGap} min={0}
                onChange={v => patch({ loopGap: Math.max(0, v) })}
                hint={<InfoHint>Pause between sessions.</InfoHint>}
              />
            </>
          )}
        </div>
      </div>

      {aggregate && (
        <p className="text-xs text-muted-foreground">
          Offered load across all UEs: DL {formatMbps(aggregate.dl)} · UL {formatMbps(aggregate.ul)}
        </p>
      )}
    </div>
  );
}

function formatMbps(v: number): string {
  return `${Math.round(v * 10) / 10} Mbps`;
}

/** "DL Bitrate*  [ 150 ] [Mbps v]" — value and unit on one row so the
 *  column stays as dense as the rest of the form. Both parts are required. */
function BitrateRow({ label, value, onChange }: {
  label: string; value: Bitrate; onChange: (b: Bitrate) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground w-[116px] shrink-0 leading-tight flex items-center gap-1">
        <span>{label}<span className="text-destructive ml-0.5">*</span></span>
      </Label>
      <Input
        type="number"
        className="h-8 text-sm flex-1 min-w-0"
        value={value.value}
        min={0}
        step="any"
        aria-label={`${label} value`}
        onChange={e => onChange({ ...value, value: parseFloat(e.target.value) || 0 })}
      />
      <Select value={value.unit} onValueChange={u => onChange({ ...value, unit: u as BitrateUnit })}>
        <SelectTrigger className="h-8 w-20 shrink-0 text-sm" aria-label={`${label} unit`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {BITRATE_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

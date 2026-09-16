'use client';
// Step 4 — Traffic.
//
// One chip per traffic profile; the active profile's form in three
// columns like Simnovator: which groups and how they attach · whether
// they loop and how long they stay on · the attach rate and delay. The
// "Attach schedule" table under the grid shows when the first few UEs and
// the last UE of each governed group power on and off, using the same
// attachTime the generator and the overview use.

import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GroupChips } from '../GroupChips';
import { makeTrafficProfile } from '../../defaults';
import { attachTime, cycleLength, formatSeconds } from '../../derive';
import type { AttachType, GroupSelector, SubscriberGroup, SubscriberStepData, TrafficProfile, TrafficStepData } from '../../types';

interface Props {
  data: TrafficStepData;
  subscriber: SubscriberStepData;
  activeIdx: number;
  onActiveChange: (i: number) => void;
  onChange: (next: TrafficStepData) => void;
}

const MAX_PROFILES = 8;
const ATTACH_TYPES: AttachType[] = ['Bursty', 'Sequential'];
const PREVIEW_HEAD = 5;

const HEAD_CLASS = 'h-8 px-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';
const CELL_CLASS = 'px-2 py-1 text-xs';

export function TrafficStep({ data, subscriber, activeIdx, onActiveChange, onChange }: Props) {
  const p = data.profiles[activeIdx] ?? data.profiles[0];

  const patch = (patchValue: Partial<TrafficProfile>) => {
    onChange({ ...data, profiles: data.profiles.map((x, i) => (i === activeIdx ? { ...x, ...patchValue } : x)) });
  };

  const addProfile = () => {
    if (data.profiles.length >= MAX_PROFILES) return;
    const next = makeTrafficProfile(data.profiles.length, {
      attachType: p.attachType, attachRate: p.attachRate, powerOnDuration: p.powerOnDuration,
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

  // Same precedence as trafficFor() in derive.ts: a profile naming the group
  // exactly wins over "Apply to All", and among equals the first wins. So an
  // "all" profile only governs the groups no earlier profile already claims.
  const governs = (groupId: number): boolean => {
    const exact = data.profiles.findIndex(x => x.subscriberGroups === groupId);
    if (exact >= 0) return exact === activeIdx;
    return data.profiles.findIndex(x => x.subscriberGroups === 'all') === activeIdx;
  };
  const governedGroups = subscriber.groups.filter(g => governs(g.id));

  return (
    <div className="space-y-5">
      <GroupChips
        label="Traffic"
        count={data.profiles.length}
        active={activeIdx}
        onSelect={onActiveChange}
        onAdd={addProfile}
        onRemove={removeProfile}
        max={MAX_PROFILES}
        detail={i => (data.profiles[i].subscriberGroups === 'all' ? 'all groups' : `group ${data.profiles[i].subscriberGroups}`)}
      />

      <div className="wizard-cols">
        {/* Column 1 — who attaches, and how */}
        <div className="space-y-3">
          <Field
            label="Subscriber Groups" type="select" value={p.subscriberGroups}
            options={groupOptions}
            onChange={v => patch({ subscriberGroups: v === 'all' ? 'all' : Number(v) })}
            hint={<InfoHint>Which UE groups follow this attach profile. A profile naming a group exactly takes precedence over "Apply to All".</InfoHint>}
          />
          <Field
            label="Attach Type" required type="select" value={p.attachType}
            options={ATTACH_TYPES.map(t => ({ value: t, label: t }))}
            onChange={v => patch({ attachType: v })}
            hint={<InfoHint>Recorded on the test case. Simnovator compiles both types to the same schedule: UEs power on 1/attachRate seconds apart after the attach delay.</InfoHint>}
          />
        </div>

        {/* Column 2 — looping and dwell */}
        <div className="space-y-3">
          <Field
            label="Loop Profile" required type="select" value={p.loopProfile}
            options={[{ value: 'Disable', label: 'Disable' }, { value: 'Enable', label: 'Enable' }]}
            onChange={v => patch({ loopProfile: v })}
            hint={<InfoHint>Enable repeats the power-on / power-off cycle (loop_count and loop_delay on the events).</InfoHint>}
          />
          <Field
            label="Power ON Duration (sec)" required type="number" value={p.powerOnDuration} min={0}
            onChange={v => patch({ powerOnDuration: Math.max(0, v) })}
            hint={<InfoHint>0 = the UE never powers off.</InfoHint>}
          />
          {p.loopProfile === 'Enable' && (
            <>
              <Field
                label="Power OFF Duration (sec)" required type="number" value={p.powerOffDuration} min={0}
                onChange={v => patch({ powerOffDuration: Math.max(0, v) })}
                hint={<InfoHint>Seconds the UE stays off between cycles.</InfoHint>}
              />
              <Field
                label="Cycles" required type="number" value={p.loopCount} min={2}
                onChange={v => patch({ loopCount: Math.max(2, Math.round(v)) })}
                hint={<InfoHint>Total power-on cycles, including the first.</InfoHint>}
              />
            </>
          )}
        </div>

        {/* Column 3 — pacing */}
        <div className="space-y-3">
          <Field
            label="Attach Rate" required type="number" value={p.attachRate} min={0.01} step="0.01"
            onChange={v => patch({ attachRate: v })}
            hint={<InfoHint>UEs per second.</InfoHint>}
          />
          <Field
            label="Attach Delay (sec)" required type="number" value={p.attachDelay} min={0}
            onChange={v => patch({ attachDelay: Math.max(0, v) })}
            hint={<InfoHint>Before the first attach.</InfoHint>}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-foreground">Attach schedule</div>
        {governedGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            This profile governs no UE group — an earlier profile already covers the groups it names.
          </p>
        ) : (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={HEAD_CLASS}>Group</TableHead>
                  <TableHead className={HEAD_CLASS}>UE</TableHead>
                  <TableHead className={HEAD_CLASS}>Power on</TableHead>
                  <TableHead className={HEAD_CLASS}>Power off</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {governedGroups.flatMap(g => scheduleRows(p, g))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

/** The first PREVIEW_HEAD UEs and the last UE of a group, with a gap row
 *  between them when any were skipped. Small groups are listed in full. */
function scheduleRows(p: TrafficProfile, g: SubscriberGroup) {
  const count = Math.max(0, Math.floor(g.ueCount));
  const indices: Array<number | 'gap'> = count <= PREVIEW_HEAD + 1
    ? Array.from({ length: count }, (_, i) => i)
    : [...Array.from({ length: PREVIEW_HEAD }, (_, i) => i), 'gap', count - 1];

  return indices.map(i => {
    if (i === 'gap') {
      return (
        <TableRow key={`g${g.id}-gap`} className="hover:bg-transparent">
          <TableCell className={`${CELL_CLASS} text-muted-foreground`}>UE Group {g.id}</TableCell>
          <TableCell className={`${CELL_CLASS} text-muted-foreground`} colSpan={3}>… {count - PREVIEW_HEAD - 1} more</TableCell>
        </TableRow>
      );
    }
    const on = attachTime(p, i);
    const len = cycleLength(p);
    const off = len == null ? null : on + len;
    return (
      <TableRow key={`g${g.id}-${i}`}>
        <TableCell className={`${CELL_CLASS} text-muted-foreground`}>UE Group {g.id}</TableCell>
        <TableCell className={`${CELL_CLASS} font-mono`}>{i}</TableCell>
        <TableCell className={`${CELL_CLASS} font-mono`}>{formatSeconds(on)}</TableCell>
        <TableCell className={`${CELL_CLASS} font-mono`}>{off == null ? 'stays on' : formatSeconds(off)}</TableCell>
      </TableRow>
    );
  });
}

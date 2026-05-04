// modules/ueSim/components/traffic/TrafficTab.tsx
//
// Traffic tab — edits TrafficSectionData. Three groups:
//   • Sim Event Templates  — named sequences of sim_events
//   • UE → Template assignments
//   • Default traffic server (ltesim_server / iperf / custom)
//
// IMPORTANT — duration semantics
//   For power_on events the UI surfaces a `duration` field on top of
//   `start_time`. The emitter expands {power_on@start_time, duration:D}
//   into TWO Amarisoft events: power_on at start_time and power_off at
//   start_time + D. This is the only place in the codebase where that
//   contract is exposed to the user, so the inline help below is the
//   canonical explanation.

'use client';

import { useState } from 'react';
import { Plus, Trash2, Activity, Server, ListTree, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import type {
  SimEvent, SimEventType, TrafficSectionData, TrafficServerKind, TrafficTemplate,
  UeAssignment,
} from '../../types';
import type { SubscriberSectionData } from '../../types';

interface Props {
  data: TrafficSectionData;
  subscribers: SubscriberSectionData;
  onChange: (next: TrafficSectionData) => void;
}

const EVENT_TYPES: SimEventType[] = [
  'power_on', 'power_off', 'pdn_connect', 'pdn_disconnect',
  'ext_app', 'flood', 'http', 'voice', 'ping', 'handover',
];

const SERVER_KINDS: TrafficServerKind[] = ['ltesim_server', 'iperf', 'custom'];

function newEventOfType(t: SimEventType): SimEvent {
  switch (t) {
    case 'power_on':       return { event: 'power_on', start_time: 0, duration: 60 };
    case 'power_off':      return { event: 'power_off', start_time: 0 };
    case 'pdn_connect':    return { event: 'pdn_connect', start_time: 1, apn: 'internet' };
    case 'pdn_disconnect': return { event: 'pdn_disconnect', start_time: 0 };
    case 'ext_app':        return { event: 'ext_app', start_time: 0, prog: 'iperf3' };
    case 'flood':          return { event: 'flood', start_time: 0, direction: 'dl', bitrate: '100M' };
    case 'http':           return { event: 'http', start_time: 0, url: 'http://example.com' };
    case 'voice':          return { event: 'voice', start_time: 0 };
    case 'ping':           return { event: 'ping', start_time: 0, destination: '8.8.8.8' };
    case 'handover':       return { event: 'handover', start_time: 0, target_cell_id: 1 };
  }
}

export function TrafficTab({ data, subscribers, onChange }: Props) {
  const [activeTplIdx, setActiveTplIdx] = useState(0);
  const tpl = data.templates[activeTplIdx];

  const updateTpl = (idx: number, patch: Partial<TrafficTemplate>) => {
    const next = data.templates.map((t, i) => i === idx ? { ...t, ...patch } : t);
    onChange({ ...data, templates: next });
  };

  const addTpl = () => {
    const newIdx = data.templates.length;
    const tpl: TrafficTemplate = {
      id: `tpl-${Date.now()}`,
      name: 'New Template',
      events: [{ event: 'power_on', start_time: 0, duration: 60 }],
    };
    onChange({ ...data, templates: [...data.templates, tpl] });
    setActiveTplIdx(newIdx);
  };

  const removeTpl = (idx: number) => {
    if (data.templates.length <= 1) return;
    onChange({ ...data, templates: data.templates.filter((_, i) => i !== idx) });
    setActiveTplIdx(Math.max(0, Math.min(activeTplIdx, data.templates.length - 2)));
  };

  const addEvent = () => {
    if (!tpl) return;
    updateTpl(activeTplIdx, { events: [...tpl.events, newEventOfType('power_on')] });
  };

  const updateEvent = (eIdx: number, patch: Partial<SimEvent>) => {
    if (!tpl) return;
    const events = tpl.events.map((ev, i) =>
      i === eIdx ? ({ ...ev, ...patch } as SimEvent) : ev
    );
    updateTpl(activeTplIdx, { events });
  };

  const replaceEventType = (eIdx: number, t: SimEventType) => {
    if (!tpl) return;
    const cur = tpl.events[eIdx];
    const next = newEventOfType(t);
    // Preserve start_time when retyping.
    next.start_time = cur.start_time;
    const events = tpl.events.map((ev, i) => i === eIdx ? next : ev);
    updateTpl(activeTplIdx, { events });
  };

  const removeEvent = (eIdx: number) => {
    if (!tpl) return;
    updateTpl(activeTplIdx, { events: tpl.events.filter((_, i) => i !== eIdx) });
  };

  const updateAssignment = (ueId: number, patch: Partial<UeAssignment>) => {
    const exists = data.assignments.find(a => a.ue_id === ueId);
    if (exists) {
      const next = data.assignments.map(a => a.ue_id === ueId ? { ...a, ...patch } : a);
      onChange({ ...data, assignments: next });
    } else {
      const fallbackTpl = data.templates[0];
      if (!fallbackTpl) return;
      const created: UeAssignment = {
        ue_id: ueId,
        template_id: fallbackTpl.id,
        start_offset: 0,
        ...patch,
      };
      onChange({ ...data, assignments: [...data.assignments, created] });
    }
  };

  const updateServer = (patch: Partial<TrafficSectionData['server']>) => {
    onChange({ ...data, server: { ...data.server, ...patch } });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Template sidebar */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListTree className="h-4 w-4" /> Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 space-y-1">
            {data.templates.map((t, i) => (
              <div
                key={t.id}
                onClick={() => setActiveTplIdx(i)}
                className={
                  'flex items-center justify-between rounded px-2 py-1.5 cursor-pointer text-sm ' +
                  (i === activeTplIdx ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted')
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.events.length} event{t.events.length === 1 ? '' : 's'}</div>
                </div>
                {!t.builtIn && (
                  <Button
                    size="sm" variant="ghost" className="h-6 w-6 p-0"
                    onClick={e => { e.stopPropagation(); removeTpl(i); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full mt-2" onClick={addTpl}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Template
            </Button>
          </CardContent>
        </Card>

        {/* Template detail */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> Template Detail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!tpl ? (
              <div className="text-sm text-muted-foreground">No template selected.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={tpl.name}
                      onChange={e => updateTpl(activeTplIdx, { name: e.target.value })}
                      disabled={tpl.builtIn}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={tpl.description ?? ''}
                      onChange={e => updateTpl(activeTplIdx, { description: e.target.value || undefined })}
                      disabled={tpl.builtIn}
                    />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/40 border rounded p-2">
                  <strong>About duration on power_on:</strong> setting duration on a
                  power_on event causes the emitter to add a matching power_off
                  at <code className="font-mono">start_time + duration</code>.
                  Use this for "UE active for N seconds" — leave duration blank
                  if you want a manual power_off elsewhere in the template.
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wide">Events</Label>
                    <Button size="sm" variant="outline" onClick={addEvent} disabled={tpl.builtIn}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Event
                    </Button>
                  </div>
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>start_time</TableHead>
                          <TableHead>duration</TableHead>
                          <TableHead>Params</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tpl.events.map((ev, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground">{i}</TableCell>
                            <TableCell>
                              <Select
                                value={ev.event}
                                onValueChange={v => replaceEventType(i, v as SimEventType)}
                                disabled={tpl.builtIn}
                              >
                                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number" step="any"
                                value={ev.start_time}
                                onChange={e => updateEvent(i, { start_time: Number(e.target.value) } as any)}
                                className="h-8 w-24"
                                disabled={tpl.builtIn}
                              />
                            </TableCell>
                            <TableCell>
                              {ev.event === 'power_on' ? (
                                <Input
                                  type="number" step="any"
                                  value={ev.duration ?? ''}
                                  onChange={e => updateEvent(i, {
                                    duration: e.target.value === '' ? undefined : Number(e.target.value),
                                  } as any)}
                                  className="h-8 w-24"
                                  placeholder="(optional)"
                                  disabled={tpl.builtIn}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {renderParams(ev, (patch) => updateEvent(i, patch as any), tpl.builtIn ?? false)}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm" variant="ghost" className="h-7 w-7 p-0"
                                onClick={() => removeEvent(i)}
                                disabled={tpl.builtIn}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assignments + server */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4" /> UE → Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-x-auto max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UE</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Start Offset (s)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.ues.slice(0, 100).map(u => {
                    const a = data.assignments.find(x => x.ue_id === u.ue_id);
                    return (
                      <TableRow key={u.ue_id}>
                        <TableCell>
                          #{u.ue_id} <span className="text-muted-foreground font-mono ml-1">{u.imsi}</span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={a?.template_id ?? ''}
                            onValueChange={v => updateAssignment(u.ue_id, { template_id: v })}
                          >
                            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="(none)" /></SelectTrigger>
                            <SelectContent>
                              {data.templates.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number" step="any"
                            value={a?.start_offset ?? 0}
                            onChange={e => updateAssignment(u.ue_id, { start_offset: Number(e.target.value) })}
                            className="h-8 w-24"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {subscribers.ues.length > 100 && (
              <div className="text-xs text-muted-foreground mt-1">
                Showing first 100 of {subscribers.ues.length} UEs.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4" /> Default Traffic Server
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kind</Label>
                <Select value={data.server.kind} onValueChange={v => updateServer({ kind: v as TrafficServerKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVER_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Port</Label>
                <Input
                  type="number"
                  value={data.server.port}
                  onChange={e => updateServer({ port: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">IP / Host</Label>
                <Input
                  value={data.server.ip}
                  onChange={e => updateServer({ ip: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Default address (UE-side default route)</Label>
                <Input
                  value={data.default_address ?? ''}
                  onChange={e => onChange({ ...data, default_address: e.target.value || undefined })}
                  placeholder="(unset)"
                />
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {data.server.kind === 'ltesim_server' ? 'Used in IP-mode = sim' : 'Used by ext_app templates'}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Per-event-type param editor ───────────────────────────────────────────
function renderParams(ev: SimEvent, set: (patch: Partial<SimEvent>) => void, disabled: boolean) {
  switch (ev.event) {
    case 'pdn_connect':
    case 'pdn_disconnect':
      return (
        <div className="flex gap-1">
          <Input
            placeholder="apn"
            value={(ev as any).apn ?? ''}
            onChange={e => set({ apn: e.target.value || undefined } as any)}
            className="h-7 w-24" disabled={disabled}
          />
          <Input
            placeholder="type"
            value={(ev as any).pdn_type ?? ''}
            onChange={e => set({ pdn_type: (e.target.value || undefined) as any } as any)}
            className="h-7 w-20" disabled={disabled}
          />
        </div>
      );
    case 'ext_app':
      return (
        <div className="flex gap-1">
          <Input
            placeholder="prog" value={(ev as any).prog ?? ''}
            onChange={e => set({ prog: e.target.value } as any)}
            className="h-7 w-24" disabled={disabled}
          />
          <Input
            placeholder="args (space-separated)"
            value={((ev as any).args ?? []).join(' ')}
            onChange={e => set({ args: e.target.value ? e.target.value.split(/\s+/) : undefined } as any)}
            className="h-7 w-44" disabled={disabled}
          />
        </div>
      );
    case 'flood':
      return (
        <div className="flex gap-1">
          <Select
            value={(ev as any).direction}
            onValueChange={v => set({ direction: v as any } as any)}
            disabled={disabled}
          >
            <SelectTrigger className="h-7 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dl">dl</SelectItem>
              <SelectItem value="ul">ul</SelectItem>
              <SelectItem value="both">both</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="bitrate" value={(ev as any).bitrate ?? ''}
            onChange={e => set({ bitrate: e.target.value } as any)}
            className="h-7 w-24" disabled={disabled}
          />
        </div>
      );
    case 'ping':
      return (
        <div className="flex gap-1">
          <Input
            placeholder="dest" value={(ev as any).destination ?? ''}
            onChange={e => set({ destination: e.target.value } as any)}
            className="h-7 w-32" disabled={disabled}
          />
          <Input
            type="number" placeholder="count"
            value={(ev as any).count ?? ''}
            onChange={e => set({ count: e.target.value === '' ? undefined : Number(e.target.value) } as any)}
            className="h-7 w-16" disabled={disabled}
          />
        </div>
      );
    case 'http':
      return (
        <Input
          placeholder="url" value={(ev as any).url ?? ''}
          onChange={e => set({ url: e.target.value } as any)}
          className="h-7 w-72" disabled={disabled}
        />
      );
    case 'handover':
      return (
        <Input
          type="number" placeholder="target_cell_id"
          value={(ev as any).target_cell_id ?? 0}
          onChange={e => set({ target_cell_id: Number(e.target.value) } as any)}
          className="h-7 w-24" disabled={disabled}
        />
      );
    default:
      return <span className="text-muted-foreground">—</span>;
  }
}

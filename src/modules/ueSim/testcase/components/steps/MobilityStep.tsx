// Step 5 — Mobility.
//
// Only meaningful when the Cell step turned mobility on; otherwise a notice
// with a shortcut back. Two columns like Simnovator: the channel on the
// left (one fading profile applied to every cell), positions on the right
// (one row per cell antenna, one per UE group with speed and heading). A
// small read-only map underneath shows the geometry the numbers describe.
//
// cellPositions / groups in the step data can lag the Cell and Subscriber
// steps (a cell added after this step was last edited has no entry). The
// tables render the reconciled lists and every edit writes them back whole,
// so stale entries never survive a save.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { makeGroupMobility } from '../../defaults';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  CellPosition, CellStepData, ChannelModel, GroupMobility, MobilityStepData, SubscriberStepData, TripType,
} from '../../types';

interface Props {
  data: MobilityStepData;
  cell: CellStepData;
  subscriber: SubscriberStepData;
  onChange: (next: MobilityStepData) => void;
  onEnableMobility: () => void;
}

const CHANNEL_MODELS: ChannelModel[] = ['None', 'AWGN'];
const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: 'stationary', label: 'Stationary' },
  { value: 'oneWay', label: 'One way' },
  { value: 'roundTrip', label: 'Round trip' },
];

const TH = 'h-8 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';

/** One position per cell that exists now, in cell order: a cell added since
 *  the last edit starts at the origin, a removed one is dropped. */
function reconcileCells(cells: CellStepData['cells'], positions: CellPosition[]): CellPosition[] {
  return cells.map(c => positions.find(p => p.cellId === c.id) ?? { cellId: c.id, x: 0, y: 0 });
}

function reconcileGroups(groups: SubscriberStepData['groups'], mobility: GroupMobility[]): GroupMobility[] {
  return groups.map(g => mobility.find(m => m.groupId === g.id) ?? makeGroupMobility(g.id));
}

export function MobilityStep({ data, cell, subscriber, onChange, onEnableMobility }: Props) {
  const cellPositions = useMemo(
    () => reconcileCells(cell.cells, data.cellPositions ?? []),
    [cell.cells, data.cellPositions],
  );
  const groups = useMemo(
    () => reconcileGroups(subscriber.groups, data.groups ?? []),
    [subscriber.groups, data.groups],
  );

  if (!cell.mobility) {
    return (
      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Mobility is off for this test case. The UEs sit at a fixed, ideal position and the channel simulator is not used.
        </p>
        <Button size="sm" variant="outline" onClick={onEnableMobility}>Enable mobility</Button>
      </div>
    );
  }

  // Every write carries the reconciled lists so the saved arrays always
  // match the cells and groups that exist.
  const commit = (patch: Partial<MobilityStepData>) => onChange({ ...data, cellPositions, groups, ...patch });

  const patchCell = (cellId: number, p: Partial<CellPosition>) =>
    commit({ cellPositions: cellPositions.map(c => (c.cellId === cellId ? { ...c, ...p } : c)) });

  const patchGroup = (groupId: number, p: Partial<GroupMobility>) =>
    commit({ groups: groups.map(g => (g.groupId === groupId ? { ...g, ...p } : g)) });


  return (
    <div className="space-y-5">
      <div className="wizard-cols">
        {/* Left column — channel */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground">Channel</div>
          <Field
            label="Channel Model" required type="select" value={data.channelModel}
            options={CHANNEL_MODELS.map(m => ({ value: m, label: m }))}
            onChange={v => commit({ channelModel: v as ChannelModel })}
            hint={<InfoHint>None keeps the direct connection. AWGN is the channel simulator lteue provides: noise plus distance path loss between each UE position and the cell antenna.</InfoHint>}
          />
          <Field
            label="Doppler (Hz)" type="number" value={data.dopplerHz} min={0} max={2000}
            disabled={data.channelModel === 'None'}
            onChange={v => commit({ dopplerHz: Math.max(0, v) })}
            hint={<InfoHint>Recorded on the test case for the report; the AWGN model has no Doppler setting.</InfoHint>}
          />
          <Field
            label="Noise Density (dBm/Hz)" type="number" value={data.noiseSpd} min={-200} max={-100}
            onChange={v => commit({ noiseSpd: v })}
            hint={<InfoHint>Noise spectral density applied to every UE (noise_spd). -174 dBm/Hz is thermal noise.</InfoHint>}
          />
          <Field
            label="Ref Signal Power (dBm)" type="number" value={data.refSignalPower} min={-140} max={0}
            onChange={v => commit({ refSignalPower: v })}
            hint={<InfoHint>cell transmit power seen at the UE reference point</InfoHint>}
          />
          <Field
            label="UL Power Attenuation (dB)" type="number" value={data.ulPowerAttenuation} min={0} max={100}
            onChange={v => commit({ ulPowerAttenuation: v })}
            hint={<InfoHint>Extra path loss applied to the uplink only.</InfoHint>}
          />
        </div>

        {/* Right column — positions */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground">Positions</div>
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TH}>Entity</TableHead>
                  <TableHead className={TH}>X (m)</TableHead>
                  <TableHead className={TH}>Y (m)</TableHead>
                  <TableHead className={TH}>Trip</TableHead>
                  <TableHead className={TH}>Speed (km/h)</TableHead>
                  <TableHead className={TH}>Direction (°)</TableHead>
                  <TableHead className={TH}>Distance (m)</TableHead>
                  <TableHead className={TH}>Start (s)</TableHead>
                  <TableHead className={TH}>Duration (s)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cellPositions.map(c => (
                  <TableRow key={`cell-${c.cellId}`}>
                    <TableCell className="py-1 text-xs whitespace-nowrap">Cell {c.cellId}</TableCell>
                    <TableCell className="py-1"><NumCell value={c.x} onCommit={x => patchCell(c.cellId, { x })} /></TableCell>
                    <TableCell className="py-1"><NumCell value={c.y} onCommit={y => patchCell(c.cellId, { y })} /></TableCell>
                    <TableCell className="py-1 text-xs text-muted-foreground/60" colSpan={6}>fixed antenna</TableCell>
                  </TableRow>
                ))}
                {groups.map(g => {
                  const count = subscriber.groups.find(s => s.id === g.groupId)?.ueCount ?? 0;
                  return (
                    <TableRow key={`group-${g.groupId}`}>
                      <TableCell className="py-1 text-xs whitespace-nowrap">
                        UE Group {g.groupId} <span className="text-muted-foreground">· {count} UE</span>
                      </TableCell>
                      <TableCell className="py-1"><NumCell value={g.x} onCommit={x => patchGroup(g.groupId, { x })} /></TableCell>
                      <TableCell className="py-1"><NumCell value={g.y} onCommit={y => patchGroup(g.groupId, { y })} /></TableCell>
                      <TableCell className="py-1">
                        <Select value={g.tripType} onValueChange={v => patchGroup(g.groupId, { tripType: v as TripType })}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TRIP_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-1"><NumCell value={g.speedKmh} min={0} onCommit={v => patchGroup(g.groupId, { speedKmh: Math.max(0, v) })} /></TableCell>
                      <TableCell className="py-1"><NumCell value={g.direction} min={0} max={360} onCommit={v => patchGroup(g.groupId, { direction: v })} /></TableCell>
                      <TableCell className="py-1"><NumCell value={g.distance} min={1} onCommit={v => patchGroup(g.groupId, { distance: Math.max(1, v) })} /></TableCell>
                      <TableCell className="py-1"><NumCell value={g.startDelay} min={0} onCommit={v => patchGroup(g.groupId, { startDelay: Math.max(0, v) })} /></TableCell>
                      <TableCell className="py-1"><NumCell value={g.duration} min={1} onCommit={v => patchGroup(g.groupId, { duration: Math.max(1, v) })} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Direction: 0° = +x, 90° = +y. One way: the group moves <em>distance</em> metres and stops. Round trip: it shuttles out and back for <em>duration</em> seconds, then stops (ue_move events). Speed is in km/h as lteue expects.
          </p>
        </div>
      </div>

      <MobilityMap cells={cellPositions} groups={groups} />
    </div>
  );
}

// ── Number cell ──────────────────────────────────────────────────────────
// Keeps the text the user is typing separate from the committed number so
// "-" or "" mid-edit does not snap back to 0 (which a plain controlled
// number input does, and which makes negative coordinates untypeable).

function NumCell({ value, onCommit, min, max }: {
  value: number; onCommit: (n: number) => void; min?: number; max?: number;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);
  return (
    <Input
      type="number"
      step="any"
      min={min}
      max={max}
      className="h-7 w-20 text-xs"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onCommit(n);
      }}
    />
  );
}

// ── Map ──────────────────────────────────────────────────────────────────
// Plain canvas, read-only. Origin at the centre, +x right, +y up. Scaled so
// every point plus a 20 % margin fits, never tighter than ±50 m.

const MAP_W = 400;
const MAP_H = 260;
const MAP_PAD = 18; // px kept clear at the edges so labels stay inside
const RING_STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];

function fitMap(cells: CellPosition[], groups: GroupMobility[]) {
  let maxX = 0;
  let maxY = 0;
  for (const c of cells) { maxX = Math.max(maxX, Math.abs(c.x)); maxY = Math.max(maxY, Math.abs(c.y)); }
  for (const g of groups) { maxX = Math.max(maxX, Math.abs(g.x)); maxY = Math.max(maxY, Math.abs(g.y)); }
  const halfX = Math.max(50, maxX * 1.2);
  const halfY = Math.max(50, maxY * 1.2);
  const scale = Math.min((MAP_W / 2 - MAP_PAD) / halfX, (MAP_H / 2 - MAP_PAD) / halfY); // px per metre
  const reach = Math.max(halfX, halfY);
  const ring = RING_STEPS.find(s => reach / s <= 4) ?? RING_STEPS[RING_STEPS.length - 1];
  return { scale, ring, reach };
}

function MobilityMap({ cells, groups }: { cells: CellPosition[]; groups: GroupMobility[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const fit = useMemo(() => fitMap(cells, groups), [cells, groups]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MAP_W * dpr;
    canvas.height = MAP_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MAP_W, MAP_H);

    const { scale, ring } = fit;
    const ox = MAP_W / 2;
    const oy = MAP_H / 2;
    const toCanvas = (x: number, y: number): [number, number] => [ox + x * scale, oy - y * scale];
    const font = '10px ui-sans-serif, system-ui, sans-serif';

    // Range rings every `ring` metres, out to the canvas edge.
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    const maxR = Math.hypot(MAP_W / 2, MAP_H / 2) / scale;
    for (let r = ring; r <= maxR; r += ring) {
      ctx.beginPath();
      ctx.arc(ox, oy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Axes.
    ctx.strokeStyle = '#9ca3af';
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(MAP_W, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, MAP_H); ctx.stroke();
    ctx.fillStyle = '#6b7280';
    ctx.font = font;
    ctx.fillText(`${ring} m`, ox + ring * scale + 3, oy - 3);

    // Cells — orange triangles.
    for (const c of cells) {
      const [cx, cy] = toCanvas(c.x, c.y);
      ctx.fillStyle = '#ec691f';
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx - 7, cy + 5);
      ctx.lineTo(cx + 7, cy + 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9a3412';
      ctx.font = font;
      ctx.fillText(`C${c.cellId}`, cx + 9, cy - 4);
    }

    // UE groups — blue circles, arrow when moving.
    for (const g of groups) {
      const [cx, cy] = toCanvas(g.x, g.y);
      if (g.speedKmh > 0 && g.tripType !== 'stationary') {
        const rad = (g.direction * Math.PI) / 180;
        const len = 18;
        const ex = cx + Math.cos(rad) * len;
        const ey = cy - Math.sin(rad) * len; // canvas y points down
        ctx.strokeStyle = '#1d4ed8';
        ctx.fillStyle = '#1d4ed8';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
        // Arrow head.
        const a = Math.atan2(ey - cy, ex - cx);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 6 * Math.cos(a - Math.PI / 6), ey - 6 * Math.sin(a - Math.PI / 6));
        ctx.lineTo(ex - 6 * Math.cos(a + Math.PI / 6), ey - 6 * Math.sin(a + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#2563eb';
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e3a8a';
      ctx.font = font;
      ctx.fillText(`G${g.groupId}`, cx + 8, cy + 4);
    }
  }, [cells, groups, fit]);

  return (
    <div className="space-y-1.5">
      <canvas
        ref={ref}
        width={MAP_W}
        height={MAP_H}
        className="rounded-md border border-border bg-background max-w-full"
        style={{ width: MAP_W, height: MAP_H }}
        aria-label="Map of cell and UE group positions"
      />
      <p className="text-[11px] text-muted-foreground">
        <span className="inline-block w-2 h-2 rounded-sm align-middle mr-1" style={{ background: '#ec691f' }} />cells
        <span className="inline-block w-2 h-2 rounded-full align-middle ml-3 mr-1" style={{ background: '#2563eb' }} />UE groups
        <span className="ml-3">Origin at the centre, rings every {fit.ring} m, arrows show heading for moving groups.</span>
      </p>
    </div>
  );
}

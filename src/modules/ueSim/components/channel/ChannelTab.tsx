// modules/ueSim/components/channel/ChannelTab.tsx
//
// Channel Modelling tab — three groups:
//   1. Master switches             — channel_sim, delay_sim, map size
//   2. Per-cell propagation        — DL/UL fading model, doppler, ref power,
//                                    + antenna_x / antenna_y on the map
//   3. UE Mobility                 — speed/direction/position table AND the
//                                    visual map (canvas) where antennas are
//                                    triangles and UEs are coloured dots,
//                                    both draggable.
//
// Visual map design notes
//   • The map is square. Real-world map_extent_m metres = full canvas width.
//     Origin (0,0) sits at canvas centre with +x right, +y up (world axes).
//   • Cells are drawn as red triangles, UEs as blue circles labelled with
//     ue_id. Both are draggable with the mouse — drop = commit position.
//   • The canvas is plain HTML5 <canvas>, no extra deps, redraws on every
//     state change in a useEffect. A single hit-test for nearest object
//     within 14px decides what's being dragged.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, MapIcon, Radio, Activity } from 'lucide-react';
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
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';

import type {
  CellSectionData, ChannelSectionData, ChannelType, PerCellChannel,
  SubscriberSectionData, UeMobility,
} from '../../types';

interface Props {
  data: ChannelSectionData;
  cellData: CellSectionData;
  subscribers: SubscriberSectionData;
  onChange: (next: ChannelSectionData) => void;
}

const CHANNEL_TYPES: ChannelType[] = [
  'awgn', 'rayleigh', 'epa', 'eva', 'etu',
  'tdl_a', 'tdl_b', 'tdl_c', 'custom',
];

const HIT_RADIUS_PX = 14;

function totalCellCount(cell: CellSectionData): number {
  return cell.cell_groups.reduce((acc, g) => acc + g.cells.length, 0);
}

export function ChannelTab({ data, cellData, subscribers, onChange }: Props) {
  // ─── Reconcile collections so per_cell / mobility match cells / UEs ────
  // We never mutate cell or subscriber data here — only ensure the
  // channel section has matching entries.
  useEffect(() => {
    const numCells = totalCellCount(cellData);
    const ueIds = subscribers.ues.map(u => u.ue_id);

    const havePer = data.per_cell.map(p => p.cell_index);
    const missingPer: number[] = [];
    for (let i = 0; i < numCells; i++) {
      if (!havePer.includes(i)) missingPer.push(i);
    }

    const haveMob = data.mobility.map(m => m.ue_id);
    const missingMob = ueIds.filter(id => !haveMob.includes(id));
    const extraMob = data.mobility.filter(m => !ueIds.includes(m.ue_id));

    if (missingPer.length === 0 && missingMob.length === 0 && extraMob.length === 0) return;

    const per_cell = [...data.per_cell];
    missingPer.forEach((idx, i) => per_cell.push({
      cell_index: idx,
      dl_type: 'awgn',
      ul_type: 'awgn',
      antenna_x: idx * 100,
      antenna_y: 0,
    }));

    let mobility: UeMobility[] = data.mobility.filter(m => ueIds.includes(m.ue_id));
    missingMob.forEach((id, i) => mobility.push({
      ue_id: id,
      position: [(i % 8) * 30 - 105, Math.floor(i / 8) * 30 - 30, 0],
      speed: 0,
      direction: 0,
    }));

    onChange({ ...data, per_cell, mobility });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellData, subscribers]);

  const update = (patch: Partial<ChannelSectionData>) => onChange({ ...data, ...patch });

  const updatePerCell = (idx: number, patch: Partial<PerCellChannel>) => {
    update({ per_cell: data.per_cell.map((p, i) => i === idx ? { ...p, ...patch } : p) });
  };

  const updateMobility = (ueId: number, patch: Partial<UeMobility>) => {
    update({ mobility: data.mobility.map(m => m.ue_id === ueId ? { ...m, ...patch } : m) });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4" /> Master Switches
          </CardTitle>
          <CardDescription className="text-xs">
            Disable channel_sim entirely for ideal-channel tests. Map extent
            controls the visible area on the map below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">channel_sim</Label>
            <div className="h-9 flex items-center">
              <Switch checked={data.channel_sim} onCheckedChange={v => update({ channel_sim: v })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">delay_sim</Label>
            <div className="h-9 flex items-center">
              <Switch checked={data.delay_sim} onCheckedChange={v => update({ delay_sim: v })} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Map extent (metres, square)</Label>
            <Input
              type="number" min={50} max={50000}
              value={data.map_extent_m}
              onChange={e => update({ map_extent_m: Number(e.target.value) || 500 })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapIcon className="h-4 w-4" /> Visual Map
          </CardTitle>
          <CardDescription className="text-xs">
            Drag red triangles to position cell antennas; drag blue circles
            to move UEs. Coordinates are in metres from the origin (centre).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelMap
            extent={data.map_extent_m}
            cells={data.per_cell}
            ues={data.mobility}
            onCellMove={(idx, x, y) => updatePerCell(idx, { antenna_x: x, antenna_y: y })}
            onUeMove={(ueId, x, y) => {
              const cur = data.mobility.find(m => m.ue_id === ueId);
              if (!cur) return;
              updateMobility(ueId, { position: [x, y, cur.position[2]] });
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4" /> Per-Cell Propagation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cell</TableHead>
                  <TableHead>DL Model</TableHead>
                  <TableHead>UL Model</TableHead>
                  <TableHead>Doppler (Hz)</TableHead>
                  <TableHead>Ref Power (dBm)</TableHead>
                  <TableHead>UL Atten (dB)</TableHead>
                  <TableHead>Antenna X (m)</TableHead>
                  <TableHead>Antenna Y (m)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.per_cell.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{p.cell_index}</TableCell>
                    <TableCell>
                      <Select value={p.dl_type} onValueChange={v => updatePerCell(i, { dl_type: v as ChannelType })}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHANNEL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={p.ul_type} onValueChange={v => updatePerCell(i, { ul_type: v as ChannelType })}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHANNEL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any"
                        value={p.doppler_hz ?? ''}
                        onChange={e => updatePerCell(i, { doppler_hz: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any"
                        value={p.ref_signal_power_dbm ?? ''}
                        onChange={e => updatePerCell(i, { ref_signal_power_dbm: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any"
                        value={p.ul_power_attenuation_db ?? ''}
                        onChange={e => updatePerCell(i, { ul_power_attenuation_db: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any"
                        value={p.antenna_x ?? 0}
                        onChange={e => updatePerCell(i, { antenna_x: Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any"
                        value={p.antenna_y ?? 0}
                        onChange={e => updatePerCell(i, { antenna_y: Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> UE Mobility
          </CardTitle>
          <CardDescription className="text-xs">
            x/y/z position in metres. speed=0 means static. Direction is degrees
            (0 = +x, 90 = +y).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UE</TableHead>
                  <TableHead>X (m)</TableHead>
                  <TableHead>Y (m)</TableHead>
                  <TableHead>Z (m)</TableHead>
                  <TableHead>Speed (km/h)</TableHead>
                  <TableHead>Direction (°)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mobility.map(m => (
                  <TableRow key={m.ue_id}>
                    <TableCell className="text-muted-foreground">{m.ue_id}</TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any"
                        value={m.position[0]}
                        onChange={e => updateMobility(m.ue_id, { position: [Number(e.target.value), m.position[1], m.position[2]] })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any"
                        value={m.position[1]}
                        onChange={e => updateMobility(m.ue_id, { position: [m.position[0], Number(e.target.value), m.position[2]] })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any"
                        value={m.position[2]}
                        onChange={e => updateMobility(m.ue_id, { position: [m.position[0], m.position[1], Number(e.target.value)] })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any"
                        value={m.speed}
                        onChange={e => updateMobility(m.ue_id, { speed: Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any"
                        value={m.direction}
                        onChange={e => updateMobility(m.ue_id, { direction: Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Visual map — plain canvas, drag-and-drop
// ──────────────────────────────────────────────────────────────────────────

interface ChannelMapProps {
  extent: number;
  cells: PerCellChannel[];
  ues: UeMobility[];
  onCellMove: (cell_index: number, x: number, y: number) => void;
  onUeMove: (ue_id: number, x: number, y: number) => void;
}

interface DragHandle {
  kind: 'cell' | 'ue';
  id: number;
}

const CANVAS_PX = 480;

function ChannelMap({ extent, cells, ues, onCellMove, onUeMove }: ChannelMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dragging, setDragging] = useState<DragHandle | null>(null);

  // World ↔ canvas conversions.  World origin at canvas centre.
  const w2c = useMemo(() => {
    const half = CANVAS_PX / 2;
    const scale = CANVAS_PX / extent; // px per metre
    return {
      toCanvas: (wx: number, wy: number): [number, number] => [half + wx * scale, half - wy * scale],
      toWorld:  (cx: number, cy: number): [number, number] => [(cx - half) / scale, (half - cy) / scale],
    };
  }, [extent]);

  const draw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    // Clear.
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);

    // Background grid (every extent/10 metres).
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const step = CANVAS_PX / 10;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0); ctx.lineTo(i * step, CANVAS_PX); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step); ctx.lineTo(CANVAS_PX, i * step); ctx.stroke();
    }

    // Axes.
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_PX / 2); ctx.lineTo(CANVAS_PX, CANVAS_PX / 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CANVAS_PX / 2, 0); ctx.lineTo(CANVAS_PX / 2, CANVAS_PX); ctx.stroke();

    // Coverage circles (50m, 250m, full extent/2).
    ctx.strokeStyle = '#cbd5e1';
    ctx.setLineDash([4, 4]);
    [extent / 8, extent / 4, extent / 2].forEach(rad => {
      const px = (rad / extent) * CANVAS_PX;
      ctx.beginPath();
      ctx.arc(CANVAS_PX / 2, CANVAS_PX / 2, px, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Cells (red triangles).
    cells.forEach(cell => {
      const [cx, cy] = w2c.toCanvas(cell.antenna_x ?? 0, cell.antenna_y ?? 0);
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx - 8, cy + 6);
      ctx.lineTo(cx + 8, cy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7f1d1d';
      ctx.font = '11px ui-sans-serif, sans-serif';
      ctx.fillText(`C${cell.cell_index}`, cx + 10, cy - 4);
    });

    // UEs (blue dots).
    ues.forEach(ue => {
      const [cx, cy] = w2c.toCanvas(ue.position[0], ue.position[1]);
      ctx.fillStyle = '#2563eb';
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Velocity arrow if speed > 0.
      if (ue.speed > 0) {
        const rad = (ue.direction * Math.PI) / 180;
        const dx = Math.cos(rad) * 14;
        const dy = -Math.sin(rad) * 14; // canvas y is flipped
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + dx, cy + dy);
        ctx.stroke();
      }
      ctx.fillStyle = '#1e3a8a';
      ctx.font = '11px ui-sans-serif, sans-serif';
      ctx.fillText(`U${ue.ue_id}`, cx + 8, cy + 4);
    });

    // Origin label.
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px ui-sans-serif, sans-serif';
    ctx.fillText('(0,0)', CANVAS_PX / 2 + 4, CANVAS_PX / 2 - 4);
  };

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extent, cells, ues]);

  const findHit = (canvasX: number, canvasY: number): DragHandle | null => {
    let best: { handle: DragHandle; dist: number } | null = null;
    for (const cell of cells) {
      const [cx, cy] = w2c.toCanvas(cell.antenna_x ?? 0, cell.antenna_y ?? 0);
      const d = Math.hypot(cx - canvasX, cy - canvasY);
      if (d <= HIT_RADIUS_PX && (!best || d < best.dist)) {
        best = { handle: { kind: 'cell', id: cell.cell_index }, dist: d };
      }
    }
    for (const ue of ues) {
      const [cx, cy] = w2c.toCanvas(ue.position[0], ue.position[1]);
      const d = Math.hypot(cx - canvasX, cy - canvasY);
      if (d <= HIT_RADIUS_PX && (!best || d < best.dist)) {
        best = { handle: { kind: 'ue', id: ue.ue_id }, dist: d };
      }
    }
    return best?.handle ?? null;
  };

  const eventCoords = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const [x, y] = eventCoords(e);
    const hit = findHit(x, y);
    if (hit) setDragging(hit);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const [cx, cy] = eventCoords(e);
    const [wx, wy] = w2c.toWorld(cx, cy);
    if (dragging.kind === 'cell') onCellMove(dragging.id, round(wx), round(wy));
    else                          onUeMove(dragging.id, round(wx), round(wy));
  };

  const onMouseUp = () => setDragging(null);

  const cursor = dragging ? 'grabbing' : 'crosshair';

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_PX}
        height={CANVAS_PX}
        className="border rounded-md"
        style={{ width: CANVAS_PX, height: CANVAS_PX, cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
      <div className="text-xs text-muted-foreground">
        Map: {extent}m × {extent}m. Each cell shows on the table below — drag
        them on the map or edit numbers directly.
      </div>
    </div>
  );
}

function round(n: number): number {
  // Snap to 1m. Avoids drift while dragging.
  return Math.round(n);
}

// modules/ueSim/components/cell/CellTab.tsx
//
// Cell tab — edits CellSectionData. Two horizontally-arranged groups:
//   • Cell Groups (sidebar list)        — pick a group to drill into
//   • Cells (table on the right)        — rf_port, BW, ARFCN, antennas, SCS, TDD
//
// Custom Bands is exposed as a small bottom panel because most users never
// touch it.
//
// The component is fully controlled — it owns no local copy of `data` beyond
// React state needed for in-flight editing of free-form fields. It commits
// every change to the parent via onChange.

'use client';

import { useState } from 'react';
import { Plus, Trash2, Layers, Wifi } from 'lucide-react';
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

import type {
  CellGroupSpec, CellGroupType, CellSectionData, CellSpec, CustomBandSpec,
} from '../../types';

interface Props {
  data: CellSectionData;
  onChange: (next: CellSectionData) => void;
}

const GROUP_TYPES: CellGroupType[] = ['lte', 'nr', 'catm', 'nbiot'];

function emptyCell(rat: CellGroupType): CellSpec {
  if (rat === 'nr') {
    return {
      rf_port: 0,
      bandwidth: 100,
      dl_nr_arfcn: 643000,
      n_antenna_dl: 2,
      n_antenna_ul: 2,
      scs: 30,
      ssb_pos_bitmap: '10000000',
    };
  }
  if (rat === 'lte') {
    return { rf_port: 0, bandwidth: 20, dl_earfcn: 3300, n_antenna_dl: 2, n_antenna_ul: 1 };
  }
  if (rat === 'catm') {
    return { rf_port: 0, bandwidth: 1.4, dl_earfcn: 6300, n_antenna_dl: 1, n_antenna_ul: 1 };
  }
  return { rf_port: 0, bandwidth: 0.2, dl_earfcn: 6300, n_antenna_dl: 1, n_antenna_ul: 1 };
}

function emptyGroup(rat: CellGroupType): CellGroupSpec {
  return { group_type: rat, multi_ue: true, cells: [emptyCell(rat)] };
}

export function CellTab({ data, onChange }: Props) {
  const [activeGroup, setActiveGroup] = useState(0);
  const cur = data.cell_groups[activeGroup];

  const updateGroup = (idx: number, patch: Partial<CellGroupSpec>) => {
    const next = [...data.cell_groups];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...data, cell_groups: next });
  };

  const addGroup = () => {
    const newIdx = data.cell_groups.length;
    onChange({ ...data, cell_groups: [...data.cell_groups, emptyGroup('nr')] });
    setActiveGroup(newIdx);
  };

  const removeGroup = (idx: number) => {
    if (data.cell_groups.length <= 1) return;
    const next = data.cell_groups.filter((_, i) => i !== idx);
    onChange({ ...data, cell_groups: next });
    setActiveGroup(Math.max(0, Math.min(activeGroup, next.length - 1)));
  };

  const updateCell = (cellIdx: number, patch: Partial<CellSpec>) => {
    if (!cur) return;
    const cells = cur.cells.map((c, i) => i === cellIdx ? { ...c, ...patch } : c);
    updateGroup(activeGroup, { cells });
  };

  const addCell = () => {
    if (!cur) return;
    updateGroup(activeGroup, { cells: [...cur.cells, emptyCell(cur.group_type)] });
  };

  const removeCell = (cellIdx: number) => {
    if (!cur || cur.cells.length <= 1) return;
    updateGroup(activeGroup, { cells: cur.cells.filter((_, i) => i !== cellIdx) });
  };

  const updateBands = (next: CustomBandSpec[]) => {
    onChange({ ...data, bands: next });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* ── Cell Groups list ── */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" /> Cell Groups
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 space-y-1">
            {data.cell_groups.map((g, i) => (
              <div
                key={i}
                onClick={() => setActiveGroup(i)}
                className={
                  'flex items-center justify-between rounded px-2 py-1.5 cursor-pointer text-sm ' +
                  (i === activeGroup ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted')
                }
              >
                <span>
                  <span className="uppercase font-mono text-xs mr-2">{g.group_type}</span>
                  <span className="text-muted-foreground">{g.cells.length} cell{g.cells.length === 1 ? '' : 's'}</span>
                </span>
                <Button
                  size="sm" variant="ghost" className="h-6 w-6 p-0"
                  onClick={(e) => { e.stopPropagation(); removeGroup(i); }}
                  disabled={data.cell_groups.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full mt-2" onClick={addGroup}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Group
            </Button>
          </CardContent>
        </Card>

        {/* ── Group detail ── */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wifi className="h-4 w-4" /> Group Detail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!cur ? (
              <div className="text-sm text-muted-foreground">No group selected.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">RAT</Label>
                    <Select
                      value={cur.group_type}
                      onValueChange={v => updateGroup(activeGroup, {
                        group_type: v as CellGroupType,
                        cells: cur.cells.map(c => ({ ...emptyCell(v as CellGroupType), ...c })),
                      })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GROUP_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Multi-UE</Label>
                    <div className="h-9 flex items-center">
                      <Switch
                        checked={cur.multi_ue}
                        onCheckedChange={v => updateGroup(activeGroup, { multi_ue: v })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Multi-UE Type</Label>
                    <Input
                      value={cur.multi_ue_type ?? ''}
                      onChange={e => updateGroup(activeGroup, { multi_ue_type: e.target.value || undefined })}
                      placeholder="(default)"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPU cores</Label>
                    <Input
                      value={cur.cpu_core_list?.join(',') ?? ''}
                      onChange={e => {
                        const raw = e.target.value.trim();
                        if (!raw) return updateGroup(activeGroup, { cpu_core_list: undefined });
                        const list = raw.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
                        updateGroup(activeGroup, { cpu_core_list: list });
                      }}
                      placeholder="e.g. 2,3,4"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wide">Cells</Label>
                    <Button size="sm" variant="outline" onClick={addCell}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Cell
                    </Button>
                  </div>
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>RF Port</TableHead>
                          <TableHead>BW (MHz)</TableHead>
                          <TableHead>{cur.group_type === 'nr' ? 'DL ARFCN' : 'DL EARFCN'}</TableHead>
                          <TableHead>DL Ant</TableHead>
                          <TableHead>UL Ant</TableHead>
                          {cur.group_type === 'nr' && <TableHead>SCS</TableHead>}
                          {cur.group_type === 'nr' && <TableHead>SSB Bitmap</TableHead>}
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cur.cells.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground">{i}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={c.rf_port}
                                onChange={e => updateCell(i, { rf_port: Number(e.target.value) })}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number" step="any"
                                value={c.bandwidth}
                                onChange={e => updateCell(i, { bandwidth: Number(e.target.value) })}
                                className="h-8 w-24"
                              />
                            </TableCell>
                            <TableCell>
                              {cur.group_type === 'nr' ? (
                                <Input
                                  type="number"
                                  value={c.dl_nr_arfcn ?? ''}
                                  onChange={e => updateCell(i, { dl_nr_arfcn: e.target.value === '' ? undefined : Number(e.target.value) })}
                                  className="h-8 w-28"
                                />
                              ) : (
                                <Input
                                  type="number"
                                  value={c.dl_earfcn ?? ''}
                                  onChange={e => updateCell(i, { dl_earfcn: e.target.value === '' ? undefined : Number(e.target.value) })}
                                  className="h-8 w-28"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={c.n_antenna_dl}
                                onChange={e => updateCell(i, { n_antenna_dl: Number(e.target.value) })}
                                className="h-8 w-16"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={c.n_antenna_ul}
                                onChange={e => updateCell(i, { n_antenna_ul: Number(e.target.value) })}
                                className="h-8 w-16"
                              />
                            </TableCell>
                            {cur.group_type === 'nr' && (
                              <TableCell>
                                <Input
                                  type="number"
                                  value={c.scs ?? ''}
                                  onChange={e => updateCell(i, { scs: e.target.value === '' ? undefined : Number(e.target.value) })}
                                  className="h-8 w-16"
                                />
                              </TableCell>
                            )}
                            {cur.group_type === 'nr' && (
                              <TableCell>
                                <Input
                                  value={c.ssb_pos_bitmap ?? ''}
                                  onChange={e => updateCell(i, { ssb_pos_bitmap: e.target.value || undefined })}
                                  className="h-8 w-28 font-mono"
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <Button
                                size="sm" variant="ghost" className="h-7 w-7 p-0"
                                onClick={() => removeCell(i)}
                                disabled={cur.cells.length <= 1}
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

      {/* ── Custom bands ── */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Custom Bands (advanced)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Band</TableHead>
                  <TableHead>DL Low</TableHead>
                  <TableHead>DL High</TableHead>
                  <TableHead>UL Low</TableHead>
                  <TableHead>UL High</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.bands ?? []).map((b, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input type="number" value={b.band} onChange={e => {
                        const next = [...(data.bands ?? [])];
                        next[i] = { ...b, band: Number(e.target.value) };
                        updateBands(next);
                      }} className="h-8 w-20" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={b.dl_low} onChange={e => {
                        const next = [...(data.bands ?? [])];
                        next[i] = { ...b, dl_low: Number(e.target.value) };
                        updateBands(next);
                      }} className="h-8 w-28" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={b.dl_high} onChange={e => {
                        const next = [...(data.bands ?? [])];
                        next[i] = { ...b, dl_high: Number(e.target.value) };
                        updateBands(next);
                      }} className="h-8 w-28" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={b.ul_low} onChange={e => {
                        const next = [...(data.bands ?? [])];
                        next[i] = { ...b, ul_low: Number(e.target.value) };
                        updateBands(next);
                      }} className="h-8 w-28" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={b.ul_high} onChange={e => {
                        const next = [...(data.bands ?? [])];
                        next[i] = { ...b, ul_high: Number(e.target.value) };
                        updateBands(next);
                      }} className="h-8 w-28" />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => updateBands((data.bands ?? []).filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            size="sm" variant="outline" className="mt-2"
            onClick={() => updateBands([
              ...(data.bands ?? []),
              { band: 0, dl_low: 0, dl_high: 0, ul_low: 0, ul_high: 0 },
            ])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Band
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

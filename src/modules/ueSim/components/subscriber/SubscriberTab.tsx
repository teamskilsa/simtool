// modules/ueSim/components/subscriber/SubscriberTab.tsx
//
// Subscriber tab — edits SubscriberSectionData. Two groups:
//   • Defaults    — values applied to bulk-added UEs
//   • UE Pool     — a virtualised-ish table (renders first 100 with a
//                    "show more" button) of imsi/K/algo/category/release
//
// Bulk add uses string-arithmetic IMSI increment so we don't lose the
// leading-zeros + 15-digit IMSI structure.

'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, Users, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';

import type {
  SimAlgorithm, SubscriberDefaults, SubscriberEntry, SubscriberSectionData,
} from '../../types';

interface Props {
  data: SubscriberSectionData;
  onChange: (next: SubscriberSectionData) => void;
}

const ALGOS: SimAlgorithm[] = ['xor', 'milenage', 'tuak'];

/**
 * Increment an IMSI by 1 using string arithmetic (preserves digit width).
 * "001010000000099" → "001010000000100"
 */
export function incrementImsi(imsi: string): string {
  const digits = imsi.replace(/\D/g, '');
  if (!digits) return imsi;
  const arr = digits.split('').map(d => parseInt(d, 10));
  let carry = 1;
  for (let i = arr.length - 1; i >= 0 && carry; i--) {
    const sum = arr[i] + carry;
    arr[i] = sum % 10;
    carry = Math.floor(sum / 10);
  }
  if (carry) arr.unshift(carry);
  return arr.join('');
}

const RENDER_CAP = 100;

export function SubscriberTab({ data, onChange }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkStartImsi, setBulkStartImsi] = useState('001010000000001');
  const [bulkK, setBulkK] = useState('00112233445566778899aabbccddeeff');
  const [bulkAlgo, setBulkAlgo] = useState<SimAlgorithm>('milenage');

  const visibleUes = useMemo(() => {
    if (showAll || data.ues.length <= RENDER_CAP) return data.ues;
    return data.ues.slice(0, RENDER_CAP);
  }, [data.ues, showAll]);

  const updateDefaults = (patch: Partial<SubscriberDefaults>) => {
    onChange({ ...data, defaults: { ...data.defaults, ...patch } });
  };

  const updateUe = (ueId: number, patch: Partial<SubscriberEntry>) => {
    const ues = data.ues.map(u => u.ue_id === ueId ? { ...u, ...patch } : u);
    onChange({ ...data, ues });
  };

  const removeUe = (ueId: number) => {
    onChange({ ...data, ues: data.ues.filter(u => u.ue_id !== ueId) });
  };

  const addOne = () => {
    // -1 so the first UE gets ue_id 0 — built-in traffic assignments and
    // default mobility are keyed on ue_id 0.
    const lastId = data.ues.length === 0 ? -1 : Math.max(...data.ues.map(u => u.ue_id));
    const lastImsi = data.ues.length === 0 ? '001010000000001' : data.ues[data.ues.length - 1].imsi;
    const ue: SubscriberEntry = {
      ue_id: lastId + 1,
      imsi: data.ues.length === 0 ? lastImsi : incrementImsi(lastImsi),
      K: '00112233445566778899aabbccddeeff',
      sim_algo: data.defaults.sim_algo,
      ue_category: data.defaults.ue_category,
      as_release: data.defaults.as_release,
    };
    onChange({ ...data, ues: [...data.ues, ue] });
  };

  const submitBulk = () => {
    const startId = data.ues.length === 0 ? 0 : Math.max(...data.ues.map(u => u.ue_id)) + 1;
    const next: SubscriberEntry[] = [...data.ues];
    let imsi = bulkStartImsi.trim();
    for (let i = 0; i < bulkCount; i++) {
      next.push({
        ue_id: startId + i,
        imsi,
        K: bulkK,
        sim_algo: bulkAlgo,
        ue_category: data.defaults.ue_category,
        as_release: data.defaults.as_release,
      });
      imsi = incrementImsi(imsi);
    }
    onChange({ ...data, ues: next });
    setBulkOpen(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" /> Defaults (applied to bulk-added UEs)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">SIM Algorithm</Label>
            <Select
              value={data.defaults.sim_algo}
              onValueChange={v => updateDefaults({ sim_algo: v as SimAlgorithm })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALGOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">UE Category</Label>
            <Input
              type="number"
              value={data.defaults.ue_category}
              onChange={e => updateDefaults({ ue_category: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">AS Release</Label>
            <Input
              type="number"
              value={data.defaults.as_release}
              onChange={e => updateDefaults({ as_release: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Default APN</Label>
            <Input
              value={data.defaults.default_apn ?? ''}
              onChange={e => updateDefaults({ default_apn: e.target.value || undefined })}
              placeholder="e.g. internet"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> UE Pool ({data.ues.length})
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={addOne}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add UE
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
              Bulk Add…
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>IMSI</TableHead>
                  <TableHead>K</TableHead>
                  <TableHead>OPc</TableHead>
                  <TableHead>Algo</TableHead>
                  <TableHead>Cat</TableHead>
                  <TableHead>AS Rel</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUes.map(u => (
                  <TableRow key={u.ue_id}>
                    <TableCell className="text-muted-foreground">{u.ue_id}</TableCell>
                    <TableCell>
                      <Input
                        value={u.imsi}
                        onChange={e => updateUe(u.ue_id, { imsi: e.target.value })}
                        className="h-8 font-mono w-44"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={u.K}
                        onChange={e => updateUe(u.ue_id, { K: e.target.value })}
                        className="h-8 font-mono w-72"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={u.opc ?? ''}
                        onChange={e => updateUe(u.ue_id, { opc: e.target.value || undefined })}
                        className="h-8 font-mono w-72"
                        placeholder="(none)"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.sim_algo}
                        onValueChange={v => updateUe(u.ue_id, { sim_algo: v as SimAlgorithm })}
                      >
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALGOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={u.ue_category}
                        onChange={e => updateUe(u.ue_id, { ue_category: Number(e.target.value) })}
                        className="h-8 w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={u.as_release}
                        onChange={e => updateUe(u.ue_id, { as_release: Number(e.target.value) })}
                        className="h-8 w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => removeUe(u.ue_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data.ues.length > RENDER_CAP && (
            <div className="mt-2 text-center">
              <Button size="sm" variant="ghost" onClick={() => setShowAll(s => !s)}>
                {showAll ? `Show first ${RENDER_CAP}` : `Show all ${data.ues.length} UEs`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Add UEs</DialogTitle>
            <DialogDescription>
              Adds N sequential UEs starting from the IMSI you give. K is
              shared (typical for test pools); each UE gets a distinct ue_id.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Count</Label>
              <Input
                type="number" min={1} max={5000}
                value={bulkCount}
                onChange={e => setBulkCount(Math.max(1, Math.min(5000, Number(e.target.value))))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Algorithm</Label>
              <Select value={bulkAlgo} onValueChange={v => setBulkAlgo(v as SimAlgorithm)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALGOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Start IMSI</Label>
              <Input
                value={bulkStartImsi}
                onChange={e => setBulkStartImsi(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">K (shared)</Label>
              <Input
                value={bulkK}
                onChange={e => setBulkK(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={submitBulk}>Add {bulkCount} UEs</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

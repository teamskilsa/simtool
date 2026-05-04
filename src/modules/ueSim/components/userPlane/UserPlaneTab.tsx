// modules/ueSim/components/userPlane/UserPlaneTab.tsx
//
// User Plane tab — three IP modes from the Amarisoft docs:
//   • sim     → use ltesim_server, no kernel state
//   • tun     → per-UE TUN + setup script (default/most useful)
//   • remote  → forward to a real UE over SCTP/TCP

'use client';

import { Plus, Trash2, Network, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';

import type { PdnEntry, UserPlaneMode, UserPlaneSectionData } from '../../types';

interface Props {
  data: UserPlaneSectionData;
  onChange: (next: UserPlaneSectionData) => void;
}

const MODE_OPTIONS: Array<{ value: UserPlaneMode; label: string; help: string }> = [
  { value: 'sim',    label: 'sim (ltesim_server)', help: 'Userland-only — no TUN. Useful when you only need radio-stack behaviour.' },
  { value: 'tun',    label: 'tun (TUN per UE)',    help: 'Default mode. UE traffic flows through a TUN interface (one per UE) configured by your setup script.' },
  { value: 'remote', label: 'remote (SCTP/TCP)',   help: 'Forward U-plane to an external UE over SCTP/TCP. Required when integrating real handsets.' },
];

export function UserPlaneTab({ data, onChange }: Props) {
  const update = (patch: Partial<UserPlaneSectionData>) => onChange({ ...data, ...patch });

  const addPdn = () => {
    update({ pdn_list: [...data.pdn_list, { apn: 'internet', pdn_type: 'ipv4' }] });
  };

  const updatePdn = (idx: number, patch: Partial<PdnEntry>) => {
    update({
      pdn_list: data.pdn_list.map((p, i) => i === idx ? { ...p, ...patch } : p),
    });
  };

  const removePdn = (idx: number) => {
    update({ pdn_list: data.pdn_list.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Network className="h-4 w-4" /> IP Mode
          </CardTitle>
          <CardDescription className="text-xs">
            Picks how UE user-plane traffic leaves the simulator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {MODE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={
                  'rounded border p-3 cursor-pointer text-sm flex flex-col gap-1 ' +
                  (data.mode === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/40')
                }
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="ip-mode"
                    checked={data.mode === opt.value}
                    onChange={() => update({ mode: opt.value })}
                  />
                  <span className="font-medium">{opt.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{opt.help}</span>
              </label>
            ))}
          </div>

          {data.mode === 'tun' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">tun_setup_script</Label>
                <Input
                  value={data.tun_setup_script ?? ''}
                  onChange={e => update({ tun_setup_script: e.target.value || undefined })}
                  className="font-mono"
                  placeholder="e.g. ./ue-ifup"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">tun_interface_name</Label>
                <Input
                  value={data.tun_interface_name ?? ''}
                  onChange={e => update({ tun_interface_name: e.target.value || undefined })}
                  className="font-mono"
                  placeholder="(default)"
                />
              </div>
            </div>
          )}

          {data.mode === 'remote' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">rue_addr</Label>
                <Input
                  value={data.rue_addr ?? ''}
                  onChange={e => update({ rue_addr: e.target.value || undefined })}
                  className="font-mono"
                  placeholder="e.g. 192.168.0.20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">rue_protocol</Label>
                <Select
                  value={data.rue_protocol ?? 'sctp'}
                  onValueChange={v => update({ rue_protocol: v as 'sctp' | 'tcp' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sctp">sctp</SelectItem>
                    <SelectItem value="tcp">tcp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4" /> PDN List
            </CardTitle>
            <CardDescription className="text-xs">
              APNs the UE may attach to. Mark one as default.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={addPdn}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add PDN
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>APN</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-24">Default</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pdn_list.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        value={p.apn}
                        onChange={e => updatePdn(i, { apn: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.pdn_type}
                        onValueChange={v => updatePdn(i, { pdn_type: v as any })}
                      >
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ipv4">ipv4</SelectItem>
                          <SelectItem value="ipv6">ipv6</SelectItem>
                          <SelectItem value="ipv4v6">ipv4v6</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!!p.default}
                        onCheckedChange={v => {
                          // Only one default at a time.
                          const list = data.pdn_list.map((q, j) => ({
                            ...q,
                            default: j === i ? v : (v ? false : q.default),
                          }));
                          update({ pdn_list: list });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => removePdn(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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

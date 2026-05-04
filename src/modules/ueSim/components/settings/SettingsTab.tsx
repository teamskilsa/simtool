// modules/ueSim/components/settings/SettingsTab.tsx
//
// Settings tab — three groups:
//   • RF & Hardware     — driver name + args + sync, gains, CPU pinning
//   • Logging           — per-layer log levels (table)
//   • Remote API & misc — com_addr, com_auth/password, log_filename

'use client';

import { Plus, Trash2, Cpu, FileText, Wifi } from 'lucide-react';
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
  LayerLogConfig, LogLayer, LogLevel, SettingsSectionData,
} from '../../types';

interface Props {
  data: SettingsSectionData;
  onChange: (next: SettingsSectionData) => void;
}

const LOG_LAYERS: LogLayer[] = ['phy', 'mac', 'rlc', 'pdcp', 'rrc', 'nas', 'gtpu', 'ip', 'all'];
const LOG_LEVELS: LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];

export function SettingsTab({ data, onChange }: Props) {
  const update = (patch: Partial<SettingsSectionData>) => onChange({ ...data, ...patch });
  const updateRf = (patch: Partial<SettingsSectionData['rf_driver']>) =>
    update({ rf_driver: { ...data.rf_driver, ...patch } });

  const addLayer = () => {
    const used = new Set(data.log_layers.map(l => l.layer));
    const nextLayer = (LOG_LAYERS.find(l => !used.has(l)) ?? 'all') as LogLayer;
    update({
      log_layers: [...data.log_layers, { layer: nextLayer, level: 'info', max_size: 1 }],
    });
  };

  const updateLayer = (idx: number, patch: Partial<LayerLogConfig>) => {
    update({
      log_layers: data.log_layers.map((l, i) => i === idx ? { ...l, ...patch } : l),
    });
  };

  const removeLayer = (idx: number) => {
    update({ log_layers: data.log_layers.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="h-4 w-4" /> RF & Hardware
          </CardTitle>
          <CardDescription className="text-xs">
            RF driver selection, transmit/receive gains, and CPU pinning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Driver name</Label>
              <Input value={data.rf_driver.name} onChange={e => updateRf({ name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sync</Label>
              <Select value={data.rf_driver.sync ?? 'internal'} onValueChange={v => updateRf({ sync: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">internal</SelectItem>
                  <SelectItem value="gps">gps</SelectItem>
                  <SelectItem value="external">external</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TX gain (dB)</Label>
              <Input type="number" step="any" value={data.tx_gain} onChange={e => update({ tx_gain: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">RX gain (dB)</Label>
              <Input type="number" step="any" value={data.rx_gain} onChange={e => update({ rx_gain: Number(e.target.value) })} />
            </div>
            <div className="space-y-1 sm:col-span-4">
              <Label className="text-xs">Driver args</Label>
              <Input
                value={data.rf_driver.args ?? ''}
                onChange={e => updateRf({ args: e.target.value || undefined })}
                className="font-mono"
                placeholder='e.g. dev0=/dev/sdr0,clock_src=internal'
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">CPU pinning (cpu_core_list)</Label>
              <Input
                value={data.cpu_core_list?.join(',') ?? ''}
                onChange={e => {
                  const raw = e.target.value.trim();
                  if (!raw) return update({ cpu_core_list: undefined });
                  const list = raw.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
                  update({ cpu_core_list: list });
                }}
                placeholder="e.g. 4,5,6"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">PDCCH decode optimisation</Label>
              <div className="h-9 flex items-center">
                <Switch
                  checked={!!data.pdcch_decode_opt}
                  onCheckedChange={v => update({ pdcch_decode_opt: v })}
                />
                <span className="text-xs ml-2 text-muted-foreground">
                  Enable for higher cell counts on busy CPUs.
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Logging
            </CardTitle>
            <CardDescription className="text-xs">
              Per-layer log level. The emitter encodes this as the comma list
              expected by Amarisoft's <code>log_options</code>.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={addLayer}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Layer
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">log_filename</Label>
            <Input
              value={data.log_filename}
              onChange={e => update({ log_filename: e.target.value })}
              className="font-mono"
              placeholder="/tmp/ue.log"
            />
          </div>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Layer</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Max Size</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.log_layers.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={l.layer} onValueChange={v => updateLayer(i, { layer: v as LogLayer })}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LOG_LAYERS.map(ll => <SelectItem key={ll} value={ll}>{ll}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={l.level} onValueChange={v => updateLayer(i, { level: v as LogLevel })}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LOG_LEVELS.map(lv => <SelectItem key={lv} value={lv}>{lv}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={l.max_size}
                        onChange={e => updateLayer(i, { max_size: Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeLayer(i)}>
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

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wifi className="h-4 w-4" /> Remote API
          </CardTitle>
          <CardDescription className="text-xs">
            Bind address and optional auth for the WebSocket Remote API
            that the rest of simtool talks to.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">com_addr</Label>
            <Input
              value={data.com_addr}
              onChange={e => update({ com_addr: e.target.value })}
              className="font-mono"
              placeholder="e.g. [::]:9002"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">com_auth</Label>
            <div className="h-9 flex items-center">
              <Switch checked={!!data.com_auth} onCheckedChange={v => update({ com_auth: v })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">com_password</Label>
            <Input
              value={data.com_password ?? ''}
              onChange={e => update({ com_password: e.target.value || undefined })}
              type="password"
              placeholder="(unset)"
              disabled={!data.com_auth}
            />
            {data.com_password && (
              <p className="text-[10px] text-amber-600 dark:text-amber-500 leading-snug">
                Stored in browser localStorage — clear it before sharing the device.
                Excluded from the post-apply snapshot.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

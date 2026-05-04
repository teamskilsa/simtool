// modules/ueSim/components/cell/RfDriverSection.tsx
//
// RF driver picker for the UE simulator. Lives inside CellTab because
// users think of "what radio do we use for these cells?" as a single
// question — the previous Settings-tab placement put it three tabs
// away from the cells it drives.
//
// Three modes, mirrored from the LTE/NR builder so users see the same
// shape they configure on the eNB side:
//
//   sdr   — direct radio (USRP, Amarisoft SDR card, etc.)
//   split — O-RAN 7.2 fronthaul (DU-side equivalent on the UE)
//   ip    — trx_ip / ZMQ-style socket pair (the typical sim setup)
//
// Source of truth is `RfDriverConfig.args` — a comma-separated key=value
// string, exactly the shape Amarisoft's parser consumes. The structured
// fields below read/write specific keys; we leave anything we don't
// recognise alone so a hand-edit of args round-trips cleanly.
//
// We also surface tx_gain / rx_gain here because they're conceptually
// part of "the radio" — same UI rationale as the eNB builder.

'use client';

import { Cpu, Network, Radio, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import type { SettingsSectionData, RfDriverConfig } from '../../types';

type RfMode = 'sdr' | 'split' | 'ip';

interface Props {
  settings: SettingsSectionData;
  onChange: (next: SettingsSectionData) => void;
}

// ─── args key=value helpers ────────────────────────────────────────────────
// Same convention as rfDefaults.ts in the testConfig/builder module:
// the args string is a flat comma-delimited key=value list. We parse it
// to a map for editing and serialise back, preserving any keys we
// don't have a UI control for.

function parseArgs(s: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const part of s.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function serialiseArgs(o: Record<string, string>): string {
  return Object.entries(o)
    .filter(([k, v]) => k && v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

function setArg(args: string | undefined, key: string, value: string | undefined): string {
  const m = parseArgs(args);
  if (!value) delete m[key];
  else m[key] = value;
  return serialiseArgs(m);
}

// ─── Mode inference + defaults ─────────────────────────────────────────────

function modeFromDriverName(name: string | undefined): RfMode {
  const n = (name ?? '').toLowerCase();
  if (n === 'split' || n.startsWith('split')) return 'split';
  if (n === 'ip' || n === 'zmq' || n === 'trx_ip') return 'ip';
  return 'sdr';
}

function defaultArgsForMode(mode: RfMode, nAntenna: number): string {
  if (mode === 'sdr')   return nAntenna >= 4 ? 'dev0=/dev/sdr0,dev1=/dev/sdr1' : 'dev0=/dev/sdr0';
  if (mode === 'split') return 'vlan_tagging=1,vlan_id=10,if_name=eth0,bfp_iq_width=9';
  /* ip */              return 'tx_addr=tcp://127.0.0.1:2000,rx_addr=tcp://127.0.0.1:2001,use_tcp=0,multi_thread=0';
}

// ─── Component ─────────────────────────────────────────────────────────────

export function RfDriverSection({ settings, onChange }: Props) {
  const rf: RfDriverConfig = settings.rf_driver;
  const mode = modeFromDriverName(rf.name);
  const argsMap = parseArgs(rf.args);

  const updateRf = (patch: Partial<RfDriverConfig>) =>
    onChange({ ...settings, rf_driver: { ...rf, ...patch } });

  const handleModeChange = (next: RfMode) => {
    // Switch driver name + reset args to a sensible default for the new
    // mode. Users who hand-tuned args lose them on switch — same trade-off
    // the eNB builder makes; protects users from mode-mismatched args.
    onChange({
      ...settings,
      rf_driver: {
        ...rf,
        name: next,
        args: defaultArgsForMode(next, /* multi-antenna heuristic */ 1),
      },
    });
  };

  const updateArg = (key: string, value: string | undefined) =>
    updateRf({ args: setArg(rf.args, key, value) || undefined });

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className="h-4 w-4" /> RF Driver
        </CardTitle>
        <CardDescription className="text-xs">
          Radio frontend selection for these cells. Drives the
          <code className="mx-1">rf_driver</code> block in the emitted ue.cfg.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Mode</Label>
            <Select value={mode} onValueChange={(v) => handleModeChange(v as RfMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sdr">SDR (direct radio)</SelectItem>
                <SelectItem value="split">Split 7.2 (O-RAN fronthaul)</SelectItem>
                <SelectItem value="ip">IP (trx_ip / ZMQ sockets)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Sync</Label>
            <Select value={rf.sync ?? 'internal'} onValueChange={(v) => updateRf({ sync: v as RfDriverConfig['sync'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">internal</SelectItem>
                <SelectItem value="gps">gps</SelectItem>
                <SelectItem value="external">external</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">RX antenna</Label>
            <Select
              value={rf.rx_antenna ?? 'rx'}
              onValueChange={(v) => updateRf({ rx_antenna: v as 'rx' | 'tx' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rx">RX</SelectItem>
                <SelectItem value="tx">TX/RX</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Gains — visually grouped with the radio because they're
            "how loud" from the same RF chain. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Zap className="h-3 w-3" /> TX gain (dB)</Label>
            <Input
              type="number"
              step="any"
              value={settings.tx_gain}
              onChange={(e) => onChange({ ...settings, tx_gain: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Zap className="h-3 w-3" /> RX gain (dB)</Label>
            <Input
              type="number"
              step="any"
              value={settings.rx_gain}
              onChange={(e) => onChange({ ...settings, rx_gain: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">FIFO TX time (µs)</Label>
            <Input
              type="number"
              value={rf.fifo_tx_time ?? ''}
              onChange={(e) => updateRf({ fifo_tx_time: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="(default)"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">RX latency (µs)</Label>
            <Input
              type="number"
              value={rf.rx_latency ?? ''}
              onChange={(e) => updateRf({ rx_latency: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="(default)"
            />
          </div>
        </div>

        {/* Mode-specific body */}
        <div className="border-t pt-3 mt-1">
          {mode === 'sdr' && (
            <div className="space-y-1">
              <Label className="text-xs">Device path (rf_driver.args)</Label>
              <Input
                value={rf.args ?? ''}
                onChange={(e) => updateRf({ args: e.target.value || undefined })}
                className="font-mono"
                placeholder="e.g. dev0=/dev/sdr0,clock_src=internal"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                One device per 2 antennas (1–2 antennas → <code>dev0</code>; 4 antennas → <code>dev0,dev1</code>).
              </p>
            </div>
          )}

          {mode === 'split' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">VLAN tagging</Label>
                <div className="h-9 flex items-center">
                  <Switch
                    checked={argsMap.vlan_tagging === '1'}
                    onCheckedChange={(v) => updateArg('vlan_tagging', v ? '1' : '0')}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">VLAN ID</Label>
                <Input
                  type="number"
                  value={argsMap.vlan_id ?? ''}
                  onChange={(e) => updateArg('vlan_id', e.target.value || undefined)}
                  placeholder="10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Interface (if_name)</Label>
                <Input
                  value={argsMap.if_name ?? ''}
                  onChange={(e) => updateArg('if_name', e.target.value || undefined)}
                  placeholder="eth0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">BFP IQ width (bits)</Label>
                <Input
                  type="number"
                  value={argsMap.bfp_iq_width ?? '9'}
                  onChange={(e) => updateArg('bfp_iq_width', e.target.value || undefined)}
                  placeholder="9"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Extra args (raw)</Label>
                <Input
                  value={[
                    'vlan_tagging', 'vlan_id', 'if_name', 'bfp_iq_width',
                  ].reduce((s, k) => s.replace(new RegExp(`(^|,)${k}=[^,]*`), ''), rf.args ?? '')
                    .replace(/^,+|,+$/g, '')
                    .replace(/,,+/g, ',')}
                  onChange={(e) => {
                    // Merge unrecognised keys back in. Keep our 4 known
                    // fields managed by the structured controls above.
                    const known = parseArgs(rf.args);
                    const knownKeys = ['vlan_tagging', 'vlan_id', 'if_name', 'bfp_iq_width'];
                    const kept: Record<string, string> = {};
                    for (const k of knownKeys) if (known[k] !== undefined) kept[k] = known[k];
                    const extra = parseArgs(e.target.value);
                    updateRf({ args: serialiseArgs({ ...extra, ...kept }) || undefined });
                  }}
                  className="font-mono"
                  placeholder="c_plane_dst_mac=...,u_plane_dst_mac=..."
                />
              </div>
            </div>
          )}

          {mode === 'ip' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">TX Address</Label>
                <Input
                  value={argsMap.tx_addr ?? ''}
                  onChange={(e) => updateArg('tx_addr', e.target.value || undefined)}
                  className="font-mono"
                  placeholder="tcp://127.0.0.1:2000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RX Address</Label>
                <Input
                  value={argsMap.rx_addr ?? ''}
                  onChange={(e) => updateArg('rx_addr', e.target.value || undefined)}
                  className="font-mono"
                  placeholder="tcp://127.0.0.1:2001"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Transport (use_tcp)</Label>
                <Select
                  value={argsMap.use_tcp ?? '0'}
                  onValueChange={(v) => updateArg('use_tcp', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">UDP — default, eNB-first startup OK</SelectItem>
                    <SelectItem value="1">TCP — peer must be listening first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Threading (multi_thread)</Label>
                <Select
                  value={argsMap.multi_thread ?? '0'}
                  onValueChange={(v) => updateArg('multi_thread', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Single-thread (default)</SelectItem>
                    <SelectItem value="1">Multi-thread (per-port worker)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground md:col-span-2 -mt-1">
                <Network className="inline h-3 w-3 mr-1" />
                trx_ip pairs each port's <code>tx_addr</code> with the eNB-side
                <code className="mx-1">rx_addr</code> (and vice versa). Verify
                the addresses are reachable from the peer.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

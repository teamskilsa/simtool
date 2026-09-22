// "Generate traffic during the run" — the part a callbox customer actually
// watches. The Run panel starts the job with the run and stops it when the run
// ends, fails or is stopped, so the timeline shows the throughput dip at each
// handover.
//
// Reuses /api/traffic/jobs, so the rules are the Traffic tab's rules: uplink
// Downlink UDP straight off the
// callbox and needs nothing on the UE side. Both need an SSH login on the
// system, because the generator runs on the callbox itself.
'use client';

import { Gauge } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface TrafficSettings {
  enabled: boolean;
  direction: 'dl' | 'ul';
  /** Always the callbox: SimTool does not drive handsets. */
  generator: 'callbox';
  protocol: 'udp' | 'tcp';
  bitrateMbps: number;
}

export const DEFAULT_TRAFFIC: TrafficSettings = {
  enabled: false, direction: 'dl', generator: 'callbox', protocol: 'udp', bitrateMbps: 20,
};

/** Why traffic cannot run right now, in the customer's words. */
export function trafficBlocker(t: TrafficSettings, o: {
  hasSshLogin: boolean; ueIp?: string;
}): string | null {
  if (!t.enabled) return null;
  if (!o.hasSshLogin) return 'This system has no SSH login saved — add the username and password in Test Systems, or turn traffic off.';
  if (!o.ueIp) return 'The UE has no IP on the core yet, so there is nothing to send traffic to.';
  // The callbox sends UDP straight at the UE address, so nothing is needed on
  // the device. Uplink and TCP would need an endpoint on the UE, so they are out.
  if (t.direction === 'ul') return 'Uplink traffic would need a generator on the device — SimTool only drives the callbox, so use downlink.';
  if (t.protocol === 'tcp') return 'TCP needs an endpoint on the device — use UDP from the callbox.';
  return null;
}

export function trafficSummary(t: TrafficSettings): string {
  if (!t.enabled) return 'No traffic — the run only moves the UE between cells.';
  const where = 'from the callbox (nothing needed on the device)';
  return `${t.bitrateMbps} Mbps ${t.direction === 'dl' ? 'downlink' : 'uplink'} ${t.protocol.toUpperCase()} ${where}, for the whole run.`;
}

export function TrafficControls({ value, onChange, hasSshLogin, ueIp, disabled }: {
  value: TrafficSettings;
  onChange: (t: TrafficSettings) => void;
  hasSshLogin: boolean;
  ueIp?: string;
  disabled?: boolean;
}) {
  const set = (patch: Partial<TrafficSettings>) => onChange({ ...value, ...patch });
  const blocker = trafficBlocker(value, { hasSshLogin, ueIp });
  const canEnable = hasSshLogin;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Kicker className="flex items-center gap-1"><Gauge className="h-3 w-3" />Generate traffic during the run</Kicker>
        <label className={cn('ml-auto flex items-center gap-2 text-xs', !canEnable && 'opacity-60')}>
          <Switch checked={value.enabled} disabled={disabled || !canEnable} onCheckedChange={v => set({ enabled: v })} />
          {value.enabled ? 'On' : 'Off'}
        </label>
      </div>

      {!canEnable ? (
        <p className="text-[11px] text-muted-foreground">
          Traffic needs an SSH login for the callbox — add the username and password for this system under Test Systems, then come back.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">{trafficSummary(value)}</p>
          {value.enabled && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <label className="space-y-0.5">
                <span className="text-xs font-medium">Direction</span>
                <Select value={value.direction} onValueChange={(v: any) => set({ direction: v })} disabled={disabled}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dl" description="callbox → UE, generated on the callbox">Downlink</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-0.5">
                <span className="text-xs font-medium">Protocol</span>
                <Select value={value.protocol} onValueChange={(v: any) => set({ protocol: v })} disabled>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="udp" description="constant rate — the dip at a handover is easy to see">UDP</SelectItem>
                    <SelectItem value="tcp" description="needs an endpoint on the device — not available">TCP</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-0.5">
                <span className="text-xs font-medium">Rate</span>
                <div className="relative">
                  <Input
                    className="num h-8 pr-12 text-xs" type="number" min={0.1} max={5000} step={1}
                    value={String(value.bitrateMbps)} disabled={disabled}
                    onChange={e => set({ bitrateMbps: Number(e.target.value) })}
                  />
                  <span className="pointer-events-none absolute right-2 top-1.5 text-[11px] text-muted-foreground">Mbps</span>
                </div>
              </label>
            </div>
          )}
          {blocker && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{blocker}</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}

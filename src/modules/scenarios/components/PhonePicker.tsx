// "Phone over USB (optional)" — the control that replaced a bare serial
// dropdown and the cryptic "3 phone step(s) skipped".
//
// The phone is never the point of a callbox handover test: the UE is the
// callbox's own simulated UE. A real handset plugged in over USB only adds a
// background ping (which keeps the UE out of idle) and a ping-loss figure
// across the handovers. This says so, and says exactly what is skipped without
// one.
'use client';

import { RefreshCw, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MobilityScenario, PhoneOp, Step } from '../types';

export const NO_PHONE = '__none__';

export interface PhoneRow { serial: string; model: string; state: string; hasIperf3?: boolean }

const OP_TEXT: Partial<Record<PhoneOp, string>> = {
  ping_start: 'background ping (keeps the UE connected)',
  ping_stop: 'ping-loss measurement across the run',
  ping: 'ping check',
  airplane_on: 'airplane mode on',
  airplane_off: 'airplane mode off',
  wake: 'waking the screen',
  radio_info: 'refreshing the modem cell info',
  cell_info: 'reading the phone’s serving cell',
};

/** What a phone would add to this scenario, in plain words. */
export function phoneOps(scenario: MobilityScenario | null): string[] {
  const out: string[] = [];
  const walk = (steps: Step[]) => {
    for (const s of steps) {
      if (s.type === 'loop') { walk(s.steps); continue; }
      if (s.type === 'action' && s.target === 'phone') {
        const text = OP_TEXT[s.phone.op] ?? s.phone.op;
        if (!out.includes(text)) out.push(text);
      }
    }
  };
  walk(scenario?.steps ?? []);
  return out;
}

export function PhonePicker({ scenario, phones, value, onChange, onRefresh, error, disabled }: {
  scenario: MobilityScenario | null;
  phones: PhoneRow[];
  value: string;
  onChange: (serial: string) => void;
  onRefresh: () => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const ops = phoneOps(scenario);
  const needed = !!scenario?.requirements.needsPhone;
  const selected = phones.find(p => p.serial === value) ?? null;
  const usable = phones.filter(p => p.state === 'device');

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Kicker className="flex items-center gap-1"><Smartphone className="h-3 w-3" />Phone over USB</Kicker>
        <Badge variant={needed ? 'warning' : 'secondary'} className="h-5 px-1.5 text-[10px]">{needed ? 'required by this scenario' : 'optional'}</Badge>
      </div>

      <div className="flex gap-1">
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PHONE} description={ops.length ? `${ops.length} phone step(s) will be skipped` : 'nothing is skipped — this scenario has no phone steps'}>
              No phone
            </SelectItem>
            {phones.map(p => (
              <SelectItem key={p.serial} value={p.serial} disabled={p.state !== 'device'}
                description={`${p.serial}${p.state === 'device' ? '' : ` · ${p.state}`}${p.hasIperf3 ? ' · iperf3 installed' : ''}`}>
                {p.model || p.serial}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={onRefresh} title="Re-scan adb"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        {value !== NO_PHONE && selected ? (
          <>
            Using <b className="text-foreground">{selected.model || selected.serial}</b> ({selected.serial}).
            {ops.length > 0 && <> It adds {ops.join(', ')}.</>}
          </>
        ) : ops.length > 0 ? (
          <>
            Optional: it adds {ops.join(', ')}. Without a phone those {ops.length === 1 ? 'step is' : 'steps are'} skipped and the
            handovers are measured on the callbox alone{needed ? ' — this scenario expects one, so reconnects then depend on the UE sending data by itself.' : '.'}
          </>
        ) : (
          <>This scenario does not use a phone — the UE is the callbox&rsquo;s own, and nothing is skipped.</>
        )}
      </p>

      {error && <p className="text-[11px] text-muted-foreground">{error}</p>}
      {!error && phones.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No phone detected over adb. Plug one in and allow USB debugging, then re-scan.</p>
      )}
      {phones.length > 0 && usable.length === 0 && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">A phone is plugged in but not authorised for adb — accept the USB debugging prompt on the handset.</p>
      )}
    </div>
  );
}

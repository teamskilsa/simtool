// The run timeline: live throughput over the air with a marker at every
// handover, so a customer can see the dip each hop costs, plus a strip of
// handover chips with their durations and the asserts that passed or failed.
'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import { Kicker } from '@/components/ui/stat';
import { cn } from '@/lib/utils';
import type { AssertRecord, MetricRecord } from '../types';

export interface RadioSample {
  t: number;
  dlMbps: number;
  ulMbps: number;
  cqi?: number;
  pcell?: number;
}

export interface TimelineMarker {
  t: number;
  /** Handover duration in ms, when the metric recorded one. */
  ms?: number;
  label: string;
  ok: boolean;
}

/** Handovers (ho_complete_ms) and failed checks, in time order. */
export function markersOf(metrics: MetricRecord[], asserts: AssertRecord[]): TimelineMarker[] {
  const out: TimelineMarker[] = metrics
    .filter(m => m.name === 'ho_complete_ms')
    .map(m => ({ t: m.at, ms: m.value, label: `handover ${Math.round(m.value)} ms`, ok: true }));
  for (const a of asserts) {
    if (!a.passed && !a.optional) out.push({ t: a.at, label: a.label, ok: false });
  }
  return out.sort((a, b) => a.t - b.t);
}

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour12: false });

export function RunTimeline({ samples, markers, startedAt, endedAt }: {
  samples: RadioSample[];
  markers: TimelineMarker[];
  startedAt: number;
  endedAt?: number;
}) {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  const chrome = {
    grid: dark ? '#14414f' : '#dbe7ec',
    axis: dark ? '#a0bbc4' : '#5c7480',
    tooltipBg: dark ? '#00303f' : '#ffffff',
    tooltipBorder: dark ? '#1d4c5b' : '#c2d5dd',
    text: dark ? '#f2f9fb' : '#00303f',
  };

  const domain = useMemo<[number, number]>(
    () => [startedAt, Math.max(endedAt ?? Date.now(), samples.at(-1)?.t ?? startedAt, startedAt + 1000)],
    [startedAt, endedAt, samples],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Kicker>Timeline</Kicker>
        <span className="text-[11px] text-muted-foreground">
          {samples.length
            ? 'Throughput over the air; each dashed line is a handover.'
            : 'Start traffic to see the throughput dip at each handover.'}
        </span>
      </div>

      {samples.length > 1 ? (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={samples} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={chrome.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t" type="number" scale="time" domain={domain}
                tickFormatter={clock} stroke={chrome.axis} tick={{ fontSize: 10 }} minTickGap={40}
              />
              <YAxis stroke={chrome.axis} tick={{ fontSize: 10 }} width={46}
                label={{ value: 'Mbps', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: chrome.axis } }} />
              <Tooltip
                contentStyle={{ background: chrome.tooltipBg, border: `1px solid ${chrome.tooltipBorder}`, borderRadius: 8, fontSize: 11, color: chrome.text }}
                labelFormatter={(t: any) => clock(Number(t))}
                formatter={(v: any, name: any) => [`${Number(v).toFixed(2)} Mbps`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {markers.map((m, i) => (
                <ReferenceLine
                  key={`${m.t}-${i}`} x={m.t}
                  stroke={m.ok ? '#EC691F' : '#D14A39'} strokeDasharray="4 3"
                  label={{ value: m.ms ? `${Math.round(m.ms)} ms` : '✗', position: 'top', style: { fontSize: 9, fill: m.ok ? '#EC691F' : '#D14A39' } }}
                />
              ))}
              <Line type="monotone" dataKey="dlMbps" name="Downlink" stroke="#EC691F" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="ulMbps" name="Uplink" stroke="#17A5A2" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid h-[88px] place-items-center rounded border border-dashed border-border text-xs text-muted-foreground">
          {samples.length ? 'Collecting radio samples…' : 'No radio samples yet.'}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {markers.length === 0 && <span className="text-[11px] text-muted-foreground">No handovers yet.</span>}
        {markers.map((m, i) => (
          <span
            key={`${m.t}-${i}`}
            title={`${clock(m.t)} — ${m.label}`}
            className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
              m.ok ? 'border-brand-orange/50 bg-brand-orange/10' : 'border-destructive/50 bg-destructive/10 text-destructive')}
          >
            {m.ok ? <CheckCircle2 className="h-3 w-3 text-brand-orange" /> : <XCircle className="h-3 w-3" />}
            <span className="num">{m.ms !== undefined ? `${Math.round(m.ms)} ms` : m.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

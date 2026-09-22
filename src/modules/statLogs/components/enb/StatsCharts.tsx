// Time-series chart card in the Simnovus palette (recharts, as in Simnovator).
'use client';

import React, { useMemo, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useTheme } from '@/components/theme/context/theme-context';
import { Card } from '@/components/ui/card';
import { Kicker } from '@/components/ui/stat';
import { fmt, rateUnit } from './statsModel';

/** Orange leads (DL / primary series), teal follows (UL), then mist-blue,
 *  amber, brick and slate for additional cells. Chosen to stay distinct on
 *  both paper and petrol. */
export const SERIES_COLORS = ['#EC691F', '#17A5A2', '#3D8DAC', '#C98A1E', '#D14A39', '#8FA9B3'];

/** SVG presentation attributes cannot read CSS variables, so the chart chrome
 *  is resolved from the theme mode here. */
function useChartChrome() {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  return {
    grid: dark ? '#14414f' : '#dbe7ec',
    axis: dark ? '#a0bbc4' : '#5c7480',
    tooltipBg: dark ? '#00303f' : '#ffffff',
    tooltipBorder: dark ? '#1d4c5b' : '#c2d5dd',
    text: dark ? '#f2f9fb' : '#00303f',
  };
}

const clock = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
  /** Drawn dashed — used for aggregate lines (Total / mean) over per-cell ones. */
  dashed?: boolean;
}

interface TimeSeriesChartProps {
  title: string;
  unit?: string;
  data: object[];
  series: SeriesDef[];
  domain?: [number | 'auto', number | 'auto'];
  digits?: number;
  height?: number;
  /** Values are Mbps; show them in Mbps / kbps / bps by the largest sample. */
  rate?: boolean;
}

const pick = (row: any, path: string): number => {
  const v = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), row);
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Axis ticks: few significant digits, so auto-scaled domains never print
 *  like 0.00065. */
const tickFmt = (v: any) => {
  const x = Number(v);
  if (!Number.isFinite(x)) return '';
  const a = Math.abs(x);
  return x.toLocaleString(undefined, { maximumFractionDigits: a >= 100 || a === 0 ? 0 : a >= 1 ? 1 : 3 });
};

export function TimeSeriesChart({
  title, unit, data, series, domain, digits = 1, height = 220, rate = false,
}: TimeSeriesChartProps) {
  const c = useChartChrome();
  const [full, setFull] = useState(false);

  const scale = useMemo(() => {
    if (!rate || data.length === 0) return { unit, factor: 1, digits };
    let max = 0;
    for (const row of data) for (const s of series) max = Math.max(max, Math.abs(pick(row, s.key)));
    // All-zero data: recharts falls back to a 0–4 axis, which scaled to bps
    // would read 4,000,000 — keep the nominal unit instead.
    if (max === 0) return { unit, factor: 1, digits };
    const u = rateUnit(max);
    return { unit: u.unit as string, factor: u.factor, digits: u.digits };
  }, [rate, data, series, unit, digits]);

  const chart = (h: number | string) =>
    data.length === 0 ? (
      <div className="grid h-full place-items-center text-xs text-muted-foreground">
        Waiting for samples…
      </div>
    ) : (
      <ResponsiveContainer width="100%" height={h}>
            <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -6 }}>
              <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={clock}
                stroke={c.axis}
                tick={{ fontSize: 10, fill: c.axis }}
                tickLine={false}
                axisLine={{ stroke: c.grid }}
                minTickGap={56}
              />
              <YAxis
                stroke={c.axis}
                tick={{ fontSize: 10, fill: c.axis }}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={domain}
                tickFormatter={(v: any) => tickFmt(Number(v) * scale.factor)}
              />
              <Tooltip
                contentStyle={{
                  background: c.tooltipBg,
                  border: `1px solid ${c.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: c.text,
                }}
                labelStyle={{ color: c.axis, fontSize: 11 }}
                labelFormatter={(t: any) => clock(Number(t))}
                formatter={(v: any, name: any) => [`${fmt(Number(v) * scale.factor, scale.digits)}${scale.unit ? ` ${scale.unit}` : ''}`, name]}
              />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, color: c.axis }} />
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? '5 4' : undefined}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
      </ResponsiveContainer>
    );

  const header = (expanded: boolean) => (
    <div className="flex items-center justify-between gap-2 px-4 pt-3">
      <Kicker>{title}</Kicker>
      <div className="flex items-center gap-2">
        {scale.unit ? <span className="font-mono text-[10px] text-muted-foreground">{scale.unit}</span> : null}
        <button
          type="button"
          onClick={() => setFull(!expanded)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={expanded ? 'Close full screen' : 'Expand chart'}
        >
          {expanded ? <X className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Card accent>
        {header(false)}
        <div className="px-2 pb-2" style={{ height }}>{chart('100%')}</div>
      </Card>

      {full && (
        // Simple fixed overlay (no portal needed): the chart fills the screen
        // for reading detail, click the X or the backdrop to return.
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setFull(false)}
        >
          <Card accent className="flex h-[80vh] w-full max-w-6xl flex-col" onClick={e => e.stopPropagation()}>
            {header(true)}
            <div className="min-h-0 flex-1 px-2 pb-3">{chart('100%')}</div>
          </Card>
        </div>
      )}
    </>
  );
}

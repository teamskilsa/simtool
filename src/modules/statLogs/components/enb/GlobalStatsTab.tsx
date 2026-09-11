// Global tab — whole-system KPIs, as Simnovator's Statistics → Global.
'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Kicker, Stat } from '@/components/ui/stat';
import { TimeSeriesChart } from './StatsCharts';
import { cellRows, fmt, fmtDuration, type TimePoint } from './statsModel';

interface GlobalStatsTabProps {
  latest: TimePoint | null;
  series: TimePoint[];
  stats: any;
}

export function GlobalStatsTab({ latest, series, stats }: GlobalStatsTabProps) {
  const cells = cellRows(stats).length;
  const rfPorts = Array.isArray(stats?.rf_ports)
    ? stats.rf_ports.length
    : stats?.rf_ports && typeof stats.rf_ports === 'object'
      ? Object.keys(stats.rf_ports).length
      : undefined;
  const cpu = typeof stats?.cpu?.global === 'number' ? stats.cpu.global : undefined;
  const retxTone = (v?: number) => (v === undefined ? 'default' : v >= 10 ? 'warn' : 'default') as 'default' | 'warn';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
        <Stat label="DL Throughput" value={fmt(latest?.dlMbps, 1)} unit="Mbps" />
        <Stat label="UL Throughput" value={fmt(latest?.ulMbps, 1)} unit="Mbps" />
        <Stat label="Connected UEs" value={fmt(latest?.ues, 0)} />
        <Stat label="Active UEs" value={fmt(latest?.activeUes, 0)} />
        <Stat label="DL PRB" value={fmt(latest?.dlPrb, 1)} unit="%" />
        <Stat label="UL PRB" value={fmt(latest?.ulPrb, 1)} unit="%" />
        <Stat label="DL Retx" value={fmt(latest?.dlRetxPct, 2)} unit="%" tone={retxTone(latest?.dlRetxPct)} />
        <Stat label="UL Retx" value={fmt(latest?.ulRetxPct, 2)} unit="%" tone={retxTone(latest?.ulRetxPct)} />
      </div>

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-2 px-4 py-2.5">
        <Info label="Cells" value={cells || '—'} />
        <Info label="Uptime" value={fmtDuration(stats?.duration)} />
        <Info label="CPU" value={cpu === undefined ? '—' : `${fmt(cpu, 1)} %`} />
        <Info label="RF ports" value={rfPorts ?? '—'} />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TimeSeriesChart
          title="Throughput" unit="Mbps" data={series}
          series={[{ key: 'dlMbps', label: 'DL' }, { key: 'ulMbps', label: 'UL' }]}
        />
        <TimeSeriesChart
          title="PRB Utilisation" unit="%" data={series} domain={[0, 100]}
          series={[{ key: 'dlPrb', label: 'DL' }, { key: 'ulPrb', label: 'UL' }]}
        />
        <TimeSeriesChart
          title="UEs" data={series} digits={0}
          series={[{ key: 'ues', label: 'Connected' }, { key: 'activeUes', label: 'Active' }]}
        />
        <TimeSeriesChart
          title="Retransmissions" unit="%" data={series} digits={2}
          series={[{ key: 'dlRetxPct', label: 'DL' }, { key: 'ulRetxPct', label: 'UL' }]}
        />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <Kicker>{label}</Kicker>
      <span className="num text-sm font-semibold">{value}</span>
    </div>
  );
}

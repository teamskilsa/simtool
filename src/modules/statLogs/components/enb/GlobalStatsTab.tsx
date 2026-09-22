// Global tab — the UE-summary donut row over headline KPIs and time-series
// charts, as in Simnovator's Statistics → Global.
'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Kicker, Stat } from '@/components/ui/stat';
import { Donut } from './Donut';
import { TimeSeriesChart, type SeriesDef } from './StatsCharts';
import { CellPicker, cellColor, type CellSelection } from './CellPicker';
import {
  cellRows, fmt, fmtDuration, fmtRate, radioSummary,
  type CellMetric, type ModuleKey, type TimePoint,
} from './statsModel';

interface GlobalStatsTabProps {
  latest: TimePoint | null;
  series: TimePoint[];
  stats: any;
  module: ModuleKey;
  selection: CellSelection;
  onSelectionChange: React.Dispatch<React.SetStateAction<CellSelection>>;
}

export function GlobalStatsTab({ latest, series, stats, module, selection, onSelectionChange }: GlobalStatsTabProps) {
  const allRows = cellRows(stats);
  const cellIds = allRows.map(r => r.id);
  const hidden = new Set(selection.hidden);
  // KPI cards follow the cell picker, so hiding cells narrows the numbers too.
  const rows = allRows.filter(r => !hidden.has(r.id));
  const cells = rows.length;
  const subset = cells > 0 && cells < allRows.length;
  const sum = (pick: (r: typeof rows[number]) => number) => rows.reduce((a, r) => a + pick(r), 0);
  const scope = (verb: string) => cells ? `${verb} of ${cells}${subset ? ` of ${allRows.length}` : ''} cells` : undefined;
  const view = allRows.length === 0 ? latest : latest && {
    ...latest,
    dlMbps: sum(r => r.dlMbps), ulMbps: sum(r => r.ulMbps),
    ues: sum(r => r.ues), activeUes: sum(r => r.activeUes),
    dlPrb: cells ? sum(r => r.dlPrbAvg) / cells : 0,
    ulPrb: cells ? sum(r => r.ulPrbAvg) / cells : 0,
  };

  /** One line per shown cell, plus the all-cell aggregate when Total is on. */
  const perCell = (metric: CellMetric, totalLabel = 'Total (all cells)'): SeriesDef[] => [
    ...rows.map(r => ({ key: `cells.${r.id}.${metric}`, label: `Cell ${r.id}`, color: cellColor(cellIds, r.id) })),
    ...(selection.showTotal || allRows.length === 0
      ? [{ key: metric, label: allRows.length === 0 ? metric : totalLabel, color: '#5c7480', dashed: allRows.length > 0 }]
      : []),
  ];
  const rfPorts = Array.isArray(stats?.rf_ports)
    ? stats.rf_ports.length
    : stats?.rf_ports && typeof stats.rf_ports === 'object'
      ? Object.keys(stats.rf_ports).length
      : undefined;
  const cpu = typeof stats?.cpu?.global === 'number' ? stats.cpu.global : undefined;
  const retxTone = (v?: number) => (v === undefined ? 'default' : v >= 10 ? 'warn' : 'default') as 'default' | 'warn';

  const donuts = radioSummary(stats, module);
  const dl = fmtRate(view?.dlMbps);
  const ul = fmtRate(view?.ulMbps);

  return (
    <div className="space-y-4">
      {/* UE Summary — the donut header row */}
      {donuts.length > 0 && (
        <section className="space-y-2">
          <Kicker>UE Summary</Kicker>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {donuts.map(d => <Donut key={d.title} donut={d} />)}
          </div>
        </section>
      )}

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
        <Stat label="DL Throughput" value={dl.value} unit={dl.unit} hint={scope('sum')} />
        <Stat label="UL Throughput" value={ul.value} unit={ul.unit} hint={scope('sum')} />
        <Stat label="Connected UEs" value={fmt(view?.ues, 0)} hint={subset ? scope('on') : undefined} />
        <Stat label="Active UEs" value={fmt(view?.activeUes, 0)} hint={subset ? scope('on') : undefined} />
        <Stat label="DL PRB" value={fmt(view?.dlPrb, 1)} unit="%" hint={scope('mean')} />
        <Stat label="UL PRB" value={fmt(view?.ulPrb, 1)} unit="%" hint={scope('mean')} />
        <Stat label="DL Retx" value={fmt(latest?.dlRetxPct, 2)} unit="%" tone={retxTone(latest?.dlRetxPct)} hint={subset ? 'all cells' : undefined} />
        <Stat label="UL Retx" value={fmt(latest?.ulRetxPct, 2)} unit="%" tone={retxTone(latest?.ulRetxPct)} hint={subset ? 'all cells' : undefined} />
      </div>

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-2 px-4 py-2.5">
        <Info label="Cells" value={allRows.length || '—'} />
        {/* `time` is seconds since the process started; `duration` is only the
            interval since this connection's previous stats call. */}
        <Info label="Process uptime" value={fmtDuration(stats?.time)} />
        <Info label="Interval" value={stats?.duration === undefined ? '—' : `${fmt(stats.duration, 1)} s`} />
        {/* cpu.global is the process total where one core = 100 %. */}
        <Info label="Process CPU" value={cpu === undefined ? '—' : `${fmt(cpu, 0)} % · ${fmt(cpu / 100, 1)} cores`} />
        <Info label="RF ports" value={rfPorts ?? '—'} />
      </Card>

      {/* KPIs — one line per cell by default; the picker hides cells or adds a Total */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Kicker>KPIs</Kicker>
        <CellPicker cellIds={cellIds} selection={selection} onChange={onSelectionChange} />
      </div>
      {allRows.length > 0 && cells === 0 && !selection.showTotal ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          All cells are hidden — pick a cell or Total above.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TimeSeriesChart title="DL Throughput" unit="Mbps" rate data={series} series={perCell('dlMbps')} />
          <TimeSeriesChart title="UL Throughput" unit="Mbps" rate data={series} series={perCell('ulMbps')} />
          <TimeSeriesChart title="DL PRB Utilisation" unit="%" data={series} domain={[0, 100]} series={perCell('dlPrb', 'Mean (all cells)')} />
          <TimeSeriesChart title="UL PRB Utilisation" unit="%" data={series} domain={[0, 100]} series={perCell('ulPrb', 'Mean (all cells)')} />
          <TimeSeriesChart title="DL Scheduled UEs" data={series} digits={1} series={perCell('dlSched')} />
          <TimeSeriesChart title="Connected UEs" data={series} digits={1} series={perCell('ues')} />
          <TimeSeriesChart title="DL Retransmissions" unit="%" data={series} digits={2} series={perCell('dlRetxPct', 'All cells')} />
          <TimeSeriesChart title="UL Retransmissions" unit="%" data={series} digits={2} series={perCell('ulRetxPct', 'All cells')} />
        </div>
      )}
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

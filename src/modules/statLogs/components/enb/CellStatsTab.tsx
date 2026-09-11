// Cell tab — per-cell table and per-cell throughput, as Simnovator's
// Statistics → Cell.
'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { SERIES_COLORS, TimeSeriesChart } from './StatsCharts';
import { cellRows, fmt, type ModuleKey, type TimePoint, type CellRow } from './statsModel';

interface CellStatsTabProps {
  stats: any;
  series: TimePoint[];
  module: ModuleKey;
}

const COLUMNS: Array<{ label: string; value: (r: CellRow) => string; group?: 'dl' | 'ul' }> = [
  { label: 'DL Mbps',    value: r => fmt(r.dlMbps, 1),    group: 'dl' },
  { label: 'DL PRB avg', value: r => fmt(r.dlPrbAvg, 1),  group: 'dl' },
  { label: 'DL PRB max', value: r => fmt(r.dlPrbMax, 0),  group: 'dl' },
  { label: 'DL sched',   value: r => fmt(r.dlSched, 1),   group: 'dl' },
  { label: 'DL retx %',  value: r => fmt(r.dlRetxPct, 2), group: 'dl' },
  { label: 'DL err',     value: r => fmt(r.dlErr, 0),     group: 'dl' },
  { label: 'UL Mbps',    value: r => fmt(r.ulMbps, 1),    group: 'ul' },
  { label: 'UL PRB avg', value: r => fmt(r.ulPrbAvg, 1),  group: 'ul' },
  { label: 'UL PRB max', value: r => fmt(r.ulPrbMax, 0),  group: 'ul' },
  { label: 'UL sched',   value: r => fmt(r.ulSched, 1),   group: 'ul' },
  { label: 'UL retx %',  value: r => fmt(r.ulRetxPct, 2), group: 'ul' },
  { label: 'UL err',     value: r => fmt(r.ulErr, 0),     group: 'ul' },
  { label: 'UEs',        value: r => fmt(r.ues, 1) },
  { label: 'Active',     value: r => fmt(r.activeUes, 1) },
  { label: 'Inactive',   value: r => fmt(r.inactiveUes, 1) },
  { label: 'DRBs',       value: r => fmt(r.drbs, 1) },
];

const TH = 'whitespace-nowrap px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-label text-muted-foreground';

export function CellStatsTab({ stats, series, module }: CellStatsTabProps) {
  const rows = cellRows(stats);

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {module === 'mme' || module === 'ims'
          ? 'The core network has no radio cells. Cell statistics come from an eNB or gNB.'
          : 'No cell statistics in the latest update yet.'}
      </Card>
    );
  }

  // Keep the DL-orange / UL-teal convention the rest of the page uses: the UL
  // chart starts one step further along the palette, so a single-cell setup
  // does not draw both directions in the same colour.
  const perCell = (metric: 'dlMbps' | 'ulMbps') =>
    rows.map((r, i) => ({
      key: `cells.${r.id}.${metric}`,
      label: `Cell ${r.id}`,
      color: SERIES_COLORS[(metric === 'ulMbps' ? i + 1 : i) % SERIES_COLORS.length],
    }));

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className={`${TH} text-left`}>Cell</th>
                {COLUMNS.map(c => (
                  <th
                    key={c.label}
                    className={`${TH} text-right ${c.group === 'ul' ? 'text-brand-teal-600 dark:text-brand-teal-400' : c.group === 'dl' ? 'text-brand-orange-700 dark:text-brand-orange-400' : ''}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/60">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">Cell {r.id}</td>
                  {COLUMNS.map(c => (
                    <td key={c.label} className="num whitespace-nowrap px-3 py-2 text-right">
                      {c.value(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TimeSeriesChart title="DL Throughput per Cell" unit="Mbps" data={series} series={perCell('dlMbps')} />
        <TimeSeriesChart title="UL Throughput per Cell" unit="Mbps" data={series} series={perCell('ulMbps')} />
      </div>
    </div>
  );
}

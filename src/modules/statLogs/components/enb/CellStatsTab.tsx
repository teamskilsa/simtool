// Cell tab — per-cell table and per-cell throughput, as Simnovator's
// Statistics → Cell.
'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { TimeSeriesChart } from './StatsCharts';
import { CellPicker, cellColor, type CellSelection } from './CellPicker';
import { cellRows, fmt, rateUnit, type ModuleKey, type TimePoint, type CellRow, type RateUnit } from './statsModel';

interface CellStatsTabProps {
  stats: any;
  series: TimePoint[];
  module: ModuleKey;
  selection: CellSelection;
  onSelectionChange: React.Dispatch<React.SetStateAction<CellSelection>>;
}

const columns = (u: RateUnit, module: ModuleKey): Array<{ label: string; value: (r: CellRow) => string; group?: 'dl' | 'ul' }> => [
  { label: `DL ${u.unit}`, value: r => fmt(r.dlMbps * u.factor, u.digits), group: 'dl' },
  { label: 'DL PRB avg %', value: r => fmt(r.dlPrbAvg, 1),  group: 'dl' },
  { label: 'DL PRB max %', value: r => fmt(r.dlPrbMax, 0),  group: 'dl' },
  { label: 'DL sched',   value: r => fmt(r.dlSched, 1),   group: 'dl' },
  { label: 'DL retx %',  value: r => fmt(r.dlRetxPct, 2), group: 'dl' },
  { label: 'DL err',     value: r => fmt(r.dlErr, 0),     group: 'dl' },
  { label: `UL ${u.unit}`, value: r => fmt(r.ulMbps * u.factor, u.digits), group: 'ul' },
  { label: 'UL PRB avg %', value: r => fmt(r.ulPrbAvg, 1),  group: 'ul' },
  { label: 'UL PRB max %', value: r => fmt(r.ulPrbMax, 0),  group: 'ul' },
  { label: 'UL sched',   value: r => fmt(r.ulSched, 1),   group: 'ul' },
  { label: 'UL retx %',  value: r => fmt(r.ulRetxPct, 2), group: 'ul' },
  { label: 'UL err',     value: r => fmt(r.ulErr, 0),     group: 'ul' },
  { label: 'UEs',        value: r => fmt(r.ues, 1) },
  { label: 'Active',     value: r => fmt(r.activeUes, 1) },
  { label: 'Inactive',   value: r => fmt(r.inactiveUes, 1) },
  { label: module === 'gnb' ? 'DRBs' : 'E-RABs', value: r => fmt(r.drbs, 1) },
];

const TH = 'whitespace-nowrap px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-label text-muted-foreground';

export function CellStatsTab({ stats, series, module, selection, onSelectionChange }: CellStatsTabProps) {
  const rows = cellRows(stats);
  // One unit for the whole table, chosen from the visible window (the cell
  // totals bound every per-cell value) so the header doesn't flip between
  // bps and kbps on every poll.
  const COLUMNS = columns(
    rateUnit(Math.max(
      rows.reduce((m, r) => Math.max(m, r.dlMbps, r.ulMbps), 0),
      series.reduce((m, p) => Math.max(m, p.dlMbps, p.ulMbps), 0),
    )),
    module,
  );

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {module === 'mme' || module === 'ims'
          ? 'The core network has no radio cells. Cell statistics come from an eNB or gNB.'
          : 'No cell statistics in the latest update yet.'}
      </Card>
    );
  }

  // Same colour per cell as the Global tab, and the same cell picker.
  const cellIds = rows.map(r => r.id);
  const hidden = new Set(selection.hidden);
  const perCell = (metric: 'dlMbps' | 'ulMbps') => [
    ...rows.filter(r => !hidden.has(r.id)).map(r => ({
      key: `cells.${r.id}.${metric}`, label: `Cell ${r.id}`, color: cellColor(cellIds, r.id),
    })),
    ...(selection.showTotal ? [{ key: metric, label: 'Total (all cells)', color: '#5c7480', dashed: true }] : []),
  ];

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

      <div className="flex justify-end">
        <CellPicker cellIds={cellIds} selection={selection} onChange={onSelectionChange} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TimeSeriesChart title="DL Throughput per Cell" unit="Mbps" rate data={series} series={perCell('dlMbps')} />
        <TimeSeriesChart title="UL Throughput per Cell" unit="Mbps" rate data={series} series={perCell('ulMbps')} />
      </div>
    </div>
  );
}

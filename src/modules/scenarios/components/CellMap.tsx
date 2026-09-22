// The cell map: one tile per cell on the callbox, grouped the way carrier
// aggregation groups them (the live 6-cell layout is two groups of three).
// The UE marker sits on the PCell and moves as handovers happen.
//
// States: primary (PCell), carrier (aggregated SCell), attenuated (gain < 0),
// barred, idle.
'use client';

import { Radio, Ban, TrendingDown, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Kicker } from '@/components/ui/stat';
import { cn } from '@/lib/utils';
import type { CellInfo } from '../types';
import { cellGroups, cellRadioLabel, groupName } from '../lib/cellLabel';

export type CellState = 'primary' | 'carrier' | 'attenuated' | 'barred' | 'idle';

export function cellStateOf(c: CellInfo, pcell?: number, scells: number[] = [], gains?: Map<number, number>): CellState {
  const gain = gains?.get(c.id) ?? c.gain;
  if (c.id === pcell) return 'primary';
  if (scells.includes(c.id)) return 'carrier';
  if (c.barred === true) return 'barred';
  if (gain < 0) return 'attenuated';
  return 'idle';
}

const TILE: Record<CellState, string> = {
  primary: 'border-brand-orange bg-brand-orange/10 shadow-glow',
  carrier: 'border-brand-teal-500/60 bg-brand-teal-500/10',
  attenuated: 'border-amber-500/50 bg-amber-500/5',
  barred: 'border-destructive/50 bg-destructive/5',
  idle: 'border-border bg-muted/30',
};

const STATE_TEXT: Record<CellState, string> = {
  primary: 'PCell',
  carrier: 'aggregated',
  attenuated: 'attenuated',
  barred: 'barred',
  idle: 'idle',
};

function CellTile({ cell, state, gain, target }: { cell: CellInfo; state: CellState; gain: number; target?: boolean }) {
  return (
    <div className={cn('relative min-w-[8.5rem] flex-1 rounded-lg border-2 px-3 py-2 transition-colors duration-300', TILE[state],
      target && state !== 'primary' && 'ring-2 ring-brand-orange/40')}>
      <div className="flex items-center gap-1.5">
        <span className="num text-sm font-bold">Cell {cell.id}</span>
        {state === 'primary' && <Smartphone className="h-4 w-4 animate-pulse text-brand-orange" aria-label="UE is here" />}
        {state === 'carrier' && <Radio className="h-3.5 w-3.5 text-brand-teal-600 dark:text-brand-teal-400" />}
        {state === 'barred' && <Ban className="h-3.5 w-3.5 text-destructive" />}
        {state === 'attenuated' && <TrendingDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
      </div>
      <div className="num text-[11px] text-muted-foreground">{cellRadioLabel(cell)}</div>
      <div className="mt-1 flex items-center gap-1">
        <span className={cn('text-[10px] font-semibold uppercase tracking-label',
          state === 'primary' ? 'text-brand-orange' : state === 'carrier' ? 'text-brand-teal-600 dark:text-brand-teal-400' : 'text-muted-foreground')}>
          {STATE_TEXT[state]}
        </span>
        {gain !== 0 && <span className="num text-[10px] text-amber-700 dark:text-amber-400">{gain} dB</span>}
        <span className="num ml-auto text-[10px] text-muted-foreground">PCI {cell.pci}</span>
      </div>
    </div>
  );
}

export interface CellMapProps {
  cells: CellInfo[];
  /** Live PCell from the callbox (radio snapshot), if known. */
  pcell?: number;
  scells?: number[];
  /** Gains changed during the run (ramps, drive tests). */
  gains?: Map<number, number>;
  /** The cell the run is handing over to right now. */
  target?: number;
  hint?: string;
}

export function CellMap({ cells, pcell, scells = [], gains, target, hint }: CellMapProps) {
  if (!cells.length) {
    return <p className="p-3 text-xs text-muted-foreground">No cells read from the callbox yet.</p>;
  }
  const groups = cellGroups(cells);
  // Grouping is only worth drawing when carrier aggregation actually splits
  // the cells — one big component (or all singletons) reads better flat.
  const showGroups = groups.length > 1 && groups.some(g => g.length > 1);
  const carriers = pcell !== undefined ? 1 + scells.length : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Kicker>Cell map</Kicker>
        {pcell !== undefined ? (
          <span className="text-[11px] text-muted-foreground">
            UE on <b className="text-foreground">cell {pcell}</b>
            {scells.length > 0 && <> · {carriers} carriers aggregated ({scells.join(', ')})</>}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">{hint ?? 'Waiting for the UE…'}</span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Badge variant="outline" className="h-5 border-brand-orange px-1.5 text-[10px] font-normal">PCell</Badge>
          <Badge variant="outline" className="h-5 border-brand-teal-500/60 px-1.5 text-[10px] font-normal">aggregated</Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">idle</Badge>
        </div>
      </div>

      {showGroups ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {groups.map((g, i) => {
            const holdsUe = pcell !== undefined && g.some(c => c.id === pcell);
            return (
              <div key={g[0].id} className={cn('rounded-lg border border-dashed p-2', holdsUe ? 'border-brand-orange/60 bg-brand-orange/[0.03]' : 'border-border')}>
                <Kicker className="mb-1.5">
                  Group {groupName(i)} — cells {g.map(c => c.id).join(', ')}
                  {holdsUe ? ' · UE here' : ''}
                </Kicker>
                <div className="flex flex-wrap gap-2">
                  {g.map(c => (
                    <CellTile key={c.id} cell={c} state={cellStateOf(c, pcell, scells, gains)} gain={gains?.get(c.id) ?? c.gain} target={target === c.id} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cells.map(c => (
            <CellTile key={c.id} cell={c} state={cellStateOf(c, pcell, scells, gains)} gain={gains?.get(c.id) ?? c.gain} target={target === c.id} />
          ))}
        </div>
      )}
    </div>
  );
}

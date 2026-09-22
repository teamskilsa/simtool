// Which cells the Stats charts draw. Every cell is shown by default; the user
// hides the ones they don't want, and can add a Total (or mean) line.
'use client';

import React from 'react';
import { Kicker } from '@/components/ui/stat';
import { cn } from '@/lib/utils';
import { SERIES_COLORS } from './StatsCharts';

/** One colour per cell, the same in every chart. */
export const cellColor = (cellIds: string[], id: string) =>
  SERIES_COLORS[Math.max(0, cellIds.indexOf(id)) % SERIES_COLORS.length];

export interface CellSelection {
  /** Hidden rather than shown, so cells that appear later start visible. */
  hidden: string[];
  showTotal: boolean;
}

interface CellPickerProps {
  cellIds: string[];
  selection: CellSelection;
  /** A state setter: updates are applied to the latest selection, so quick
   *  successive clicks don't overwrite each other. */
  onChange: React.Dispatch<React.SetStateAction<CellSelection>>;
}

export function CellPicker({ cellIds, selection, onChange }: CellPickerProps) {
  if (cellIds.length === 0) return null;
  const hidden = new Set(selection.hidden);
  const allShown = cellIds.every(id => !hidden.has(id));
  const toggle = (id: string) => onChange(prev => ({
    ...prev,
    hidden: prev.hidden.includes(id) ? prev.hidden.filter(h => h !== id) : [...prev.hidden, id],
  }));

  const chip = 'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors';
  const on = 'border-foreground/25 bg-card text-foreground';
  const off = 'border-dashed border-border bg-transparent text-muted-foreground line-through decoration-muted-foreground/60';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Kicker className="mr-1">Cells</Kicker>
      <button
        type="button"
        className={cn(chip, allShown ? on : off, 'no-underline')}
        style={{ textDecoration: 'none' }}
        onClick={() => onChange(prev => ({ ...prev, hidden: allShown ? [...cellIds] : [] }))}
        aria-pressed={allShown}
      >
        {allShown ? 'All' : 'Show all'}
      </button>
      {cellIds.map(id => {
        const shown = !hidden.has(id);
        return (
          <button key={id} type="button" className={cn(chip, shown ? on : off)} onClick={() => toggle(id)} aria-pressed={shown}>
            <span className="h-2 w-2 rounded-full" style={{ background: shown ? cellColor(cellIds, id) : 'transparent', boxShadow: `inset 0 0 0 1.5px ${cellColor(cellIds, id)}` }} />
            Cell {id}
          </button>
        );
      })}
      <span className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        className={cn(chip, selection.showTotal ? on : off)}
        style={selection.showTotal ? undefined : { textDecoration: 'none' }}
        onClick={() => onChange(prev => ({ ...prev, showTotal: !prev.showTotal }))}
        aria-pressed={selection.showTotal}
      >
        <span className="h-0.5 w-3 rounded bg-foreground/70" />
        Total
      </button>
    </div>
  );
}

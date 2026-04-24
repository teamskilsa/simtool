// Multi-cell tab strip — lets users add/switch/remove NR cells
// for a single enb.cfg with multiple nr_cell_list entries.
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { NRFormState, NRCellEntry } from './constants';
import { makeDefaultCell } from './constants';

// Fields that belong to a cell (everything else is shared in nr_cell_default).
const CELL_FIELDS: (keyof NRCellEntry)[] = [
  'cellId', 'band', 'nrBandwidth', 'subcarrierSpacing',
  'dlNrArfcn', 'ssbPosBitmap', 'nrTdd', 'fr2', 'tddPattern',
];

/** Snapshot the current flat-state cell fields into a NRCellEntry. */
function snapshotActiveCell(form: NRFormState): NRCellEntry {
  const name = form.cells?.[form.activeCellIdx]?.name || 'Cell 1';
  return {
    name,
    cellId: form.cellId, band: form.band, nrBandwidth: form.nrBandwidth,
    subcarrierSpacing: form.subcarrierSpacing, dlNrArfcn: form.dlNrArfcn,
    ssbPosBitmap: form.ssbPosBitmap, nrTdd: form.nrTdd, fr2: form.fr2,
    tddPattern: form.tddPattern,
  };
}

/** Apply a cell's fields onto the flat form state. */
function applyCellToFlatState(
  cell: NRCellEntry,
  onChange: (key: string, value: any) => void,
) {
  onChange('cellId', cell.cellId);
  onChange('band', cell.band);
  onChange('nrBandwidth', cell.nrBandwidth);
  onChange('subcarrierSpacing', cell.subcarrierSpacing);
  onChange('dlNrArfcn', cell.dlNrArfcn);
  onChange('ssbPosBitmap', cell.ssbPosBitmap);
  onChange('nrTdd', cell.nrTdd);
  onChange('fr2', cell.fr2);
  onChange('tddPattern', cell.tddPattern);
}

interface CellTabsProps {
  form: NRFormState;
  onChange: (key: string, value: any) => void;
}

export function CellTabs({ form, onChange }: CellTabsProps) {
  const cells = form.cells || [makeDefaultCell('Cell 1')];
  const activeIdx = form.activeCellIdx ?? 0;

  const switchTo = (newIdx: number) => {
    if (newIdx === activeIdx) return;
    // 1. Save current flat state into the current cell slot
    const snapshot = snapshotActiveCell(form);
    const next = [...cells];
    next[activeIdx] = snapshot;
    onChange('cells', next);
    onChange('activeCellIdx', newIdx);
    // 2. Load target cell into the flat state
    applyCellToFlatState(next[newIdx], onChange);
  };

  const addCell = () => {
    // Save current first
    const snapshot = snapshotActiveCell(form);
    const current = [...cells];
    current[activeIdx] = snapshot;
    // Create new cell with a unique cellId and name
    const newName = `Cell ${current.length + 1}`;
    const newCell = makeDefaultCell(newName, {
      cellId: 500 + current.length,
      band: snapshot.band,
      nrBandwidth: snapshot.nrBandwidth,
    });
    const next = [...current, newCell];
    onChange('cells', next);
    onChange('activeCellIdx', next.length - 1);
    applyCellToFlatState(newCell, onChange);
  };

  const removeCell = (idx: number) => {
    if (cells.length <= 1) return; // keep at least one cell
    if (!confirm(`Remove ${cells[idx].name}?`)) return;
    const next = cells.filter((_, i) => i !== idx);
    let newActive = activeIdx;
    if (idx < activeIdx) newActive = activeIdx - 1;
    else if (idx === activeIdx) newActive = Math.max(0, idx - 1);
    onChange('cells', next);
    onChange('activeCellIdx', newActive);
    applyCellToFlatState(next[newActive], onChange);
  };

  const renameCell = (idx: number) => {
    const newName = prompt(`Rename ${cells[idx].name}:`, cells[idx].name);
    if (!newName || !newName.trim()) return;
    const next = cells.map((c, i) => i === idx ? { ...c, name: newName.trim() } : c);
    onChange('cells', next);
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-indigo-50/40 rounded-lg border border-indigo-100 overflow-x-auto">
      <span className="text-xs font-semibold uppercase text-indigo-700 px-2 shrink-0">Cells:</span>
      <TooltipProvider>
        {cells.map((cell, idx) => {
          const isActive = idx === activeIdx;
          return (
            <div key={idx} className={`flex items-center gap-0.5 rounded-md ${
              isActive ? 'bg-indigo-600 shadow-sm' : 'bg-white border'
            }`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => switchTo(idx)}
                    onDoubleClick={() => renameCell(idx)}
                    className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                      isActive ? 'text-white' : 'text-gray-700 hover:text-indigo-600'
                    }`}
                  >
                    {cell.name}
                    <span className={`ml-1 text-[10px] ${isActive ? 'text-indigo-200' : 'text-gray-400'}`}>
                      n{isActive ? form.band : cell.band}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Double-click to rename</TooltipContent>
              </Tooltip>
              {cells.length > 1 && (
                <button
                  onClick={() => removeCell(idx)}
                  className={`p-1 mr-0.5 rounded hover:bg-red-500 hover:text-white ${
                    isActive ? 'text-indigo-200' : 'text-gray-400'
                  }`}
                  title="Remove cell"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </TooltipProvider>
      <Button
        size="sm"
        variant="outline"
        onClick={addCell}
        className="h-7 gap-1 text-xs bg-white hover:bg-indigo-50 hover:border-indigo-300 shrink-0"
      >
        <Plus className="w-3 h-3" /> Add Cell
      </Button>
    </div>
  );
}

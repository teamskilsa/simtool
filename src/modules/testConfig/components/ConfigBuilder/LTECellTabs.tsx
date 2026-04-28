// LTE multi-cell tab strip — mirror of CellTabs (NR) but for LTE/eNB carrier
// aggregation. Lets users add/switch/remove cells in cell_list.
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { LTEFormState, LTECellEntry } from './lteConstants';
import { makeDefaultLteCell } from './lteConstants';

/** Snapshot the current flat-state cell fields into an LTECellEntry. */
function snapshotActiveCell(form: LTEFormState): LTECellEntry {
  const cur = form.cells?.[form.activeCellIdx];
  const name = cur?.name || 'Cell 1';
  return {
    name,
    cellId: form.cellId,
    pci: form.pci,
    tac: form.tac,
    rfPort: form.rfPort,
    band: form.band,
    bandwidth: form.bandwidth,
    dlEarfcn: form.dlEarfcn,
    rootSequenceIndex: cur?.rootSequenceIndex ?? 204,
    cellBarred: form.cellBarred,
    tddConfig: form.tddConfig,
    tddSpecialSubframe: form.tddSpecialSubframe,
  };
}

/** Apply a cell's fields onto the flat form state. */
function applyCellToFlatState(cell: LTECellEntry, onChange: (k: string, v: any) => void) {
  onChange('cellId', cell.cellId);
  onChange('pci', cell.pci);
  onChange('tac', cell.tac);
  onChange('rfPort', cell.rfPort);
  onChange('band', cell.band);
  onChange('bandwidth', cell.bandwidth);
  onChange('dlEarfcn', cell.dlEarfcn);
  onChange('cellBarred', cell.cellBarred);
  onChange('tddConfig', cell.tddConfig);
  onChange('tddSpecialSubframe', cell.tddSpecialSubframe);
}

interface LTECellTabsProps {
  form: LTEFormState;
  onChange: (key: string, value: any) => void;
}

export function LTECellTabs({ form, onChange }: LTECellTabsProps) {
  const cells = form.cells || [makeDefaultLteCell('Cell 1')];
  const activeIdx = form.activeCellIdx ?? 0;

  const switchTo = (newIdx: number) => {
    if (newIdx === activeIdx) return;
    const snapshot = snapshotActiveCell(form);
    const next = [...cells];
    next[activeIdx] = snapshot;
    onChange('cells', next);
    onChange('activeCellIdx', newIdx);
    applyCellToFlatState(next[newIdx], onChange);
  };

  const addCell = () => {
    const snapshot = snapshotActiveCell(form);
    const current = [...cells];
    current[activeIdx] = snapshot;
    const newName = `Cell ${current.length + 1}`;
    const newCell = makeDefaultLteCell(newName, {
      cellId: snapshot.cellId + 1,
      pci: snapshot.pci + 1,
      rfPort: current.length,
      band: snapshot.band,
      bandwidth: snapshot.bandwidth,
      dlEarfcn: snapshot.dlEarfcn,
    });
    const next = [...current, newCell];
    onChange('cells', next);
    onChange('activeCellIdx', next.length - 1);
    applyCellToFlatState(newCell, onChange);
  };

  const removeCell = (idx: number) => {
    if (cells.length <= 1) return;
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
                      B{isActive ? form.band : cell.band}
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

// Reproduction: SSB ARFCN (gscn) leaks between cells when you switch cell tabs.
//
// CELL_FIELDS / snapshotActiveCell() in CellTabs.tsx list every per-cell field
// EXCEPT ssbArfcn, and NRCellEntry has no ssbArfcn at all. The generator,
// however, does emit gscn per cell. So the value has nowhere to be stored per
// cell and simply stays in the flat form state across a tab switch.
//
// This replays exactly what CellTabs does on a switch, then generates.
import { generateNRConfig } from '../../src/modules/testConfig/components/ConfigBuilder/configGenerator';
import {
  DEFAULT_NR_FORM, makeDefaultCell, type NRFormState, type NRCellEntry,
} from '../../src/modules/testConfig/components/ConfigBuilder/constants';

// --- verbatim copies of the two helpers in CellTabs.tsx ---------------------
function snapshotActiveCell(form: NRFormState): NRCellEntry {
  const name = form.cells?.[form.activeCellIdx]?.name || 'Cell 1';
  return {
    name,
    cellId: form.cellId, pci: form.pci, band: form.band, nrBandwidth: form.nrBandwidth,
    subcarrierSpacing: form.subcarrierSpacing, dlNrArfcn: form.dlNrArfcn,
    ssbPosBitmap: form.ssbPosBitmap, ssbArfcn: form.ssbArfcn ?? null,
    nrTdd: form.nrTdd, fr2: form.fr2,
    tddPattern: form.tddPattern,
  };
}
function applyCellToFlatState(cell: NRCellEntry, set: (k: string, v: any) => void) {
  set('cellId', cell.cellId); set('pci', cell.pci); set('band', cell.band); set('nrBandwidth', cell.nrBandwidth);
  set('subcarrierSpacing', cell.subcarrierSpacing); set('dlNrArfcn', cell.dlNrArfcn);
  set('ssbPosBitmap', cell.ssbPosBitmap); set('ssbArfcn', cell.ssbArfcn ?? null);
  set('nrTdd', cell.nrTdd); set('fr2', cell.fr2);
  set('tddPattern', cell.tddPattern);
}

// --- drive it like the UI --------------------------------------------------
let form: NRFormState = {
  ...DEFAULT_NR_FORM,
  cells: [makeDefaultCell('Cell 1', { cellId: 1, dlNrArfcn: 632628 }),
          makeDefaultCell('Cell 2', { cellId: 2, dlNrArfcn: 636666 })],
  activeCellIdx: 0,
  cellId: 1, dlNrArfcn: 632628,
} as NRFormState;
const set = (k: string, v: any) => { form = { ...form, [k]: v } as NRFormState; };

console.log('1. On Cell 1, user ticks "SSB ARFCN" and enters GSCN 7811');
set('ssbArfcn', 7811);

const cfgA = generateNRConfig(form);
const gscnA = [...cfgA.matchAll(/cell_id:\s*(\d+),[\s\S]*?(?:gscn:\s*(\d+),)?\n\s*}/g)];
console.log('   cfg now:', (cfgA.match(/gscn:\s*\d+/g) || ['(none)']).join(', '));

console.log('\n2. User clicks the "Cell 2" tab (exact CellTabs.switchTo logic)');
const snapshot = snapshotActiveCell(form);
const next = [...(form.cells as NRCellEntry[])];
next[form.activeCellIdx] = snapshot;
set('cells', next);
set('activeCellIdx', 1);
applyCellToFlatState(next[1], set);

console.log('   Cell 1 stored as:', JSON.stringify({ ...snapshot, tddPattern: undefined }));
console.log('   flat form.ssbArfcn is now:', (form as any).ssbArfcn);

console.log('\n3. User saves. What lands in the cfg:');
const cfgB = generateNRConfig(form);
for (const block of cfgB.split('{').filter(b => b.includes('cell_id'))) {
  const id = block.match(/cell_id:\s*(\d+)/)?.[1];
  const gscn = block.match(/gscn:\s*(\d+)/)?.[1];
  console.log(`   cell_id ${id}: gscn ${gscn ?? '(none)'}`);
}

const cell1HasGscn = /cell_id:\s*1,[\s\S]{0,300}?gscn:\s*7811/.test(cfgB);
const cell2HasGscn = /cell_id:\s*2,[\s\S]{0,300}?gscn:\s*7811/.test(cfgB);

console.log('\n--- verdict ---');
console.log(`  Cell 1 (where the user set it) keeps gscn 7811 : ${cell1HasGscn ? 'yes' : 'NO'}`);
console.log(`  Cell 2 (untouched) wrongly gets gscn 7811      : ${cell2HasGscn ? 'YES' : 'no'}`);

const correct = cell1HasGscn && !cell2HasGscn;
console.log(correct
  ? '\n  PASS: the GSCN stayed on Cell 1 and did not leak onto Cell 2.'
  : '\n  FAIL: the GSCN moved between cells (regression).');
process.exit(correct ? 0 : 1);

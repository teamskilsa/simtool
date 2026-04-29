// Pre-save form validation.
//
// Each <Field> component already shows inline red feedback when a single
// number input drifts outside its declared [min, max]. That catches typos
// at the input. This module is the second line of defence: walks the
// whole form right before Save and produces a flat list of issues so
// CreateTestView can block the save with a clear toast — instead of the
// user finding out about a bad value via Amarisoft's startup message
// (e.g. "field 'cell_id': range is [0:255]").
//
// Numbers come straight from Amarisoft's enb.cfg / mme.cfg constraints.
// Where Amarisoft accepts a discrete set (n_rb_dl ∈ {6,15,25,...}) those
// are already enforced via Select dropdowns and don't need to live here.

import type { NRFormState } from './constants';
import type { LTEFormState } from './lteConstants';

// Core configs reuse NRFormState (the Create Test view passes nrForm to
// generateCoreConfig). Validation is just the PLMN + TAC subset.
type CoreFormState = NRFormState;

export interface ValidationIssue {
  field: string;       // human-readable label, used in the toast
  message: string;     // short reason, e.g. "must be 0-255"
}

const range = (label: string, value: number | null | undefined, min: number, max: number): ValidationIssue | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return { field: label, message: 'must be a number' };
  }
  if (value < min || value > max) return { field: label, message: `must be ${min}–${max}` };
  return null;
};

const plmnDigits = (label: string, mcc: string, mnc: string): ValidationIssue[] => {
  const out: ValidationIssue[] = [];
  if (!/^\d{3}$/.test(mcc)) out.push({ field: `${label} MCC`, message: 'must be exactly 3 digits' });
  if (!/^\d{2,3}$/.test(mnc)) out.push({ field: `${label} MNC`, message: 'must be 2 or 3 digits' });
  return out;
};

const ipv4 = (label: string, value: string): ValidationIssue | null => {
  if (!value) return { field: label, message: 'is required' };
  // Lenient: accept IPv4 dotted-quad, IPv6, or a hostname. Amarisoft
  // resolves whatever you give it, so we just block obvious garbage.
  if (/[^0-9a-fA-F:.]/.test(value) && !/^[a-zA-Z][\w.-]*$/.test(value)) {
    return { field: label, message: 'is not a valid address' };
  }
  return null;
};

// ────────────────────────────────────────────────────────────────────────────
// NR (5G) — fields that go into nr_cell_list[] and nr_cell_default
// ────────────────────────────────────────────────────────────────────────────
export function validateNRForm(form: NRFormState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (i: ValidationIssue | null) => { if (i) issues.push(i); };

  // The active cell's per-cell fields live as TOP-LEVEL form fields
  // (form.cellId, form.dlNrArfcn, ...). The cells[] array stores the
  // non-active cells; cells[activeCellIdx] is stale until the user
  // switches cells. Mirror the generator's logic — apply top-level
  // values to the active slot when validating the cell list.
  const baseCells = form.cells && form.cells.length > 0 ? form.cells : [{
    name: 'Cell 1',
    cellId: form.cellId, band: form.band, nrBandwidth: form.nrBandwidth,
    subcarrierSpacing: form.subcarrierSpacing, dlNrArfcn: form.dlNrArfcn,
    ssbPosBitmap: form.ssbPosBitmap, nrTdd: form.nrTdd, fr2: form.fr2,
    tddPattern: form.tddPattern,
  } as any];
  const activeIdx = form.cells && form.cells.length > 0 ? (form.activeCellIdx ?? 0) : 0;
  const cells = baseCells.map((c: any, i: number) => i === activeIdx ? {
    ...c,
    cellId: form.cellId,
    dlNrArfcn: form.dlNrArfcn,
    ssbPosBitmap: form.ssbPosBitmap,
  } : c);

  for (const c of cells) {
    const tag = cells.length > 1 ? `${c.name} ` : '';
    push(range(`${tag}Cell ID (n_id_cell)`, c.cellId, 0, 1007));
    push(range(`${tag}DL NR-ARFCN`,         c.dlNrArfcn, 0, 3279165));
    if (!/^[01]+$/.test(c.ssbPosBitmap || '')) {
      issues.push({ field: `${tag}SSB Position Bitmap`, message: 'must be a binary string (e.g. "10000000")' });
    }
  }

  push(range('SSB Period',     form.ssbPeriod, 5, 160));
  push(range('TAC',            form.tac, 0, 65535));
  push(range('DL Antennas',    form.nAntennaDl, 1, 8));
  push(range('UL Antennas',    form.nAntennaUl, 1, 8));
  if (form.ssbArfcn !== null && form.ssbArfcn !== undefined) {
    push(range('SSB ARFCN (gscn)', form.ssbArfcn, 0, 26639));
  }
  for (const i of plmnDigits('PLMN', form.plmn?.mcc ?? '', form.plmn?.mnc ?? '')) issues.push(i);
  if (form.amfAddr) push(ipv4('AMF Address', form.amfAddr));
  if (form.gtpAddr) push(ipv4('GTP Address', form.gtpAddr));

  // gNB ID is a hex string like '0x12345' — Amarisoft accepts up to 32 bits.
  if (form.gnbId) {
    const m = String(form.gnbId).trim().match(/^(?:0x)?([0-9a-fA-F]+)$/);
    if (!m) {
      issues.push({ field: 'gNB ID', message: 'must be a hex value (e.g. 0x12345)' });
    } else if (BigInt('0x' + m[1]) >= BigInt('0x100000000')) {
      issues.push({ field: 'gNB ID', message: 'must fit in 32 bits' });
    }
  }

  return issues;
}

// ────────────────────────────────────────────────────────────────────────────
// LTE / NB-IoT / CAT-M — fields that go into cell_list[] and cell_default
// ────────────────────────────────────────────────────────────────────────────
export function validateLTEForm(form: LTEFormState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (i: ValidationIssue | null) => { if (i) issues.push(i); };

  // Same active-cell mirror trick as the NR validator: form.cellId
  // / form.pci / form.tac / form.dlEarfcn always reflect the active
  // cell, while cells[activeCellIdx] may be stale until the user
  // switches cells.
  const baseCells = form.cells && form.cells.length > 0 ? form.cells : [{
    name: 'Cell 1', cellId: form.cellId, pci: form.pci, tac: form.tac,
    rfPort: form.rfPort, band: form.band, bandwidth: form.bandwidth, dlEarfcn: form.dlEarfcn,
  } as any];
  const activeIdx = form.cells && form.cells.length > 0 ? (form.activeCellIdx ?? 0) : 0;
  const cells = baseCells.map((c: any, i: number) => i === activeIdx ? {
    ...c,
    cellId: form.cellId,
    pci: form.pci,
    tac: form.tac,
    rfPort: form.rfPort,
    dlEarfcn: form.dlEarfcn,
  } : c);

  for (const c of cells) {
    const tag = cells.length > 1 ? `${c.name} ` : '';
    // The big one — Amarisoft enforces lteenb cell_id strictly to 1 byte.
    push(range(`${tag}Cell ID`,    c.cellId, 0, 255));
    push(range(`${tag}PCI`,        c.pci, 0, 503));
    push(range(`${tag}TAC`,        c.tac ?? form.tac, 0, 65535));
    push(range(`${tag}RF Port`,    c.rfPort ?? 0, 0, 7));
    push(range(`${tag}DL EARFCN`,  c.dlEarfcn, 0, 262143));
  }

  push(range('Max UE Power',           form.pMax,           -30, 33));
  push(range('Min RX Level',           form.qRxLevMin,      -140, -44));
  push(range('SI Window Length',       form.siWindowLength, 1, 40));
  push(range('UL Max HARQ Tx',         form.ulMaxHarqTx,    1, 28));
  push(range('DL Max HARQ Tx',         form.dlMaxHarqTx,    1, 28));

  for (const i of plmnDigits('PLMN', form.plmn?.mcc ?? '', form.plmn?.mnc ?? '')) issues.push(i);
  if (form.mmeAddr) push(ipv4('MME Address', form.mmeAddr));
  if (form.gtpAddr) push(ipv4('GTP Address', form.gtpAddr));

  if (form.enbId) {
    const m = String(form.enbId).trim().match(/^(?:0x)?([0-9a-fA-F]+)$/);
    if (!m) {
      issues.push({ field: 'eNB ID', message: 'must be a hex value (e.g. 0x1A2D0)' });
    } else if (BigInt('0x' + m[1]) >= BigInt('0x100000')) {
      // Amarisoft eNB ID is 20 bits (macro eNB) by default.
      issues.push({ field: 'eNB ID', message: 'must fit in 20 bits' });
    }
  }

  return issues;
}

// ────────────────────────────────────────────────────────────────────────────
// Core / MME / EPC
// ────────────────────────────────────────────────────────────────────────────
export function validateCoreForm(form: CoreFormState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (i: ValidationIssue | null) => { if (i) issues.push(i); };

  for (const i of plmnDigits('PLMN', form.plmn?.mcc ?? '', form.plmn?.mnc ?? '')) issues.push(i);
  push(range('TAC',          form.tac, 0, 65535));
  // mme_group + mme_code are stored as numbers. Optional in some configs.
  if ((form as any).mmeGroupId !== undefined) push(range('MME Group ID', (form as any).mmeGroupId, 0, 65535));
  if ((form as any).mmeCode    !== undefined) push(range('MME Code',     (form as any).mmeCode,    0, 255));

  return issues;
}

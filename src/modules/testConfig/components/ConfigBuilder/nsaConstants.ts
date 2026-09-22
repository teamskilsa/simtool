// NSA / EN-DC config state — single .cfg with BOTH LTE anchor cells and
// NR secondary cells. We wrap the existing LTE and NR form schemas so each
// side can be edited with its native builder.
import { DEFAULT_LTE_FORM, type LTEFormState } from './lteConstants';
import { DEFAULT_NR_FORM, type NRFormState } from './constants';

export interface NSAFormState {
  /** LTE anchor side (cell_list, cell_default, mme_list, enb_id) */
  lteForm: LTEFormState;
  /** NR secondary side (nr_cell_list, nr_cell_default, gnb_id) */
  nrForm: NRFormState;
}

export const DEFAULT_NSA_FORM: NSAFormState = {
  lteForm: { ...DEFAULT_LTE_FORM },
  // NR ids start at 2: the LTE anchor defaults to cell_id 1, and LTE and NR
  // cells share one cell_id space inside lteenb.
  nrForm:  { ...DEFAULT_NR_FORM, cellId: 2, cells: DEFAULT_NR_FORM.cells.map((c, i) => ({ ...c, cellId: 2 + i })) },
};

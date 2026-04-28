// Generates an NSA / EN-DC enb.cfg — combines LTE anchor cells and NR
// secondary cells into a single Amarisoft config file.
//
// Approach: re-use the LTE and NR generators, then splice out their cell-list
// blocks and merge them under a single { ... } root. Shared top-level fields
// (rf_driver, mme_list, gtp_addr, log_*) come from the LTE form so the file
// looks like a real lteenb NSA config.
import type { NSAFormState } from './nsaConstants';
import { generateLTEConfig } from './lteConfigGenerator';
import { generateNRConfig } from './configGenerator';

/**
 * Pull a labelled block out of generated text. Returns the inside of
 *   `<key>: [ ... ]` as a string, or '' if missing.
 */
function extractListBlock(src: string, key: string): string {
  const re = new RegExp(`${key}\\s*:\\s*\\[`);
  const m = src.match(re);
  if (!m) return '';
  let i = (m.index ?? 0) + m[0].length;
  let depth = 1;
  const start = i;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '[') depth++;
    else if (c === ']') depth--;
    if (depth === 0) break;
    i++;
  }
  return src.slice(start, i).trim();
}

/** Pull a labelled OBJECT block out of generated text: `<key>: { ... }` */
function extractObjectBlock(src: string, key: string): string {
  const re = new RegExp(`${key}\\s*:\\s*\\{`);
  const m = src.match(re);
  if (!m) return '';
  let i = (m.index ?? 0) + m[0].length;
  let depth = 1;
  const start = i;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (depth === 0) break;
    i++;
  }
  return src.slice(start, i).trim();
}

export function generateNSAConfig(form: NSAFormState): string {
  // Generate both sides independently so we can borrow their formatted blocks
  const lteText = generateLTEConfig(form.lteForm, 'lte');
  const nrText  = generateNRConfig(form.nrForm);

  const lteCellList = extractListBlock(lteText, 'cell_list');
  const nrCellList  = extractListBlock(nrText,  'nr_cell_list');
  const nrCellDefault = extractObjectBlock(nrText, 'nr_cell_default');

  // Borrow log + RF + network from the LTE form
  const f = form.lteForm;
  const logParts: string[] = [`all.level=${f.logLevel || 'error'}`, 'all.max_size=0'];
  for (const [layer, level] of Object.entries(f.logLayers || {})) {
    if (level && level !== f.logLevel) {
      logParts.push(`${layer}.level=${level}`, `${layer}.max_size=1`);
    }
  }

  const formatPlmn = (mcc: string, mnc: string) => {
    const m1 = mcc.padStart(3, '0').slice(-3);
    const len = mnc.length >= 3 ? 3 : 2;
    const m2 = mnc.padStart(len, '0').slice(-len);
    return m1 + m2;
  };

  return `/* NSA / EN-DC eNB+gNB Configuration
 * Generated: ${new Date().toISOString()}
 * LTE anchor: ${form.lteForm.cells.length} cell${form.lteForm.cells.length === 1 ? '' : 's'} (band ${f.band})
 * NR secondary: ${form.nrForm.cells.length} cell${form.nrForm.cells.length === 1 ? '' : 's'} (band n${form.nrForm.band})
 */

{
  log_options: "${logParts.join(',')}",
  log_filename: "${f.logFilename || '/tmp/enb-nsa.log'}",
  com_addr: "[::]:9001",

  rf_driver: {
    name: "${f.rfMode}",
    args: "${f.rfArgs}",
    rx_antenna: "${f.rxAntenna}",
  },
  tx_gain: ${f.txGain},
  rx_gain: ${f.rxGain},

  mme_list: [
    { mme_addr: "${f.mmeAddr}" },
  ],
  gtp_addr: "${f.gtpAddr}",
  enb_id: ${f.enbId},
  gnb_id_bits: 28,
  gnb_id: ${form.nrForm.gnbId},

  /* LTE anchor cells (E-UTRA) */
  cell_list: [${lteCellList}],

  /* NR secondary cells (NR EN-DC) */
  nr_cell_list: [${nrCellList}],

  nr_cell_default: {${nrCellDefault}},

  /* Shared PLMN / TAC */
  plmn_list: [{
    plmn: "${formatPlmn(f.plmn.mcc, f.plmn.mnc)}",
    attach_without_pdn: ${f.attachWithoutPdn},
    reserved: ${f.plmnReserved},
  }],
}
`;
}

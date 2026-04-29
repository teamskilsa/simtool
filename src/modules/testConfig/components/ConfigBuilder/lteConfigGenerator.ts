// Generates Amarisoft enb.cfg for LTE / NB-IoT / CAT-M1
import type { LTEFormState, LTECellEntry } from './lteConstants';
import { LTE_TDD_BANDS, makeDefaultLteCell } from './lteConstants';
import { formatGain } from './rfDefaults';

/**
 * Format PLMN string: MCC (3-digit) + MNC (2- or 3-digit, zero-padded).
 * enb.cfg: cell_list[].plmn_list[].plmn — e.g. "00101" (MCC=001, MNC=01)
 */
function formatPlmn(mcc: string, mnc: string): string {
  const paddedMcc = mcc.padStart(3, '0').slice(-3);
  const mncLen = mnc.length >= 3 ? 3 : 2;
  const paddedMnc = mnc.padStart(mncLen, '0').slice(-mncLen);
  return `${paddedMcc}${paddedMnc}`;
}

/**
 * LTE channel bandwidth (MHz) → number of resource blocks. Amarisoft's
 * enb.cfg per-cell field is `n_rb_dl`, NOT `bandwidth` — emitting the
 * MHz value as `bandwidth: 5` gets you
 *   config/enb.cfg:45:7: expecting 'n_rb_dl' field
 * (NR cells DO use `bandwidth` in nr_cell_default — this only applies
 * to the LTE cell list.)
 */
function mhzToRbLte(mhz: number): number {
  // Form stores 1.4 as the literal 1.4 number. Round to one decimal
  // before lookup so 1.40000001 still resolves.
  const key = Math.round(Number(mhz) * 10) / 10;
  const map: Record<string, number> = {
    '1.4': 6, '3': 15, '5': 25, '10': 50, '15': 75, '20': 100,
  };
  return map[String(key)] ?? 50;  // 10 MHz default if something weird
}

export function generateLTEConfig(form: LTEFormState, ratMode: 'lte' | 'nbiot' | 'catm'): string {
  const isTdd = LTE_TDD_BANDS.includes(form.band);
  const ratLabel = ratMode === 'nbiot' ? 'NB-IoT' : ratMode === 'catm' ? 'CAT-M1 (eMTC)' : 'LTE';

  // ── log_options: build the same way NR generator does, honouring per-layer overrides ──
  // enb.cfg: log_options — e.g. "all.level=error,all.max_size=0,nas.level=debug,nas.max_size=1"
  const logParts: string[] = [];
  const lvl = form.logLevel || 'error';
  logParts.push(`all.level=${lvl}`, 'all.max_size=0');
  for (const [layer, level] of Object.entries(form.logLayers || {})) {
    if (level && level !== lvl) {
      logParts.push(`${layer}.level=${level}`, `${layer}.max_size=1`);
    }
  }
  const logOptions = logParts.join(',');

  // ── cipher / integ algo arrays ───────────────────────────────────────────────
  // Amarisoft's parser expects INTEGER values, AND on lteenb 2026-04-22+
  // the valid range is 1–3 ONLY. Earlier rounds of this bug:
  //   ["eea0", "eea2"]   → "algorithm identifier expected"
  //   [EEA0, EEA2]       → "unexpected identifier: EEA0"
  //   [0, 2, 3]          → "valid algorithm identifiers are between 1 and 3"
  //
  // 1=EEA1/SNOW, 2=EEA2/AES, 3=EEA3/ZUC (similarly for EIAn). 0 (null
  // cipher) is rejected by Amarisoft as insecure. We strip it both at
  // generation time AND in the deploy sanitizer so old saved configs
  // that had it inherit the fix.
  const toAlgoInt = (a: string | number) => {
    if (typeof a === 'number') return a;
    const m = String(a).match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : NaN;
  };
  const filterValidAlgo = (n: number) => Number.isFinite(n) && n >= 1 && n <= 3;

  // Default form value used to ship 'eea0' first; bumped to start at 1.
  const cipherArr = (form.cipherAlgoPref ?? ['eea1', 'eea2', 'eea3'])
    .map(toAlgoInt).filter(filterValidAlgo).join(', ');
  const integArr = (form.integAlgoPref ?? ['eia1', 'eia2', 'eia3'])
    .map(toAlgoInt).filter(filterValidAlgo).join(', ');

  // ── Build cell_list — emit every cell in form.cells[] ───────────────────────
  // The flat form fields (cellId, pci, ...) mirror cells[activeCellIdx]; the
  // currently-active cell uses the freshest flat values, others use their slot.
  const cellEntries: LTECellEntry[] = form.cells && form.cells.length > 0
    ? form.cells.map((c, i) =>
        i === (form.activeCellIdx ?? 0)
          ? {
              ...c,
              cellId: form.cellId,
              pci: form.pci,
              tac: form.tac,
              rfPort: form.rfPort,
              band: form.band,
              bandwidth: form.bandwidth,
              dlEarfcn: form.dlEarfcn,
              tddConfig: form.tddConfig,
              tddSpecialSubframe: form.tddSpecialSubframe,
            }
          : c
      )
    : [makeDefaultLteCell('Cell 1', {
        cellId: form.cellId, pci: form.pci, tac: form.tac, rfPort: form.rfPort,
        band: form.band, bandwidth: form.bandwidth, dlEarfcn: form.dlEarfcn,
        tddConfig: form.tddConfig, tddSpecialSubframe: form.tddSpecialSubframe,
      })];

  // ── Per-cell entries: ONLY the fields Amarisoft requires per-cell, in
  //    the exact order its parser expects. Everything else lives in the
  //    cell_default block below and is merged into each cell at parse
  //    time (per the doc: "cell_default ... will be merged with each
  //    element of cell_list").
  //
  //    The parser is positional/sequential: emitting fields in the wrong
  //    order or unrecognized fields causes errors like
  //      "expecting 'pdsch_dedicated' field (LTE Cell #N)"
  //    Order observed to work on Amarisoft 2026-04-22:
  //      rf_port → cell_id → n_id_cell → tac → dl_earfcn → n_rb_dl →
  //      pdsch_dedicated → plmn_list → root_sequence_index →
  //      cipher_algo_pref → integ_algo_pref
  //
  //    TDD / NB-IoT / CAT-M / scell extras are cell-specific so they go
  //    on the cell entry (after the required fields).
  const cellListBlock = cellEntries.map((c, i) => {
    const cellTdd = LTE_TDD_BANDS.includes(c.band);
    const tddPart = cellTdd ? `
      tdd_ul_dl_config: ${c.tddConfig},
      tdd_special_subframe_pattern: ${c.tddSpecialSubframe},` : '';
    const nbiotPart = ratMode === 'nbiot'
      ? (form.nbIotMode === 'standalone'
          ? `\n      nb_iot: true,\n      nb_iot_mode: "standalone",`
          : `\n      nb_iot: true,\n      nb_iot_mode: "${form.nbIotMode}",\n      nb_iot_prb_index: ${form.nbIotPrbIndex},`)
      : '';
    const catmPart = ratMode === 'catm'
      ? `\n      ce_mode: "${form.catMCeMode}",\n      max_repetitions: ${form.catMRepetitions},`
      : '';
    const otherCellIds = cellEntries.filter((_, j) => j !== i).map(o => o.cellId);
    const scellPart = otherCellIds.length > 0 ? `
      scell_list: [${otherCellIds.map(id => `
        { cell_id: ${id}, cross_carrier_scheduling: false }`).join(',')}
      ],` : '';

    return `    {
      /* ${c.name} */
      rf_port: ${c.rfPort},
      cell_id: ${c.cellId},
      n_id_cell: ${c.pci},
      tac: ${c.tac},
      dl_earfcn: ${c.dlEarfcn},
      n_rb_dl: ${mhzToRbLte(c.bandwidth)},
      pdsch_dedicated: { p_a: 0 },
      plmn_list: [{
        plmn: "${formatPlmn(form.plmn.mcc, form.plmn.mnc)}",
        attach_without_pdn: ${form.attachWithoutPdn},
        reserved: ${form.plmnReserved},
      }],
      root_sequence_index: ${c.rootSequenceIndex},
      cipher_algo_pref: [${cipherArr}],
      integ_algo_pref: [${integArr}],${c.cellBarred ? `
      cell_barred: true,` : ''}${tddPart}${nbiotPart}${catmPart}${scellPart}
    }`;
  }).join(',\n');

  // ── cell_default: optional / shared parameters, merged into every
  //    cell at parse time. Keeps cell_list[] entries minimal so the
  //    parser doesn't trip on field-order mismatches.
  const cellDefaultBlock = `  cell_default: {
    n_antenna_dl: ${form.nAntennaDl},
    n_antenna_ul: ${form.nAntennaUl},
    cyclic_prefix: "${form.cpMode}",
    phich_duration: "${form.phichDuration}",
    phich_resource: "${form.phichResource}",
    si_coderate: ${form.siCoderate},
    si_window_length: ${form.siWindowLength},
    intra_freq_reselection: ${form.intraFreqReselection},
    q_rx_lev_min: ${form.qRxLevMin},
    p_max: ${form.pMax},
    sr_period: ${form.srPeriod},
    cqi_period: ${form.cqiPeriod},
    mac_config: { ul_max_harq_tx: ${form.ulMaxHarqTx}, dl_max_harq_tx: ${form.dlMaxHarqTx} },
    dpc: ${form.dpc},
    dpc_pusch_snr_target: ${form.dpcPuschSnrTarget},
    dpc_pucch_snr_target: ${form.dpcPucchSnrTarget},
    inactivity_timer: ${form.inactivityTimer},
    drb_config: "${form.drbConfig}",
  },`;

  return `/* ${ratLabel} eNB Configuration
 * Generated: ${new Date().toISOString()}
 * Band: ${form.band} | BW: ${form.bandwidth} MHz | ${isTdd ? 'TDD' : 'FDD'}
 */

{
  // enb.cfg: log_options — all.level=<global> then per-layer overrides
  log_options: "${logOptions}",
  // enb.cfg: log_filename
  log_filename: "${form.logFilename || '/tmp/enb0.log'}",

  com_addr: "[::]:9001",

  rf_driver: {
    // enb.cfg: rf_driver.name — sdr / split / ip
    name: "${form.rfMode}",
    // enb.cfg: rf_driver.args — content is mode-specific (device path for sdr,
    // O-RAN fronthaul opts for split, ZMQ socket pair for ip). User-editable.
    args: "${form.rfArgs}",
    // enb.cfg: rf_driver.rx_antenna
    rx_antenna: "${form.rxAntenna}",
  },

  // enb.cfg: tx_gain — scalar (all paths) or array (one per antenna)
  tx_gain: ${formatGain(form.txGain)},
  // enb.cfg: rx_gain — same shape as tx_gain
  rx_gain: ${formatGain(form.rxGain)},

  mme_list: [
    {
      // enb.cfg: mme_list[].mme_addr
      mme_addr: "${form.mmeAddr}",
    },
  ],

  // enb.cfg: gtp_addr
  gtp_addr: "${form.gtpAddr}",
  // enb.cfg: enb_id
  enb_id: ${form.enbId},

${cellDefaultBlock}

  cell_list: [
${cellListBlock}
  ],

  nr_cell_list: [],
}
`;
}

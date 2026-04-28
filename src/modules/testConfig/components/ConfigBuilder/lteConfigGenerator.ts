// Generates Amarisoft enb.cfg for LTE / NB-IoT / CAT-M1
import type { LTEFormState, LTECellEntry } from './lteConstants';
import { LTE_TDD_BANDS, makeDefaultLteCell } from './lteConstants';

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
  const cipherArr = (form.cipherAlgoPref ?? ['eea0', 'eea2', 'eea3'])
    .map((a: string) => `"${a}"`).join(', ');
  const integArr = (form.integAlgoPref ?? ['eia2', 'eia3'])
    .map((a: string) => `"${a}"`).join(', ');

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

  const cellListBlock = cellEntries.map((c, i) => {
    const cellTdd = LTE_TDD_BANDS.includes(c.band);
    const tddPart = cellTdd ? `
      tdd_ul_dl_config: ${c.tddConfig},
      tdd_special_subframe_pattern: ${c.tddSpecialSubframe},` : '';
    // NB-IoT / CAT-M per-cell extras
    const nbiotPart = ratMode === 'nbiot'
      ? (form.nbIotMode === 'standalone'
          ? `\n      nb_iot: true,\n      nb_iot_mode: "standalone",`
          : `\n      nb_iot: true,\n      nb_iot_mode: "${form.nbIotMode}",\n      nb_iot_prb_index: ${form.nbIotPrbIndex},`)
      : '';
    const catmPart = ratMode === 'catm'
      ? `\n      ce_mode: "${form.catMCeMode}",\n      max_repetitions: ${form.catMRepetitions},`
      : '';
    // Optional scell_list for carrier aggregation: each cell aggregates the others
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
      bandwidth: ${c.bandwidth},
      n_antenna_dl: ${form.nAntennaDl},
      n_antenna_ul: ${form.nAntennaUl},
      cyclic_prefix: "${form.cpMode}",
      phich_duration: "${form.phichDuration}",
      phich_resource: "${form.phichResource}",
      root_sequence_index: ${c.rootSequenceIndex},${c.cellBarred ? `
      cell_barred: true,` : ''}${tddPart}${nbiotPart}${catmPart}${scellPart}
      plmn_list: [{
        plmn: "${formatPlmn(form.plmn.mcc, form.plmn.mnc)}",
        attach_without_pdn: ${form.attachWithoutPdn},
        reserved: ${form.plmnReserved},
      }],
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
      cipher_algo_pref: [${cipherArr}],
      integ_algo_pref: [${integArr}],
    }`;
  }).join(',\n');

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
    // enb.cfg: rf_driver.name
    name: "${form.rfMode === 'sdr' ? 'sdr' : form.rfMode === 'split' ? 'sdr' : 'ip'}",
    // enb.cfg: rf_driver.args — derived from antenna count; multi-dev for 4-ant configs
    args: "${form.nAntennaDl >= 4 ? 'dev0=/dev/sdr0,dev1=/dev/sdr1' : 'dev0=/dev/sdr0'}",
    // enb.cfg: rf_driver.rx_antenna
    rx_antenna: "${form.rxAntenna}",
  },

  // enb.cfg: tx_gain
  tx_gain: ${form.txGain},
  // enb.cfg: rx_gain
  rx_gain: ${form.rxGain},

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

  cell_list: [
${cellListBlock}
  ],

  nr_cell_list: [],
}
`;
}

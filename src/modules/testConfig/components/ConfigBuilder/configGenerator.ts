// Generates Amarisoft enb.cfg (gNB) configuration from form state
import type { NRFormState } from './constants';

/**
 * Format PLMN string as MCC (3-digit) + MNC (2- or 3-digit, zero-padded).
 * Amarisoft enb.cfg: plmn_list[].plmn — e.g. "00101" (MCC=001, MNC=01)
 * Bug fix: a bare 1-digit MNC ("1") would have concatenated to "0011" instead of "00101".
 */
function formatPlmn(mcc: string, mnc: string): string {
  const paddedMcc = mcc.padStart(3, '0').slice(-3);
  // Preserve declared length: if user entered 3 digits keep 3, else pad to min 2
  const mncLen = mnc.length >= 3 ? 3 : 2;
  const paddedMnc = mnc.padStart(mncLen, '0').slice(-mncLen);
  return `${paddedMcc}${paddedMnc}`;
}

export function generateNRConfig(form: NRFormState): string {
  const isTdd = form.nrTdd === 1;
  const isFR2 = form.fr2 === 1;
  // Pull layer config (fall back to empty so the generator works with older
  // saved configs that don't have the layers field yet)
  const L = (form as any).layers || {};

  // Build log_options string
  const logParts: string[] = [];
  const lvl = form.logLevel || 'error';
  logParts.push(`all.level=${lvl}`, 'all.max_size=0');
  for (const [layer, level] of Object.entries(form.logLayers || {})) {
    if (level && level !== lvl) logParts.push(`${layer}.level=${level}`, `${layer}.max_size=1`);
  }
  const logOptions = logParts.join(',');

  // TDD pattern block
  const tddBlock = () => {
    if (!isTdd) return '';
    const p = form.tddPattern;
    return `
    tdd_ul_dl_config: {
      pattern1: {
        period: ${p.period},
        dl_slots: ${p.dlSlots},
        dl_symbols: ${p.dlSymbols},
        ul_slots: ${p.ulSlots},
        ul_symbols: ${p.ulSymbols},
      },
    },`;
  };

  return `/* gNB SA Configuration
 * Generated: ${new Date().toISOString()}
 * Band: n${form.band} | BW: ${form.nrBandwidth} MHz | SCS: ${form.subcarrierSpacing} kHz
 * Mode: ${isTdd ? 'TDD' : 'FDD'} | ${isFR2 ? 'FR2' : 'FR1'}
 */

{
  log_options: "${logOptions}",
  log_filename: "${form.logFilename || '/tmp/gnb0.log'}",

  com_addr: "[::]:9001",

  rf_driver: {
    name: "${form.rfMode === 'sdr' ? 'sdr' : form.rfMode === 'split' ? 'sdr' : 'ip'}",
    args: "${form.nAntennaDl >= 4 ? 'dev0=/dev/sdr0,dev1=/dev/sdr1' : 'dev0=/dev/sdr0'}",
    rx_antenna: "${form.rxAntenna}",
  },

  tx_gain: ${form.txGain},
  rx_gain: ${form.rxGain},

  amf_list: [
    {
      amf_addr: "${form.amfAddr}",
    },
  ],

  gtp_addr: "${form.gtpAddr}",
  gnb_id_bits: 28,
  gnb_id: ${form.gnbId},

  cell_list: [],

  nr_cell_list: [
${(() => {
    // Build cells array. If multi-cell state exists, use it — otherwise fall back
    // to the flat form fields as a single cell.
    const cells = form.cells && form.cells.length > 0
      ? form.cells.map((c, i) => ({
          // The active cell's data lives in the flat state, so use that for the active slot
          ...(i === form.activeCellIdx ? {
            cellId: form.cellId, band: form.band, dlNrArfcn: form.dlNrArfcn,
            subcarrierSpacing: form.subcarrierSpacing, ssbPosBitmap: form.ssbPosBitmap,
          } : c),
          name: c.name,
        }))
      : [{ cellId: form.cellId, band: form.band, dlNrArfcn: form.dlNrArfcn,
           subcarrierSpacing: form.subcarrierSpacing, ssbPosBitmap: form.ssbPosBitmap, name: 'Cell 1' }];
    return cells.map((c, i) => `    {
      /* ${c.name} */
      rf_port: ${i},
      cell_id: ${c.cellId},
      band: ${c.band},
      dl_nr_arfcn: ${c.dlNrArfcn},
      subcarrier_spacing: ${c.subcarrierSpacing},
      ssb_pos_bitmap: "${c.ssbPosBitmap}",
    }`).join(',\n');
  })()}
  ],

  nr_cell_default: {
    bandwidth: ${form.nrBandwidth},
    n_antenna_dl: ${form.nAntennaDl},
    n_antenna_ul: ${form.nAntennaUl},
${isTdd ? tddBlock() : ''}
    ssb_period: ${form.ssbPeriod},
    n_id_cell: ${form.cellId},

    plmn_list: [{
      tac: ${form.tac},
      // enb.cfg: nr_cell_default.plmn_list[].plmn — MCC (3-digit) + MNC (2- or 3-digit, zero-padded)
      plmn: "${formatPlmn(form.plmn.mcc, form.plmn.mnc)}",
      reserved: false,
      nssai: [{ sst: 1 }],
    }],

    dmrs_type_a_pos: ${form.dmrsTypeAPos},

    /* Frequently Used */
    sr_period: ${L.srPeriod ?? 20},
    cqi_period: ${L.cqiPeriod ?? 40},
    dl_256qam: ${L.dl256qam ?? true},
    ul_64qam: ${L.ul64qam ?? true},

    /* SIB1 — Cell Access */
    cell_barred: ${L.sibCellBarred ?? false},
    intra_freq_reselection: ${L.sibIntraFreqReselection ?? true},
    q_rx_lev_min: ${L.qRxLevMin ?? -70},
    p_max: ${L.pMax ?? 10},

    /* PHY */
    pdsch_mcs_table: "${L.pdschMcsTable ?? 'qam256'}",
    pusch_mcs_table: "${L.puschMcsTable ?? 'qam256'}",
    pusch_max_layers: ${L.puschMaxLayers ?? 1},
    prach_config_index: ${L.prachConfigIndex ?? 160},
    prach_root_seq_index: ${L.prachRootSeqIndex ?? 1},

    /* MAC */
    mac_config: {
      msg3_max_harq_tx: ${L.msg3MaxHarqTx ?? 5},
      ul_max_harq_tx: ${L.ulMaxHarqTx ?? 5},
      dl_max_harq_tx: ${L.dlMaxHarqTx ?? 5},
      ra_response_window_size: ${L.raResponseWindowSize ?? 10},
      mac_contention_resolution_timer: ${L.macContentionResolutionTimer ?? 64},
    },

    /* RLC / PDCP */
    rlc_config: {
      mode: "${L.rlcMode ?? 'am'}",
      sn_length: ${L.rlcSnLength ?? 18},
      t_reordering: ${L.rlcTReordering ?? 50},
      max_retx_threshold: ${L.rlcMaxRetxThreshold ?? 32},
    },
    pdcp_config: {
      sn_size: ${L.pdcpSnSize ?? 18},
      discard_timer: ${L.pdcpDiscardTimer ?? 100},
    },

    /* Power Control */
    dpc: ${L.dpc ?? true},
    dpc_pusch_snr_target: ${L.dpcPuschSnrTarget ?? 25},
    dpc_pucch_snr_target: ${L.dpcPucchSnrTarget ?? 20},

    /* RRC / NAS */
    inactivity_timer: ${L.inactivityTimer ?? 10000},
    rrc_inactivity_timer: ${L.rrcInactivityTimer ?? 10000},
    ue_inactivity_timer: ${L.ueInactivityTimer ?? 60000},

    /* Paging & SI */
    default_paging_cycle: ${L.paging?.defaultCycle ?? 128},
    si_periodicity: ${L.sibSiPeriodicity ?? 160},
  },
}
`;
}

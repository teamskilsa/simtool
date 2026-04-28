// Generates Amarisoft enb.cfg (gNB SA) configuration from form state.
// Validated against the reference config shipped with Amarisoft 2026-04-22
// (lteenb-linux-2026-04-22/config/gnb-sa.cfg).
import type { NRFormState } from './constants';
import { formatGain } from './rfDefaults';

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
  // Layer config — fall back to empty so older saved configs still generate
  const L = (form as any).layers || {};

  // ── Log options ───────────────────────────────────────────────────────────
  const lvl = L.logLevel || 'error';
  const logParts: string[] = [`all.level=${lvl}`, 'all.max_size=0'];
  for (const [layer, level] of Object.entries<string>(L.logLayers || {})) {
    if (level && level !== lvl) logParts.push(`${layer}.level=${level}`, `${layer}.max_size=1`);
  }
  const logOptions = logParts.join(',');

  // ── TDD pattern ───────────────────────────────────────────────────────────
  const tddBlock = () => {
    if (!isTdd) return '';
    const p = form.tddPattern;
    return `
    tdd_ul_dl_config: {
      pattern1: {
        period: ${p.period}, /* in ms */
        dl_slots: ${p.dlSlots},
        dl_symbols: ${p.dlSymbols},
        ul_slots: ${p.ulSlots},
        ul_symbols: ${p.ulSymbols},
      },
    },`;
  };

  // ── Cell list — multi-cell support ────────────────────────────────────────
  const cellListBlock = (() => {
    const cells = form.cells && form.cells.length > 0
      ? form.cells.map((c, i) => ({
          ...(i === form.activeCellIdx ? {
            cellId: form.cellId, band: form.band, dlNrArfcn: form.dlNrArfcn,
            subcarrierSpacing: form.subcarrierSpacing, ssbPosBitmap: form.ssbPosBitmap,
          } : c),
          name: c.name,
        }))
      : [{
          cellId: form.cellId, band: form.band, dlNrArfcn: form.dlNrArfcn,
          subcarrierSpacing: form.subcarrierSpacing, ssbPosBitmap: form.ssbPosBitmap, name: 'Cell 1',
        }];
    return cells.map((c, i) => `    {
      /* ${c.name} */
      rf_port: ${i},
      cell_id: ${c.cellId},
      band: ${c.band},
      dl_nr_arfcn: ${c.dlNrArfcn},
      subcarrier_spacing: ${c.subcarrierSpacing}, /* kHz */
      ssb_pos_bitmap: "${c.ssbPosBitmap}",
    }`).join(',\n');
  })();

  // ── PRACH — per reference: single object with nested fields ───────────────
  const prachBlock = () => {
    const msg1Scs = isFR2 ? 120 : (form.subcarrierSpacing >= 30 ? 30 : 15);
    return `
    prach: {
      prach_config_index: ${L.prachConfigIndex ?? 160},
      msg1_subcarrier_spacing: ${msg1Scs}, /* kHz */
      msg1_fdm: 1,
      msg1_frequency_start: -1,
      zero_correlation_zone_config: 15,
      preamble_received_target_power: -110, /* in dBm */
      preamble_trans_max: 7,
      power_ramping_step: 4, /* in dB */
      ra_response_window: ${L.raResponseWindowSize ?? (isFR2 ? 40 : (isTdd ? 20 : 10))}, /* in slots */
      restricted_set_config: "unrestricted_set",
      ra_contention_resolution_timer: ${L.macContentionResolutionTimer ?? 64}, /* in ms */
      ssb_per_prach_occasion: 1,
      cb_preambles_per_ssb: 8,
    },`;
  };

  // ── PDCCH block ──────────────────────────────────────────────────────────
  const pdcchBlock = `
    pdcch: {
      search_space0_index: 0,
      dedicated_coreset: {
        rb_start: -1,
        l_crb: -1,
        duration: 0,
        precoder_granularity: "sameAsREG_bundle",
      },
      css: {
        n_candidates: [ 0, 0, 4, 0, 0 ],
      },
      rar_al_index: 2,
      si_al_index: 2,
      uss: {
        n_candidates: [ 0, 4, 0, 0, 0 ],
        dci_0_1_and_1_1: true,
      },
      al_index: 1,
    },`;

  // ── PDSCH / PUSCH / PUCCH / CSI-RS blocks ────────────────────────────────
  const pdschBlock = `
    pdsch: {
      mapping_type: "typeA",
      dmrs_add_pos: 1,
      dmrs_type: 1,
      dmrs_max_len: 1,
      mcs_table: "${L.pdschMcsTable ?? 'qam256'}",
      rar_mcs: 2,
      si_mcs: 6,
    },`;

  const puschBlock = `
    pusch: {
      mapping_type: "typeA",
      n_symb: 14,
      dmrs_add_pos: 1,
      dmrs_type: 1,
      dmrs_max_len: 1,
      tf_precoding: false,
      mcs_table: "${L.puschMcsTable ?? 'qam256'}",
      mcs_table_tp: "${L.puschMcsTable ?? 'qam256'}",
      ldpc_max_its: 5,
      p0_nominal_with_grant: -84,
      msg3_mcs: 4,
      msg3_delta_power: 0,
      beta_offset_ack_index: 9,
    },`;

  const pucchBlock = `
    pucch: {
      p0_nominal: -96,
      resource_auto: {},
    },`;

  const csiBlock = `
    csi_rs: {
      resource_auto: {
        nzp_csi_rs_period: 80,
      },
      csi_report_config: [
        {
          report_config_type: "periodic",
          period: 80,
        },
      ],
    },`;

  // ── MAC config — per the reference exactly ───────────────────────────────
  const macBlock = `
    mac_config: {
      msg3_max_harq_tx: ${L.msg3MaxHarqTx ?? 5},
      ul_max_harq_tx: ${L.ulMaxHarqTx ?? 5},
      dl_max_harq_tx: ${L.dlMaxHarqTx ?? 5},
      ul_max_consecutive_retx: 30,
      dl_max_consecutive_retx: 30,
      periodic_bsr_timer: 20,
      retx_bsr_timer: 320,
      periodic_phr_timer: 500,
      prohibit_phr_timer: 200,
      phr_tx_power_factor_change: "dB3",
      sr_prohibit_timer: 0,
      sr_trans_max: 64,
    },`;

  return `/* lteenb configuration file — NR SA
 * Generated: ${new Date().toISOString()}
 * Band: n${form.band} | BW: ${form.nrBandwidth} MHz | SCS: ${form.subcarrierSpacing} kHz
 * Mode: ${isTdd ? 'TDD' : 'FDD'} | ${isFR2 ? 'FR2' : 'FR1'}
 */

{
  log_options: "${logOptions}",
  log_filename: "${L.logFilename || '/tmp/gnb0.log'}",

  /* Enable remote API and Web interface */
  com_addr: "[::]:9001",

  rf_driver: {
    /* sdr / split (O-RAN 7.2) / ip (ZMQ) */
    name: "${form.rfMode}",
    /* Mode-specific content. SDR: dev path. Split: vlan_id/if_name/bfp_iq_width.
       IP: tx_addr/rx_addr ZMQ socket pair. Editable in builder's RF section. */
    args: "${form.rfArgs}",
    rx_antenna: "${form.rxAntenna}",
  },
  /* tx_gain / rx_gain — scalar (all paths) or array (one per antenna) */
  tx_gain: ${formatGain(form.txGain)},
  rx_gain: ${formatGain(form.rxGain)},

  amf_list: [
    {
      amf_addr: "${form.amfAddr}",
    },
  ],

  gtp_addr: "${form.gtpAddr}",
  gnb_id_bits: 28,
  gnb_id: ${form.gnbId},

  /* list of LTE cells (none for NR SA) */
  cell_list: [],

  nr_cell_list: [
${cellListBlock}
  ], /* nr_cell_list */

  nr_cell_default: {
    bandwidth: ${form.nrBandwidth}, /* MHz */
    n_antenna_dl: ${form.nAntennaDl},
    n_antenna_ul: ${form.nAntennaUl},
${isTdd ? tddBlock() : ''}
    ssb_period: ${form.ssbPeriod}, /* in ms */
    n_id_cell: ${form.cellId},

    plmn_list: [{
      tac: ${form.tac},
      plmn: "${formatPlmn(form.plmn.mcc, form.plmn.mnc)}", /* MCC (3) + MNC (2/3), zero-padded */
      reserved: false,
      nssai: [{ sst: 1 }],
    }],

    si_window_length: 40,

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
    q_qual_min: -20,
${L.pMax !== undefined && L.pMax !== null ? `    p_max: ${L.pMax}, /* dBm */` : '    // p_max: 10, /* dBm (default) */'}

    root_sequence_index: ${L.prachRootSeqIndex ?? 1}, /* PRACH root sequence index */
${prachBlock()}
${pdcchBlock}
${pdschBlock}
${csiBlock}
${pucchBlock}
${puschBlock}
${macBlock}

    cipher_algo_pref: [],
    integ_algo_pref: [2, 1],

    inactivity_timer: ${L.inactivityTimer ?? 10000},

    drb_config: "drb_nr.cfg",
  },
}
`;
}

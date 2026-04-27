// Generates Amarisoft enb.cfg for LTE / NB-IoT / CAT-M1
import type { LTEFormState } from './lteConstants';
import { LTE_TDD_BANDS } from './lteConstants';

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

  // ── TDD block ────────────────────────────────────────────────────────────────
  const tddBlock = () => {
    if (!isTdd) return '';
    return `
      // enb.cfg: cell_list[].tdd_ul_dl_config
      tdd_ul_dl_config: ${form.tddConfig},
      // enb.cfg: cell_list[].tdd_special_subframe_pattern
      tdd_special_subframe_pattern: ${form.tddSpecialSubframe},`;
  };

  // ── NB-IoT block (LTE FDD/TDD scope: NB-IoT left mostly as-is — see PR notes) ──
  const nbIotBlock = () => {
    if (ratMode !== 'nbiot') return '';
    if (form.nbIotMode === 'standalone') {
      return `
      // enb.cfg: cell_list[].nb_iot
      nb_iot: true,
      // enb.cfg: cell_list[].nb_iot_mode
      nb_iot_mode: "standalone",`;
    }
    return `
      // enb.cfg: cell_list[].nb_iot
      nb_iot: true,
      // enb.cfg: cell_list[].nb_iot_mode
      nb_iot_mode: "${form.nbIotMode}",
      // enb.cfg: cell_list[].nb_iot_prb_index
      nb_iot_prb_index: ${form.nbIotPrbIndex},`;
  };

  // ── CAT-M block ──────────────────────────────────────────────────────────────
  const catMBlock = () => {
    if (ratMode !== 'catm') return '';
    return `
      /* CAT-M1 / eMTC */
      // enb.cfg: cell_list[].ce_mode
      ce_mode: "${form.catMCeMode}",
      // enb.cfg: cell_list[].max_repetitions
      max_repetitions: ${form.catMRepetitions},`;
  };

  // ── cipher / integ algo arrays ───────────────────────────────────────────────
  const cipherArr = (form.cipherAlgoPref ?? ['eea0', 'eea2', 'eea3'])
    .map((a: string) => `"${a}"`).join(', ');
  const integArr = (form.integAlgoPref ?? ['eia2', 'eia3'])
    .map((a: string) => `"${a}"`).join(', ');

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
    {
      // enb.cfg: cell_list[].rf_port
      rf_port: ${form.rfPort},
      // enb.cfg: cell_list[].cell_id
      cell_id: ${form.cellId},
      // enb.cfg: cell_list[].n_id_cell  (PCI 0–503)
      n_id_cell: ${form.pci},
      // enb.cfg: cell_list[].dl_earfcn
      dl_earfcn: ${form.dlEarfcn},
      // enb.cfg: cell_list[].bandwidth  (MHz)
      bandwidth: ${form.bandwidth},
      // enb.cfg: cell_list[].n_antenna_dl
      n_antenna_dl: ${form.nAntennaDl},
      // enb.cfg: cell_list[].n_antenna_ul
      n_antenna_ul: ${form.nAntennaUl},

      // enb.cfg: cell_list[].cyclic_prefix
      cyclic_prefix: "${form.cpMode}",
      // enb.cfg: cell_list[].phich_duration
      phich_duration: "${form.phichDuration}",
      // enb.cfg: cell_list[].phich_resource
      phich_resource: "${form.phichResource}",
${tddBlock()}${nbIotBlock()}${catMBlock()}
      plmn_list: [{
        // enb.cfg: cell_list[].plmn_list[].plmn  (MCC 3-digit + MNC 2/3-digit, zero-padded)
        plmn: "${formatPlmn(form.plmn.mcc, form.plmn.mnc)}",
        // enb.cfg: cell_list[].plmn_list[].attach_without_pdn
        attach_without_pdn: ${form.attachWithoutPdn},
        // enb.cfg: cell_list[].plmn_list[].reserved
        reserved: ${form.plmnReserved},
      }],

      // enb.cfg: cell_list[].tac
      tac: ${form.tac},

      // enb.cfg: cell_list[].si_coderate  (0.0–1.0, default 0.20)
      si_coderate: ${form.siCoderate},
      // TODO(amarisoft-doc-verify): enb.cfg: cell_list[].si_window_length (ms)
      si_window_length: ${form.siWindowLength},

      // enb.cfg: cell_list[].cell_barred
      cell_barred: ${form.cellBarred},
      // enb.cfg: cell_list[].intra_freq_reselection
      intra_freq_reselection: ${form.intraFreqReselection},
      // enb.cfg: cell_list[].q_rx_lev_min  (dBm)
      q_rx_lev_min: ${form.qRxLevMin},
      // enb.cfg: cell_list[].p_max  (dBm)
      p_max: ${form.pMax},

      // enb.cfg: cell_list[].sr_period  (ms)
      sr_period: ${form.srPeriod},
      // enb.cfg: cell_list[].cqi_period  (ms)
      cqi_period: ${form.cqiPeriod},

      mac_config: {
        // enb.cfg: cell_list[].mac_config.ul_max_harq_tx
        ul_max_harq_tx: ${form.ulMaxHarqTx},
        // enb.cfg: cell_list[].mac_config.dl_max_harq_tx
        dl_max_harq_tx: ${form.dlMaxHarqTx},
      },

      // enb.cfg: cell_list[].dpc  (downlink power control enable)
      dpc: ${form.dpc},
      // enb.cfg: cell_list[].dpc_pusch_snr_target  (dB)
      dpc_pusch_snr_target: ${form.dpcPuschSnrTarget},
      // enb.cfg: cell_list[].dpc_pucch_snr_target  (dB)
      dpc_pucch_snr_target: ${form.dpcPucchSnrTarget},

      // enb.cfg: cell_list[].inactivity_timer  (ms)
      inactivity_timer: ${form.inactivityTimer},

      // enb.cfg: cell_list[].drb_config  (path to DRB config file)
      drb_config: "${form.drbConfig}",

      // enb.cfg: cell_list[].cipher_algo_pref
      cipher_algo_pref: [${cipherArr}],
      // enb.cfg: cell_list[].integ_algo_pref
      integ_algo_pref: [${integArr}],
    },
  ],

  nr_cell_list: [],
}
`;
}

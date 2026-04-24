// Generates Amarisoft enb.cfg for LTE / NB-IoT / CAT-M1
import type { LTEFormState } from './lteConstants';
import { LTE_TDD_BANDS } from './lteConstants';

export function generateLTEConfig(form: LTEFormState, ratMode: 'lte' | 'nbiot' | 'catm'): string {
  const isTdd = LTE_TDD_BANDS.includes(form.band);
  const ratLabel = ratMode === 'nbiot' ? 'NB-IoT' : ratMode === 'catm' ? 'CAT-M1 (eMTC)' : 'LTE';

  const tddBlock = () => {
    if (!isTdd) return '';
    return `
      tdd_ul_dl_config: ${form.tddConfig},
      tdd_special_subframe_pattern: ${form.tddSpecialSubframe},`;
  };

  const nbIotBlock = () => {
    if (ratMode !== 'nbiot') return '';
    if (form.nbIotMode === 'standalone') {
      return `
      nb_iot: true,
      nb_iot_mode: "standalone",`;
    }
    return `
      nb_iot: true,
      nb_iot_mode: "${form.nbIotMode}",
      nb_iot_prb_index: ${form.nbIotPrbIndex},`;
  };

  const catMBlock = () => {
    if (ratMode !== 'catm') return '';
    return `
      /* CAT-M1 / eMTC */
      ce_mode: "${form.catMCeMode}",
      max_repetitions: ${form.catMRepetitions},`;
  };

  return `/* ${ratLabel} eNB Configuration
 * Generated: ${new Date().toISOString()}
 * Band: ${form.band} | BW: ${form.bandwidth} MHz | ${isTdd ? 'TDD' : 'FDD'}
 */

{
  log_options: "all.level=${form.logLevel || 'error'},all.max_size=0,nas.level=debug,nas.max_size=1,s1ap.level=debug,s1ap.max_size=1,rrc.level=debug,rrc.max_size=1",
  log_filename: "${form.logFilename || '/tmp/enb0.log'}",

  com_addr: "[::]:9001",

  rf_driver: {
    name: "${form.rfMode === 'sdr' ? 'sdr' : form.rfMode === 'split' ? 'sdr' : 'ip'}",
    args: "${form.nAntennaDl >= 4 ? 'dev0=/dev/sdr0,dev1=/dev/sdr1' : 'dev0=/dev/sdr0'}",
    rx_antenna: "${form.rxAntenna}",
  },

  tx_gain: ${form.txGain},
  rx_gain: ${form.rxGain},

  mme_list: [
    {
      mme_addr: "${form.mmeAddr}",
    },
  ],

  gtp_addr: "${form.gtpAddr}",
  enb_id: ${form.enbId},

  cell_list: [
    {
      rf_port: 0,
      cell_id: ${form.cellId},
      n_id_cell: ${form.pci},
      dl_earfcn: ${form.dlEarfcn},
      bandwidth: ${form.bandwidth},
      n_antenna_dl: ${form.nAntennaDl},
      n_antenna_ul: ${form.nAntennaUl},

      cyclic_prefix: "${form.cpMode}",
      phich_duration: "${form.phichDuration}",
      phich_resource: "${form.phichResource}",
${tddBlock()}${nbIotBlock()}${catMBlock()}
      plmn_list: [{
        plmn: "${form.plmn.mcc}${form.plmn.mnc}",
        attach_without_pdn: true,
        reserved: false,
      }],

      tac: ${form.tac},
      si_coderate: 0.20,
      si_value_tag: 0,

      cell_barred: false,
      intra_freq_reselection: true,
      q_rx_lev_min: -70,
      p_max: 23,

      sr_period: 20,
      cqi_period: 40,

      mac_config: {
        ul_max_harq_tx: 5,
        dl_max_harq_tx: 5,
      },

      dpc: true,
      dpc_pusch_snr_target: 25,
      dpc_pucch_snr_target: 15,

      inactivity_timer: 10000,
    },
  ],

  nr_cell_list: [],
}
`;
}

// Validate our NR generator's output against the canonical Amarisoft 2026-04-22
// gnb-sa.cfg reference — flags any top-level keys we emit that aren't in the
// real reference, or vice-versa.
import { readFileSync } from 'node:fs';

const REF_PATH = 'C:/Users/SIMNOV~1/AppData/Local/Temp/amsw/2026-04-22/lteenb-linux-2026-04-22/config/gnb-sa.cfg';

/** Strip comments + preprocessor directives and extract only object keys
 *  (before a ':'). Returns a de-duplicated set of keys. */
function extractKeys(cfg) {
  // Remove C-style block comments
  let stripped = cfg.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove line comments
  stripped = stripped.replace(/\/\/.*$/gm, '');
  // Remove preprocessor directives
  stripped = stripped.replace(/^\s*#(if|ifdef|ifndef|else|elif|endif|define|error|warning)[^\n]*$/gm, '');

  const keys = new Set();
  // Match identifiers at the start of a line (optionally indented), followed by ':'
  const rx = /^\s*([a-zA-Z_0-9"]+)\s*:/gm;
  let m;
  while ((m = rx.exec(stripped)) !== null) {
    let k = m[1].replace(/^"|"$/g, '');
    if (k) keys.add(k);
  }
  return keys;
}

const ref = readFileSync(REF_PATH, 'utf8');
const refKeys = extractKeys(ref);
console.log(`Reference gnb-sa.cfg keys (${refKeys.size}):`);
console.log([...refKeys].sort().join(', '));

// Now build a sample config using our generator defaults
// (We import the TS by transpiling manually — use a sample JS port instead)
// For simplicity, just hand-build what our generator emits using the default form
const ourOutput = `/* sample from our generator */
{
  log_options: "all.level=error,all.max_size=0",
  log_filename: "/tmp/gnb0.log",
  com_addr: "[::]:9001",
  rf_driver: { name: "sdr", args: "dev0=/dev/sdr0", rx_antenna: "rx" },
  tx_gain: 90,
  rx_gain: 60,
  amf_list: [{ amf_addr: "127.0.1.100" }],
  gtp_addr: "127.0.1.1",
  gnb_id_bits: 28,
  gnb_id: 0x12345,
  cell_list: [],
  nr_cell_list: [{ rf_port: 0, cell_id: 500, band: 78, dl_nr_arfcn: 632628, subcarrier_spacing: 30, ssb_pos_bitmap: "10000000" }],
  nr_cell_default: {
    bandwidth: 40,
    n_antenna_dl: 1,
    n_antenna_ul: 1,
    tdd_ul_dl_config: { pattern1: { period: 5, dl_slots: 7, dl_symbols: 6, ul_slots: 2, ul_symbols: 4 } },
    ssb_period: 20,
    n_id_cell: 500,
    plmn_list: [{ tac: 1, plmn: "00101", reserved: false, nssai: [{ sst: 1 }] }],
    si_window_length: 40,
    cell_barred: false,
    intra_freq_reselection: true,
    q_rx_lev_min: -70,
    q_qual_min: -20,
    root_sequence_index: 1,
    sr_period: 40,
    dmrs_type_a_pos: 2,
    prach: { prach_config_index: 160, msg1_subcarrier_spacing: 30, msg1_fdm: 1, msg1_frequency_start: -1, zero_correlation_zone_config: 15, preamble_received_target_power: -110, preamble_trans_max: 7, power_ramping_step: 4, ra_response_window: 20, restricted_set_config: "unrestricted_set", ra_contention_resolution_timer: 64, ssb_per_prach_occasion: 1, cb_preambles_per_ssb: 8 },
    pdcch: { search_space0_index: 0, dedicated_coreset: { rb_start: -1, l_crb: -1, duration: 0, precoder_granularity: "sameAsREG_bundle" }, css: { n_candidates: [0,0,4,0,0] }, rar_al_index: 2, si_al_index: 2, uss: { n_candidates: [0,4,0,0,0], dci_0_1_and_1_1: true }, al_index: 1 },
    pdsch: { mapping_type: "typeA", dmrs_add_pos: 1, dmrs_type: 1, dmrs_max_len: 1, mcs_table: "qam256", rar_mcs: 2, si_mcs: 6 },
    csi_rs: { resource_auto: { nzp_csi_rs_period: 80 }, csi_report_config: [{ report_config_type: "periodic", period: 80 }] },
    pucch: { p0_nominal: -96, resource_auto: {} },
    pusch: { mapping_type: "typeA", n_symb: 14, dmrs_add_pos: 1, dmrs_type: 1, dmrs_max_len: 1, tf_precoding: false, mcs_table: "qam256", mcs_table_tp: "qam256", ldpc_max_its: 5, p0_nominal_with_grant: -84, msg3_mcs: 4, msg3_delta_power: 0, beta_offset_ack_index: 9 },
    mac_config: { msg3_max_harq_tx: 5, ul_max_harq_tx: 5, dl_max_harq_tx: 5, ul_max_consecutive_retx: 30, dl_max_consecutive_retx: 30, periodic_bsr_timer: 20, retx_bsr_timer: 320, periodic_phr_timer: 500, prohibit_phr_timer: 200, phr_tx_power_factor_change: "dB3", sr_prohibit_timer: 0, sr_trans_max: 64 },
    cipher_algo_pref: [],
    integ_algo_pref: [2, 1],
    inactivity_timer: 10000,
    drb_config: "drb_nr.cfg",
  },
}`;

const ourKeys = extractKeys(ourOutput);
console.log(`\nOur output keys (${ourKeys.size}):`);
console.log([...ourKeys].sort().join(', '));

const inBoth = new Set();
const onlyInRef = new Set();
const onlyInOurs = new Set();
for (const k of refKeys) (ourKeys.has(k) ? inBoth : onlyInRef).add(k);
for (const k of ourKeys) if (!refKeys.has(k)) onlyInOurs.add(k);

console.log(`\n✓ In both (${inBoth.size}):`, [...inBoth].sort().join(', '));
console.log(`\n⚠ Only in reference (${onlyInRef.size}):`, [...onlyInRef].sort().join(', '));
console.log(`\n⚠ Only in ours (${onlyInOurs.size}):`, [...onlyInOurs].sort().join(', '));

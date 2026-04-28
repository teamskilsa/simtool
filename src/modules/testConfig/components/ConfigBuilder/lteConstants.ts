// LTE / NB-IoT / CAT-M1 configuration constants

export const LTE_BAND_OPTIONS = [
  { value: 1, label: 'B1 (2.1 GHz)' },
  { value: 2, label: 'B2 (1.9 GHz)' },
  { value: 3, label: 'B3 (1.8 GHz)' },
  { value: 4, label: 'B4 (AWS)' },
  { value: 5, label: 'B5 (850 MHz)' },
  { value: 7, label: 'B7 (2.6 GHz)' },
  { value: 8, label: 'B8 (900 MHz)' },
  { value: 12, label: 'B12 (700 MHz)' },
  { value: 13, label: 'B13 (700 MHz)' },
  { value: 14, label: 'B14 (700 MHz)' },
  { value: 17, label: 'B17 (700 MHz)' },
  { value: 20, label: 'B20 (800 MHz)' },
  { value: 25, label: 'B25 (1.9 GHz)' },
  { value: 26, label: 'B26 (850 MHz)' },
  { value: 28, label: 'B28 (700 MHz)' },
  { value: 38, label: 'B38 (2.6 GHz TDD)' },
  { value: 39, label: 'B39 (1.9 GHz TDD)' },
  { value: 40, label: 'B40 (2.3 GHz TDD)' },
  { value: 41, label: 'B41 (2.5 GHz TDD)' },
  { value: 42, label: 'B42 (3.5 GHz TDD)' },
  { value: 43, label: 'B43 (3.7 GHz TDD)' },
  { value: 48, label: 'B48 (3.5 GHz TDD)' },
];

export const LTE_BW_OPTIONS = [
  { value: 1.4, label: '1.4 MHz (6 PRB)' },
  { value: 3, label: '3 MHz (15 PRB)' },
  { value: 5, label: '5 MHz (25 PRB)' },
  { value: 10, label: '10 MHz (50 PRB)' },
  { value: 15, label: '15 MHz (75 PRB)' },
  { value: 20, label: '20 MHz (100 PRB)' },
];

export const NBIOT_BW_OPTIONS = [
  { value: 0.2, label: '200 kHz (1 PRB)' },
];

export const CATM_BW_OPTIONS = [
  { value: 1.4, label: '1.4 MHz' },
  { value: 5, label: '5 MHz' },
  { value: 10, label: '10 MHz' },
  { value: 20, label: '20 MHz' },
];

// TDD configs for LTE (configs 0-6)
export const LTE_TDD_CONFIGS = [
  { value: 0, label: 'Config 0 (DL:UL = 2:6)' },
  { value: 1, label: 'Config 1 (DL:UL = 4:4)' },
  { value: 2, label: 'Config 2 (DL:UL = 6:2)' },
  { value: 3, label: 'Config 3 (DL:UL = 7:3)' },
  { value: 4, label: 'Config 4 (DL:UL = 8:2)' },
  { value: 5, label: 'Config 5 (DL:UL = 9:1)' },
  { value: 6, label: 'Config 6 (DL:UL = 5:5)' },
];

// Default EARFCN per band
export const DEFAULT_LTE_EARFCN: Record<number, number> = {
  1: 300, 2: 900, 3: 1575, 4: 2175, 5: 2525,
  7: 3100, 8: 3625, 12: 5095, 13: 5230, 14: 5330,
  17: 5790, 20: 6300, 25: 8365, 26: 8690, 28: 9310,
  38: 37900, 39: 38250, 40: 38950, 41: 40620, 42: 42590, 43: 44590, 48: 55540,
};

// TDD bands (FDD is everything else)
export const LTE_TDD_BANDS = [33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48];

// Per-cell LTE entry — fields that vary across cells in carrier aggregation.
// Everything else stays at the form-level (and goes into cell_default).
export interface LTECellEntry {
  name: string;             // UI label, not written to cfg
  cellId: number;           // cell_id (low 8 bits of SIB1.cellIdentifier)
  pci: number;              // n_id_cell (PCI 0-503)
  tac: number;              // tac
  rfPort: number;           // rf_port (different physical RF port per cell)
  band: number;             // derived from EARFCN; can override per cell
  bandwidth: number;        // MHz
  dlEarfcn: number;         // dl_earfcn
  rootSequenceIndex: number; // PRACH root sequence index
  cellBarred: boolean;      // SIB1 cell_barred per-cell override
  // TDD-specific
  tddConfig: number;
  tddSpecialSubframe: number;
}

export function makeDefaultLteCell(name: string, overrides: Partial<LTECellEntry> = {}): LTECellEntry {
  return {
    name,
    cellId: 1,
    pci: 0,
    tac: 1,
    rfPort: 0,
    band: 7,
    bandwidth: 20,
    dlEarfcn: 3100,
    rootSequenceIndex: 204,
    cellBarred: false,
    tddConfig: 2,
    tddSpecialSubframe: 7,
    ...overrides,
  };
}

export interface LTEFormState {
  // ── Cell identity ────────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].cell_id
  cellId: number;
  // enb.cfg: cell_list[].n_id_cell  (PCI 0–503)
  pci: number;
  // enb.cfg: cell_list[].tac
  tac: number;
  // enb.cfg: cell_list[].rf_port
  rfPort: number;
  // enb.cfg: cell_list[].plmn_list[].plmn  (MCC + MNC concatenated)
  plmn: { mcc: string; mnc: string };
  // enb.cfg: cell_list[].plmn_list[].attach_without_pdn
  attachWithoutPdn: boolean;
  // enb.cfg: cell_list[].plmn_list[].reserved
  plmnReserved: boolean;

  // ── Band / frequency ─────────────────────────────────────────────────────────
  band: number;
  // enb.cfg: cell_list[].bandwidth
  bandwidth: number;
  // enb.cfg: cell_list[].dl_earfcn
  dlEarfcn: number;

  // ── Duplex ───────────────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].cyclic_prefix
  cpMode: 'normal' | 'extended';
  // enb.cfg: cell_list[].phich_duration
  phichDuration: 'normal' | 'extended';
  // enb.cfg: cell_list[].phich_resource
  phichResource: string;
  // enb.cfg: cell_list[].tdd_ul_dl_config  (TDD bands only)
  tddConfig: number;
  // enb.cfg: cell_list[].tdd_special_subframe_pattern  (TDD bands only)
  tddSpecialSubframe: number;

  // ── Antenna ──────────────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].n_antenna_dl
  nAntennaDl: number;
  // enb.cfg: cell_list[].n_antenna_ul
  nAntennaUl: number;

  // ── RF driver ────────────────────────────────────────────────────────────────
  // enb.cfg: rf_driver.name
  rfMode: 'sdr' | 'split' | 'ip';
  // enb.cfg: tx_gain
  txGain: number;
  // enb.cfg: rx_gain
  rxGain: number;
  // enb.cfg: rf_driver.rx_antenna
  rxAntenna: string;

  // ── Network / S1 ─────────────────────────────────────────────────────────────
  // enb.cfg: mme_list[].mme_addr
  mmeAddr: string;
  // enb.cfg: gtp_addr
  gtpAddr: string;
  // enb.cfg: enb_id
  enbId: string;

  // ── Cell access / SIB1 ───────────────────────────────────────────────────────
  // enb.cfg: cell_list[].cell_barred
  cellBarred: boolean;
  // enb.cfg: cell_list[].intra_freq_reselection
  intraFreqReselection: boolean;
  // enb.cfg: cell_list[].q_rx_lev_min  (dBm, −140 to −44)
  qRxLevMin: number;
  // enb.cfg: cell_list[].p_max  (dBm)
  pMax: number;

  // ── System Information ────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].si_coderate  (0.0–1.0)
  siCoderate: number;
  // TODO(amarisoft-doc-verify): enb.cfg: cell_list[].si_window_length (ms) — inferred from secondary sources
  siWindowLength: number;

  // ── Scheduler ────────────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].sr_period  (ms)
  srPeriod: number;
  // enb.cfg: cell_list[].cqi_period  (ms)
  cqiPeriod: number;

  // ── MAC / HARQ ────────────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].mac_config.ul_max_harq_tx
  ulMaxHarqTx: number;
  // enb.cfg: cell_list[].mac_config.dl_max_harq_tx
  dlMaxHarqTx: number;

  // ── Power control ─────────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].dpc  (downlink power control)
  dpc: boolean;
  // enb.cfg: cell_list[].dpc_pusch_snr_target  (dB)
  dpcPuschSnrTarget: number;
  // enb.cfg: cell_list[].dpc_pucch_snr_target  (dB)
  dpcPucchSnrTarget: number;

  // ── Timers ────────────────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].inactivity_timer  (ms)
  inactivityTimer: number;

  // ── Bearers ───────────────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].drb_config  (path to drb.cfg)
  drbConfig: string;

  // ── Security ──────────────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].cipher_algo_pref  (ordered list of ciphering algorithms)
  cipherAlgoPref: string[];
  // enb.cfg: cell_list[].integ_algo_pref  (ordered list of integrity algorithms)
  integAlgoPref: string[];

  // ── NB-IoT specific ──────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].nb_iot
  nbIot: boolean;
  // enb.cfg: cell_list[].nb_iot_mode  ("standalone"|"inband"|"guardband")
  nbIotMode: 'standalone' | 'inband' | 'guardband';
  // enb.cfg: cell_list[].nb_iot_prb_index
  nbIotPrbIndex: number;

  // ── CAT-M specific ───────────────────────────────────────────────────────────
  // enb.cfg: cell_list[].ce_mode  (coverage enhancement mode A or B)
  catM: boolean;
  catMCeMode: 'A' | 'B';
  // enb.cfg: cell_list[].max_repetitions
  catMRepetitions: number;

  // ── Logging ───────────────────────────────────────────────────────────────────
  // enb.cfg: log_filename
  logFilename: string;
  // enb.cfg: log_options — global level
  logLevel: string;
  // enb.cfg: log_options — per-layer overrides (e.g. { nas: "debug", s1ap: "debug" })
  logLayers: Record<string, string>;

  // ── Multi-cell (carrier aggregation) ─────────────────────────────────────────
  // All cells in the cell_list. The flat fields above (cellId, pci, band, ...)
  // mirror cells[activeCellIdx] for the section editor.
  cells: LTECellEntry[];
  activeCellIdx: number;
}

export const DEFAULT_LTE_FORM: LTEFormState = {
  // Cell identity
  cellId: 1,
  pci: 0,
  tac: 1,
  rfPort: 0,
  plmn: { mcc: '001', mnc: '01' },
  attachWithoutPdn: true,
  plmnReserved: false,

  // Band / frequency
  band: 7,
  bandwidth: 20,
  dlEarfcn: 3100,

  // Duplex
  cpMode: 'normal',
  phichDuration: 'normal',
  phichResource: '1',
  tddConfig: 2,
  tddSpecialSubframe: 7,

  // Antenna
  nAntennaDl: 1,
  nAntennaUl: 1,

  // RF
  rfMode: 'sdr',
  txGain: 80,
  rxGain: 40,
  rxAntenna: 'rx',

  // Network
  mmeAddr: '127.0.1.100',
  gtpAddr: '127.0.1.1',
  enbId: '0x1A2D0',

  // Cell access / SIB1
  cellBarred: false,
  intraFreqReselection: true,
  qRxLevMin: -70,
  pMax: 23,

  // System Information
  siCoderate: 0.20,
  siWindowLength: 40,

  // Scheduler
  srPeriod: 20,
  cqiPeriod: 40,

  // MAC / HARQ
  ulMaxHarqTx: 5,
  dlMaxHarqTx: 5,

  // Power control
  dpc: true,
  dpcPuschSnrTarget: 25,
  dpcPucchSnrTarget: 15,

  // Timers
  inactivityTimer: 10000,

  // Bearers
  drbConfig: 'drb.cfg',

  // Security
  cipherAlgoPref: ['eea0', 'eea2', 'eea3'],
  integAlgoPref: ['eia2', 'eia3'],

  // NB-IoT
  nbIot: false,
  nbIotMode: 'inband',
  nbIotPrbIndex: 0,

  // CAT-M
  catM: false,
  catMCeMode: 'A',
  catMRepetitions: 1,

  // Logging
  logFilename: '/tmp/enb0.log',
  logLevel: 'error',
  logLayers: {},

  // Multi-cell — start with one default cell mirrored to flat fields above
  cells: [makeDefaultLteCell('Cell 1')],
  activeCellIdx: 0,
};

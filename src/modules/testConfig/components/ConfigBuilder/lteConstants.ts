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

export interface LTEFormState {
  // Cell
  cellId: number;
  pci: number;
  tac: number;
  plmn: { mcc: string; mnc: string };
  // Band
  band: number;
  bandwidth: number;
  dlEarfcn: number;
  // Duplex
  cpMode: 'normal' | 'extended';
  phichDuration: 'normal' | 'extended';
  phichResource: string;
  tddConfig: number;
  tddSpecialSubframe: number;
  // Antenna
  nAntennaDl: number;
  nAntennaUl: number;
  // RF
  rfMode: 'sdr' | 'split' | 'ip';
  txGain: number;
  rxGain: number;
  rxAntenna: string;
  // Network
  mmeAddr: string;
  gtpAddr: string;
  enbId: string;
  // NB-IoT specific
  nbIot: boolean;
  nbIotMode: 'standalone' | 'inband' | 'guardband';
  nbIotPrbIndex: number;
  // CAT-M specific
  catM: boolean;
  catMCeMode: 'A' | 'B';
  catMRepetitions: number;
  // Logging
  logFilename: string;
  logLevel: string;
}

export const DEFAULT_LTE_FORM: LTEFormState = {
  cellId: 1,
  pci: 0,
  tac: 1,
  plmn: { mcc: '001', mnc: '01' },
  band: 7,
  bandwidth: 20,
  dlEarfcn: 3100,
  cpMode: 'normal',
  phichDuration: 'normal',
  phichResource: '1',
  tddConfig: 2,
  tddSpecialSubframe: 7,
  nAntennaDl: 1,
  nAntennaUl: 1,
  rfMode: 'sdr',
  txGain: 80,
  rxGain: 40,
  rxAntenna: 'rx',
  mmeAddr: '127.0.1.100',
  gtpAddr: '127.0.1.1',
  enbId: '0x1A2D0',
  nbIot: false,
  nbIotMode: 'inband',
  nbIotPrbIndex: 0,
  catM: false,
  catMCeMode: 'A',
  catMRepetitions: 1,
  logFilename: '/tmp/enb0.log',
  logLevel: 'error',
};

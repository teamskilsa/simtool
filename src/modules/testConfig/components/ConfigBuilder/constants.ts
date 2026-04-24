// Band and bandwidth options for NR configuration

export const BAND_OPTIONS = {
  FR1: [
    { value: 78, label: 'n78 (3.5 GHz)' },
    { value: 77, label: 'n77 (3.7 GHz)' },
    { value: 41, label: 'n41 (2.5 GHz)' },
    { value: 28, label: 'n28 (700 MHz)' },
    { value: 7, label: 'n7 (2.6 GHz)' },
    { value: 3, label: 'n3 (1.8 GHz)' },
    { value: 1, label: 'n1 (2.1 GHz)' },
  ],
  FR2: [
    { value: 257, label: 'n257 (28 GHz)' },
    { value: 258, label: 'n258 (26 GHz)' },
    { value: 260, label: 'n260 (39 GHz)' },
  ],
};

export const BANDWIDTH_OPTIONS = {
  FR1: [
    { value: 5, label: '5 MHz' },
    { value: 10, label: '10 MHz' },
    { value: 20, label: '20 MHz' },
    { value: 40, label: '40 MHz' },
    { value: 50, label: '50 MHz' },
    { value: 100, label: '100 MHz' },
  ],
  FR2: [
    { value: 50, label: '50 MHz' },
    { value: 100, label: '100 MHz' },
    { value: 200, label: '200 MHz' },
    { value: 400, label: '400 MHz' },
  ],
};

export const SCS_OPTIONS = [
  { value: 15, label: '15 kHz' },
  { value: 30, label: '30 kHz' },
  { value: 60, label: '60 kHz' },
  { value: 120, label: '120 kHz' },
];

export const DEFAULT_ARFCN: Record<number, number> = {
  78: 632628, 77: 622000, 41: 514056, 28: 151600,
  7: 531000, 3: 368500, 1: 428000,
  257: 2079167, 258: 2054167, 260: 2229167,
};

// Default form state for a new NR cell config
export interface NRFormState {
  // Cell
  cellId: number;
  nrTdd: number;       // 0=FDD, 1=TDD
  fr2: number;         // 0=FR1, 1=FR2
  plmn: { mcc: string; mnc: string };
  tac: number;
  ssbPeriod: number;
  dmrsTypeAPos: number;
  // Band
  band: number;
  nrBandwidth: number;
  subcarrierSpacing: number;
  dlNrArfcn: number;
  ssbPosBitmap: string;
  // TDD
  tddPattern: { period: number; dlSlots: number; dlSymbols: number; ulSlots: number; ulSymbols: number };
  // Antenna
  nAntennaDl: number;
  nAntennaUl: number;
  // RF
  rfMode: 'sdr' | 'split' | 'ip';
  txGain: number;
  rxGain: number;
  rxAntenna: string;
  // Network
  amfAddr: string;
  gtpAddr: string;
  gnbId: string;
  // Channel sim
  channelSim: boolean;
  channelType: string;
  noiseLevel: number;
  // Logging
  logFilename: string;
  logLevel: string;
  logLayers: Record<string, string>;
  pcapFilename: string;
  pcapMaxLen: number;
  // PDN / APN section (inline in config)
  pdnList: PdnEntry[];
  // UE Database section (inline in config)
  ueDb: UeDbEntry[];
  // Multi-cell support — all cells in the nr_cell_list. The flat fields above
  // (cellId, band, ...) mirror cells[activeCellIdx] for the section editor.
  cells: NRCellEntry[];
  activeCellIdx: number;
  // ── Layer configuration ─────────────────────────────────────────────────
  layers: LayersConfig;
}

export interface LayersConfig {
  // Frequently used — common tunables
  srPeriod: number;
  cqiPeriod: number;
  dl256qam: boolean;
  ul64qam: boolean;
  dpc: boolean;
  dpcPuschSnrTarget: number;
  dpcPucchSnrTarget: number;
  inactivityTimer: number;
  pMax: number;
  qRxLevMin: number;
  // PHY
  pdschMcsTable: string;     // qam64 | qam256 | qam64LowSE
  puschMcsTable: string;
  prachConfigIndex: number;
  prachRootSeqIndex: number;
  puschMaxLayers: number;
  pmiReportEnabled: boolean;
  // MAC
  ulMaxHarqTx: number;
  dlMaxHarqTx: number;
  msg3MaxHarqTx: number;
  raResponseWindowSize: number;
  macContentionResolutionTimer: number;
  // RLC & PDCP
  rlcMode: 'am' | 'um';
  rlcSnLength: number;        // 6 / 12 / 18 bits
  rlcTReordering: number;
  rlcMaxRetxThreshold: number;
  pdcpSnSize: number;         // 12 / 18 bits
  pdcpDiscardTimer: number;
  // RRC & NAS
  rrcInactivityTimer: number;
  ueInactivityTimer: number;
  paging: { defaultCycle: number };
  // SIBs
  sibCellBarred: boolean;
  sibIntraFreqReselection: boolean;
  sibSiPeriodicity: number;
  sibScheduledSibs: string[];
}

export const DEFAULT_LAYERS: LayersConfig = {
  srPeriod: 20,
  cqiPeriod: 40,
  dl256qam: true,
  ul64qam: true,
  dpc: true,
  dpcPuschSnrTarget: 25,
  dpcPucchSnrTarget: 20,
  inactivityTimer: 10000,
  pMax: 10,
  qRxLevMin: -70,
  pdschMcsTable: 'qam256',
  puschMcsTable: 'qam256',
  prachConfigIndex: 160,
  prachRootSeqIndex: 1,
  puschMaxLayers: 1,
  pmiReportEnabled: true,
  ulMaxHarqTx: 5,
  dlMaxHarqTx: 5,
  msg3MaxHarqTx: 5,
  raResponseWindowSize: 10,
  macContentionResolutionTimer: 64,
  rlcMode: 'am',
  rlcSnLength: 18,
  rlcTReordering: 50,
  rlcMaxRetxThreshold: 32,
  pdcpSnSize: 18,
  pdcpDiscardTimer: 100,
  rrcInactivityTimer: 10000,
  ueInactivityTimer: 60000,
  paging: { defaultCycle: 128 },
  sibCellBarred: false,
  sibIntraFreqReselection: true,
  sibSiPeriodicity: 160,
  sibScheduledSibs: ['SIB2', 'SIB3'],
};

// Per-cell fields — stored in cells[] array. Shared fields (PLMN, RF, network)
// stay at the top of NRFormState since they go into nr_cell_default.
export interface NRCellEntry {
  name: string;                 // UI label, not written to cfg
  cellId: number;
  band: number;
  nrBandwidth: number;
  subcarrierSpacing: number;
  dlNrArfcn: number;
  ssbPosBitmap: string;
  nrTdd: number;
  fr2: number;
  tddPattern: { period: number; dlSlots: number; dlSymbols: number; ulSlots: number; ulSymbols: number };
}

export function makeDefaultCell(name: string, overrides: Partial<NRCellEntry> = {}): NRCellEntry {
  return {
    name,
    cellId: 500,
    band: 78,
    nrBandwidth: 40,
    subcarrierSpacing: 30,
    dlNrArfcn: 632628,
    ssbPosBitmap: '10000000',
    nrTdd: 1,
    fr2: 0,
    tddPattern: { period: 5, dlSlots: 7, dlSymbols: 6, ulSlots: 2, ulSymbols: 4 },
    ...overrides,
  };
}

export interface PdnEntry {
  pdn_type: string;
  access_point_name: string;
  first_ip_addr: string;
  last_ip_addr: string;
  dns_addr?: string;
  ims_vops?: boolean;
}

export interface UeDbEntry {
  sim_algo: string;
  imsi: string;
  K: string;
  opc: string;
  amf: number;
  sqn: string;
  nb_ue: number;
  ims?: boolean;
}

export const DEFAULT_NR_FORM: NRFormState = {
  cellId: 500,
  nrTdd: 1,
  fr2: 0,
  plmn: { mcc: '001', mnc: '01' },
  tac: 1,
  ssbPeriod: 20,
  dmrsTypeAPos: 2,
  band: 78,
  nrBandwidth: 40,
  subcarrierSpacing: 30,
  dlNrArfcn: 632628,
  ssbPosBitmap: '10000000',
  tddPattern: { period: 5, dlSlots: 7, dlSymbols: 6, ulSlots: 2, ulSymbols: 4 },
  nAntennaDl: 1,
  nAntennaUl: 1,
  rfMode: 'sdr',
  txGain: 90,
  rxGain: 60,
  rxAntenna: 'rx',
  amfAddr: '127.0.1.100',
  gtpAddr: '127.0.1.1',
  gnbId: '0x12345',
  channelSim: false,
  channelType: 'AWGN',
  noiseLevel: -100,
  logFilename: '/tmp/gnb0.log',
  logLevel: 'error',
  logLayers: {},
  pcapFilename: '',
  pcapMaxLen: 65536,
  pdnList: [
    { pdn_type: 'ipv4', access_point_name: 'internet', first_ip_addr: '192.168.2.2', last_ip_addr: '192.168.2.254', dns_addr: '8.8.8.8' },
  ],
  ueDb: [
    { sim_algo: 'milenage', imsi: '001010000000001', K: '00112233445566778899aabbccddeeff', opc: '63bfa50ee6523365ff14c1f45f88737d', amf: 0x9001, sqn: '000000000000', nb_ue: 1 },
  ],
  cells: [makeDefaultCell('Cell 1')],
  activeCellIdx: 0,
  layers: { ...DEFAULT_LAYERS },
};

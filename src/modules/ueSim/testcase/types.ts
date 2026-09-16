// modules/ueSim/testcase/types.ts
//
// The UE-SIM test case as Simnovator presents it: six wizard steps
// (Cell · Subscriber · User Plane · Traffic · Mobility · Settings), each a
// flat form. This is the *intermediate* object — what the operator edits
// and what is embedded verbatim in the header of the generated ue.cfg so
// the wizard can reopen it. generateUeCfg.ts turns it into the keys the
// Simnovus lteue build reads (the same shape Simnovator's own compiler
// writes: global_traffic profiles, per-UE traffic entries, ecc_params,
// algorithm bitmaps, ue_move events).

// ── 1. Cell ──────────────────────────────────────────────────────────────

export type RatType = '5G:SA' | '4G';
export type DuplexMode = 'TDD' | 'FDD';
export type Scs = 15 | 30 | 60 | 120;

export interface CellConfig {
  id: number;
  duplexMode: DuplexMode;
  ntn: boolean;
  /** NR band as "n78", LTE band as "7". */
  band: string;
  dlNrArfcn: number;
  ssbNrArfcn: number;
  dlEarfcn: number;
  /** MHz */
  bandwidth: number;
  scs: Scs;
  /** SDR port set: "0-1" = /dev/sdr0 + /dev/sdr1 (one RF card), "2-3" the next. */
  rfCard: string;
  dlAntennas: 1 | 2 | 4;
  ulAntennas: 1 | 2;
  /** One entry per UL antenna (UE transmits on UL). dB. */
  txGain: number[];
  /** One entry per DL antenna (UE receives on DL). dB. */
  rxGain: number[];
}

export interface CellStepData {
  product: 'UE-SIM';
  ratType: RatType;
  carrierAggregation: boolean;
  mobility: boolean;
  cells: CellConfig[];
}

// ── 2. Subscriber ────────────────────────────────────────────────────────

export type SimAlgorithm = 'Milenage' | 'XOR' | 'TUAK';
export type ProtectionScheme = 'Null' | 'Profile A' | 'Profile B';
export type UeCategoryType = 'Combined' | 'NR' | 'LTE';
export type PdnType = 'IPv4' | 'IPv6' | 'IPv4v6';
export type AutoOrNumber = 'Auto' | number;

export interface SubscriberGroup {
  id: number;
  ueCount: number;
  servingCell: number;
  /** Numeric SUPI as Simnovator stores it: "1010123456001" = 001010123456001. */
  startingSupi: string;
  /** SUPI increment between consecutive UEs. */
  nextSupi: number;
  mncDigits: 2 | 3;
  protectionScheme: ProtectionScheme;
  publicKeyId: number;
  routingIndicator: string;

  algorithm: SimAlgorithm;
  /** 32 hex chars. */
  sharedKey: string;
  /** Added to K per UE (hex arithmetic). 0 = every UE shares K. */
  incrementSharedKey: number;
  opType: 'OP' | 'OPc';
  opValue: string;
  sqn: string;
  resLen: 4 | 8 | 16;
  integrity: { nia0: boolean; nia1: boolean; nia2: boolean; nia3: boolean };
  cipher: { nea0: boolean; nea1: boolean; nea2: boolean; nea3: boolean };
  externalSim: boolean;

  asRelease: number;
  ueCategoryType: UeCategoryType;
  /** "NR" for a 5G UE, otherwise an LTE category number as a string. */
  ueCategory: string;
  attachPdnType: 'Normal' | 'Emergency';
  pdnType: PdnType;
  defaultApn: string;
  vonrSupport: boolean;
  networkSlicing: 'Disable' | 'Enable';
  nssai: Array<{ sst: number; sd: string }>;
  accessClass: number[];
  uacMps: boolean;
  uacMcs: boolean;
  rrcInactive: boolean;

  blerOverride: number;
  cqi: AutoOrNumber;
  ri: AutoOrNumber;
  pmi: AutoOrNumber;

  // Advanced (hidden unless the toggle is on)
  /** Base IMEISV; digits 9–14 are replaced by the UE number, as Simnovator does. */
  imeisv: string;
  /** Home-network public key, hex. Required when the protection scheme is A or B. */
  homeNetworkPublicKey: string;
}

export interface SubscriberStepData {
  groups: SubscriberGroup[];
  advanced: boolean;
}

// ── 3. User Plane ────────────────────────────────────────────────────────

export type DataType = 'IPERF' | 'PING' | 'HTTP' | 'None';
export type BitrateUnit = 'Kbps' | 'Mbps' | 'Gbps';
export type TransferAction = 'Both' | 'DL' | 'UL';
export type GroupSelector = 'all' | number;

export interface Bitrate {
  value: number;
  unit: BitrateUnit;
}

export interface UserPlaneProfile {
  id: number;
  dataType: DataType;
  subscriberGroup: GroupSelector;
  apnName: string;
  pdnType: PdnType;
  destinationIp: string;
  /** HTTP only. */
  destinationUrl: string;
  /** iperf: first port of the range the app server allocates from (two ports per UE). */
  startingPort: number;
  transportProtocol: 'UDP' | 'TCP';
  fileTransferAction: TransferAction;
  dlBitrate: Bitrate;
  ulBitrate: Bitrate;
  /** iperf payload / ping packet size, bytes. */
  payloadLength: number;
  mtuSize: number;
  /** PING: seconds between packets. */
  pingInterval: number;
  /** PING: packets per session. */
  pingCount: number;
  startDelay: number;
  duration: number;
  /** Repeat the session. */
  loop: boolean;
  /** Total sessions when looping (>= 2). */
  loopCount: number;
  /** Seconds between looped sessions. */
  loopGap: number;
}

export interface UserPlaneStepData {
  profiles: UserPlaneProfile[];
}

// ── 4. Traffic (power cycle) ─────────────────────────────────────────────

export type AttachType = 'Bursty' | 'Sequential';

export interface TrafficProfile {
  id: number;
  subscriberGroups: GroupSelector;
  attachType: AttachType;
  loopProfile: 'Disable' | 'Enable';
  /** Seconds the UE stays powered on (0 = never power off). */
  powerOnDuration: number;
  /** Seconds off between cycles when looping. */
  powerOffDuration: number;
  /** Total power-on cycles when looping (>= 2). */
  loopCount: number;
  /** UEs attached per second. */
  attachRate: number;
  /** Seconds before the first attach. */
  attachDelay: number;
}

export interface TrafficStepData {
  profiles: TrafficProfile[];
}

// ── 5. Mobility ──────────────────────────────────────────────────────────

/** lteue's channel simulator models AWGN with distance path loss; that is
 *  also the only type Simnovator compiles. */
export type ChannelModel = 'None' | 'AWGN';
export type TripType = 'stationary' | 'oneWay' | 'roundTrip';

export interface CellPosition {
  cellId: number;
  x: number;
  y: number;
}

export interface GroupMobility {
  groupId: number;
  x: number;
  y: number;
  speedKmh: number;
  direction: number;
  tripType: TripType;
  /** Metres travelled per leg. */
  distance: number;
  /** Seconds after power-on before the UE starts moving. */
  startDelay: number;
  /** Seconds the movement pattern runs before the UE stops. */
  duration: number;
}

export interface MobilityStepData {
  channelModel: ChannelModel;
  /** Recorded for the report; lteue's AWGN model has no Doppler knob. */
  dopplerHz: number;
  /** Cell reference signal power in dBm (Amarisoft ref_signal_power). */
  refSignalPower: number;
  /** Uplink analog attenuation in dB. */
  ulPowerAttenuation: number;
  /** Noise spectral density in dBm/Hz. */
  noiseSpd: number;
  cellPositions: CellPosition[];
  groups: GroupMobility[];
}

// ── 6. Settings ──────────────────────────────────────────────────────────

/** Simnovator's built-in logging profiles. */
export type LogPreset = 'rrc_debug' | 'nas_rrc_debug' | 'debug' | 'info' | 'error' | 'disable';
export type SuccessSetting = 'BLER Success' | 'Attach Success' | 'Throughput Success' | 'Ping Success';

export interface SettingsStepData {
  testCaseName: string;
  logSettings: LogPreset;
  successSettings: SuccessSetting;
  description: string;
  // Advanced
  comPort: number;
  /** Empty = /tmp/<test case name>.log, as Simnovator names it. */
  logFilename: string;
  rfDriverName: string;
  /** Empty = derived from the RF cards chosen on the Cell step. */
  rfDriverArgs: string;
}

// ── Test case ────────────────────────────────────────────────────────────

export interface UeTestCase {
  version: 1;
  id: string;
  createdAt: string;
  modifiedAt: string;
  cell: CellStepData;
  subscriber: SubscriberStepData;
  userPlane: UserPlaneStepData;
  traffic: TrafficStepData;
  mobility: MobilityStepData;
  settings: SettingsStepData;
}

export type StepKey = 'cell' | 'subscriber' | 'userPlane' | 'traffic' | 'mobility' | 'settings';

export const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'cell', label: 'Cell' },
  { key: 'subscriber', label: 'Subscriber' },
  { key: 'userPlane', label: 'User Plane' },
  { key: 'traffic', label: 'Traffic' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'settings', label: 'Settings' },
];

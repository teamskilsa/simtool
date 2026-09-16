// modules/ueSim/testcase/defaults.ts
//
// Factory defaults for every wizard step, the band tables that seed the
// ARFCN fields, and the option lists the selects render. The defaults are
// the values Simnovator shows on a fresh "New Test Case" so a user coming
// from that tool lands on familiar numbers; the traffic target is the
// lab's app server (20.10.10.1, iperf from port 5000).

import type {
  CellConfig, CellStepData, GroupMobility, LogPreset, MobilityStepData, RatType,
  SettingsStepData, SubscriberGroup, SubscriberStepData, TrafficProfile,
  TrafficStepData, UeTestCase, UserPlaneProfile, UserPlaneStepData,
} from './types';

// ── Band tables ──────────────────────────────────────────────────────────

export interface NrBandInfo {
  band: string;
  duplex: 'TDD' | 'FDD';
  /** Sensible mid-band DL NR-ARFCN. */
  dlNrArfcn: number;
  ssbNrArfcn: number;
  /** ul_nr_arfcn = dl_nr_arfcn - ulOffset (0 for TDD). */
  ulOffset: number;
  scs: 15 | 30 | 120;
  bandwidths: number[];
}

export const NR_BANDS: NrBandInfo[] = [
  { band: 'n1',  duplex: 'FDD', dlNrArfcn: 428000, ssbNrArfcn: 427970, ulOffset: 38000, scs: 15, bandwidths: [5, 10, 15, 20] },
  { band: 'n3',  duplex: 'FDD', dlNrArfcn: 368500, ssbNrArfcn: 368410, ulOffset: 19000, scs: 15, bandwidths: [5, 10, 15, 20] },
  { band: 'n7',  duplex: 'FDD', dlNrArfcn: 531000, ssbNrArfcn: 530910, ulOffset: 24000, scs: 15, bandwidths: [5, 10, 15, 20] },
  { band: 'n28', duplex: 'FDD', dlNrArfcn: 154600, ssbNrArfcn: 154570, ulOffset: 11000, scs: 15, bandwidths: [5, 10, 15, 20] },
  { band: 'n40', duplex: 'TDD', dlNrArfcn: 470000, ssbNrArfcn: 469990, ulOffset: 0, scs: 30, bandwidths: [10, 20, 40, 50, 60, 80, 100] },
  { band: 'n41', duplex: 'TDD', dlNrArfcn: 518598, ssbNrArfcn: 518430, ulOffset: 0, scs: 30, bandwidths: [10, 20, 40, 50, 60, 80, 100] },
  { band: 'n48', duplex: 'TDD', dlNrArfcn: 641272, ssbNrArfcn: 641280, ulOffset: 0, scs: 30, bandwidths: [10, 20, 40, 50, 60, 80, 100] },
  { band: 'n77', duplex: 'TDD', dlNrArfcn: 650000, ssbNrArfcn: 649920, ulOffset: 0, scs: 30, bandwidths: [10, 20, 40, 50, 60, 80, 100] },
  { band: 'n78', duplex: 'TDD', dlNrArfcn: 627300, ssbNrArfcn: 624576, ulOffset: 0, scs: 30, bandwidths: [10, 20, 40, 50, 60, 80, 100] }, // the bench cell — see BENCH_CELL
  { band: 'n79', duplex: 'TDD', dlNrArfcn: 720000, ssbNrArfcn: 719910, ulOffset: 0, scs: 30, bandwidths: [40, 50, 60, 80, 100] },
  { band: 'n257', duplex: 'TDD', dlNrArfcn: 2079167, ssbNrArfcn: 2079167, ulOffset: 0, scs: 120, bandwidths: [50, 100, 200, 400] },
];

export interface LteBandInfo {
  band: string;
  duplex: 'TDD' | 'FDD';
  dlEarfcn: number;
  /** ul_earfcn = dl_earfcn + ulOffset (0 for TDD). */
  ulOffset: number;
  bandwidths: number[];
}

export const LTE_BANDS: LteBandInfo[] = [
  { band: '1',  duplex: 'FDD', dlEarfcn: 300,   ulOffset: 18000, bandwidths: [5, 10, 15, 20] },
  { band: '3',  duplex: 'FDD', dlEarfcn: 1575,  ulOffset: 18000, bandwidths: [1.4, 3, 5, 10, 15, 20] },
  { band: '7',  duplex: 'FDD', dlEarfcn: 3350,  ulOffset: 18000, bandwidths: [5, 10, 15, 20] },
  { band: '20', duplex: 'FDD', dlEarfcn: 6300,  ulOffset: 18000, bandwidths: [5, 10, 15, 20] },
  { band: '28', duplex: 'FDD', dlEarfcn: 9435,  ulOffset: 18000, bandwidths: [3, 5, 10, 15, 20] },
  { band: '38', duplex: 'TDD', dlEarfcn: 37900, ulOffset: 0, bandwidths: [5, 10, 15, 20] },
  { band: '40', duplex: 'TDD', dlEarfcn: 39150, ulOffset: 0, bandwidths: [5, 10, 15, 20] },
  { band: '41', duplex: 'TDD', dlEarfcn: 40620, ulOffset: 0, bandwidths: [5, 10, 15, 20] },
  { band: '42', duplex: 'TDD', dlEarfcn: 42590, ulOffset: 0, bandwidths: [5, 10, 15, 20] },
  { band: '48', duplex: 'TDD', dlEarfcn: 55990, ulOffset: 0, bandwidths: [5, 10, 15, 20] },
];

/**
 * The cell a fresh test case points at.
 *
 * These are the live lab callbox (192.168.1.106) as of 2026-09-15: n78 TDD,
 * 100 MHz, SCS 30, 2 DL / 1 UL antennas, first carrier at ARFCN 627300 with
 * SSB at 624576. A default test case therefore attaches to the bench without
 * anyone retyping frequencies.
 *
 * That box is re-pointed between test sessions — it was on 632628 and on a
 * 1-cell config in earlier notes — so when the callbox moves, re-read
 * `/root/enb/config/enb.cfg` on it and change these five numbers. Nothing
 * else in the wizard hardcodes a frequency.
 */
export const BENCH_CELL = {
  dlNrArfcn: 627300,
  ssbNrArfcn: 624576,
  bandwidth: 100,
  dlAntennas: 2 as const,
  ulAntennas: 1 as const,
};

/** RF card = the SDR device a cell starts on. A cell occupies one device
 *  per two DL antennas, so a 4x2 cell on card 0 also consumes /dev/sdr1 and
 *  the next cell should start at card 2. */
export const RF_CARDS = ['0', '1', '2', '3', '4', '5', '6', '7'];

// ── Logging presets (Simnovator's log_settings table) ────────────────────

export type LogLevel = 'none' | 'error' | 'info' | 'debug';
export interface LogPresetInfo {
  label: string;
  layers: { sip: LogLevel; ip: LogLevel; nas: LogLevel; rrc: LogLevel; pdcp: LogLevel; rlc: LogLevel; mac: LogLevel; phy: LogLevel };
}

const all = (l: LogLevel): LogPresetInfo['layers'] => ({ sip: l, ip: l, nas: l, rrc: l, pdcp: l, rlc: l, mac: l, phy: l });

export const LOG_PRESETS: Record<LogPreset, LogPresetInfo> = {
  rrc_debug:     { label: 'rrc_debug',     layers: { ...all('none'), rrc: 'debug' } },
  nas_rrc_debug: { label: 'nas_rrc_debug', layers: { ...all('none'), nas: 'debug', rrc: 'debug' } },
  debug:         { label: 'debug',         layers: all('debug') },
  info:          { label: 'info',          layers: all('info') },
  error:         { label: 'error',         layers: all('error') },
  disable:       { label: 'disable',       layers: all('none') },
};

/** The log_options string exactly as Simnovator writes it for a preset. */
export function logOptionsFor(preset: LogPreset, ntn = false): string {
  const p = LOG_PRESETS[preset] ?? LOG_PRESETS.rrc_debug;
  const l = p.layers;
  return [
    `sip.level=${l.sip}`, `ip.level=${l.ip}`, `nas.level=${l.nas}`, `rrc.level=${l.rrc}`,
    `pdcp.level=${l.pdcp}`, `rlc.level=${l.rlc}`, `mac.level=${l.mac}`, `phy.level=${l.phy}`,
    'phy.signal=0', ...(ntn ? ['phy.ntn=1'] : []), 'all.max_size=1', 'file.rotate=5M', 'time=full',
  ].join(',');
}

// ── Per-step factories ───────────────────────────────────────────────────

export function makeCell(id: number, rat: RatType, seed?: Partial<CellConfig>): CellConfig {
  const base: CellConfig = rat === '5G:SA'
    ? {
        id, duplexMode: 'TDD', ntn: false, band: 'n78',
        dlNrArfcn: BENCH_CELL.dlNrArfcn, ssbNrArfcn: BENCH_CELL.ssbNrArfcn, dlEarfcn: 3350,
        bandwidth: BENCH_CELL.bandwidth, scs: 30, rfCard: '0',
        // Antenna count must match the cell under test, not the UE's maximum:
        // a 4x2 UE does not decode a 2x1 cell. The bench cells are 2x1.
        dlAntennas: BENCH_CELL.dlAntennas, ulAntennas: BENCH_CELL.ulAntennas,
        txGain: [80], rxGain: [10, 10],
      }
    : {
        id, duplexMode: 'FDD', ntn: false, band: '7',
        dlNrArfcn: BENCH_CELL.dlNrArfcn, ssbNrArfcn: BENCH_CELL.ssbNrArfcn, dlEarfcn: 3350,
        bandwidth: 20, scs: 15, rfCard: '0',
        dlAntennas: 4, ulAntennas: 1,
        txGain: [80], rxGain: [10, 10, 10, 10],
      };
  return { ...base, ...seed };
}

export function makeCellStep(rat: RatType = '5G:SA'): CellStepData {
  return {
    product: 'UE-SIM',
    ratType: rat,
    carrierAggregation: false,
    mobility: false,
    cells: [makeCell(0, rat)],
  };
}

export function makeSubscriberGroup(id: number, rat: RatType, seed?: Partial<SubscriberGroup>): SubscriberGroup {
  const isNr = rat === '5G:SA';
  return {
    id,
    ueCount: 2,
    servingCell: 0,
    // Simnovator's numeric form of 001010123456001 (+ id * 1000 so each
    // added group gets its own SUPI range instead of colliding with the first).
    startingSupi: String(1010123456001 + id * 1000),
    nextSupi: 1,
    mncDigits: 2,
    protectionScheme: 'Null',
    publicKeyId: 0,
    routingIndicator: '1111',

    algorithm: 'Milenage',
    sharedKey: '00112233445566778899aabbccddeeff',
    incrementSharedKey: 0,
    opType: 'OPc',
    opValue: '000102030405060708090a0b0c0d0e0f',
    sqn: '',
    resLen: 8,
    integrity: { nia0: true, nia1: true, nia2: true, nia3: false },
    cipher: { nea0: true, nea1: true, nea2: true, nea3: false },
    externalSim: false,

    asRelease: isNr ? 16 : 12,
    ueCategoryType: isNr ? 'Combined' : 'LTE',
    ueCategory: isNr ? 'NR' : '6',
    attachPdnType: 'Normal',
    pdnType: 'IPv4',
    defaultApn: '',
    vonrSupport: isNr,
    networkSlicing: 'Disable',
    nssai: [{ sst: 1, sd: '' }],
    accessClass: [],
    uacMps: false,
    uacMcs: false,
    rrcInactive: false,

    blerOverride: 0,
    cqi: 'Auto',
    ri: 'Auto',
    pmi: 'Auto',

    imeisv: '4085780000000102',
    homeNetworkPublicKey: '',
    ...seed,
  };
}

export function makeSubscriberStep(rat: RatType = '5G:SA'): SubscriberStepData {
  return { groups: [makeSubscriberGroup(0, rat)], advanced: false };
}

export function makeUserPlaneProfile(id: number, seed?: Partial<UserPlaneProfile>): UserPlaneProfile {
  return {
    id,
    dataType: 'IPERF',
    subscriberGroup: 'all',
    apnName: '',
    pdnType: 'IPv4',
    destinationIp: '20.10.10.1',
    destinationUrl: '',
    startingPort: 5000,
    transportProtocol: 'UDP',
    fileTransferAction: 'Both',
    dlBitrate: { value: 150, unit: 'Mbps' },
    ulBitrate: { value: 50, unit: 'Mbps' },
    payloadLength: 1000,
    mtuSize: 1500,
    pingInterval: 1,
    pingCount: 60,
    startDelay: 5,
    duration: 600,
    loop: false,
    loopCount: 2,
    loopGap: 20,
    ...seed,
  };
}

export function makeUserPlaneStep(): UserPlaneStepData {
  return { profiles: [makeUserPlaneProfile(0)] };
}

export function makeTrafficProfile(id: number, seed?: Partial<TrafficProfile>): TrafficProfile {
  return {
    id,
    subscriberGroups: 'all',
    attachType: 'Bursty',
    loopProfile: 'Disable',
    powerOnDuration: 650,
    powerOffDuration: 10,
    loopCount: 2,
    attachRate: 1,
    attachDelay: 0,
    ...seed,
  };
}

export function makeTrafficStep(): TrafficStepData {
  return { profiles: [makeTrafficProfile(0)] };
}

export function makeGroupMobility(groupId: number, seed?: Partial<GroupMobility>): GroupMobility {
  return {
    groupId, x: 0, y: 0, speedKmh: 0, direction: 0,
    tripType: 'stationary', distance: 50, startDelay: 5, duration: 380,
    ...seed,
  };
}

export function makeMobilityStep(): MobilityStepData {
  return {
    channelModel: 'AWGN',
    dopplerHz: 0,
    refSignalPower: -25,
    ulPowerAttenuation: 60,
    noiseSpd: -174,
    cellPositions: [{ cellId: 0, x: 4, y: 3 }],
    groups: [makeGroupMobility(0)],
  };
}

export function makeSettingsStep(name = 'untitled'): SettingsStepData {
  return {
    testCaseName: name,
    logSettings: 'rrc_debug',
    successSettings: 'BLER Success',
    description: '',
    comPort: 9002,
    logFilename: '',
    rfDriverName: 'sdr',
    rfDriverArgs: '',
  };
}

let seq = 0;
export function newTestCaseId(): string {
  seq += 1;
  return `tc-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 6)}`;
}

export function makeTestCase(name = 'untitled', rat: RatType = '5G:SA'): UeTestCase {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: newTestCaseId(),
    createdAt: now,
    modifiedAt: now,
    cell: makeCellStep(rat),
    subscriber: makeSubscriberStep(rat),
    userPlane: makeUserPlaneStep(),
    traffic: makeTrafficStep(),
    mobility: makeMobilityStep(),
    settings: makeSettingsStep(name),
  };
}

const LEGACY_LOG: Record<string, LogPreset> = {
  rrc_debug: 'rrc_debug', nas_debug: 'nas_rrc_debug', phy_mac_debug: 'debug', all_info: 'info', minimal: 'error',
};

/** Merge a possibly-older or partial saved object onto fresh defaults so
 *  a field added later never comes back undefined. */
export function normalizeTestCase(raw: Partial<UeTestCase>): UeTestCase {
  const rat = raw.cell?.ratType ?? '5G:SA';
  const fresh = makeTestCase(raw.settings?.testCaseName ?? 'untitled', rat);
  const cells = (raw.cell?.cells ?? fresh.cell.cells).map((c, i) => ({ ...makeCell(i, rat), ...c }));
  const groups = (raw.subscriber?.groups ?? fresh.subscriber.groups).map((g, i) => {
    const seed = makeSubscriberGroup(i, rat);
    const legacy = g as SubscriberGroup & { imeiPrefix?: string };
    return {
      ...seed, ...g,
      integrity: { ...seed.integrity, ...(g.integrity ?? {}) },
      cipher: { ...seed.cipher, ...(g.cipher ?? {}) },
      imeisv: g.imeisv ?? (legacy.imeiPrefix ? (legacy.imeiPrefix + '0000000000000000').slice(0, 16) : seed.imeisv),
    };
  });
  const mobilityRaw = raw.mobility ?? fresh.mobility;
  const logRaw = raw.settings?.logSettings as string | undefined;
  return {
    ...fresh,
    ...raw,
    version: 1,
    id: raw.id ?? fresh.id,
    cell: { ...fresh.cell, ...(raw.cell ?? {}), cells },
    subscriber: { ...fresh.subscriber, ...(raw.subscriber ?? {}), groups },
    userPlane: {
      profiles: (raw.userPlane?.profiles ?? fresh.userPlane.profiles).map((p, i) => ({ ...makeUserPlaneProfile(i), ...p })),
    },
    traffic: {
      profiles: (raw.traffic?.profiles ?? fresh.traffic.profiles).map((p, i) => ({ ...makeTrafficProfile(i), ...p })),
    },
    mobility: {
      ...fresh.mobility,
      ...mobilityRaw,
      channelModel: mobilityRaw.channelModel === 'None' ? 'None' : 'AWGN',
      cellPositions: mobilityRaw.cellPositions ?? fresh.mobility.cellPositions,
      groups: (mobilityRaw.groups ?? []).map(g => ({ ...makeGroupMobility(g.groupId), ...g })),
    },
    settings: {
      ...fresh.settings,
      ...(raw.settings ?? {}),
      logSettings: (logRaw && LEGACY_LOG[logRaw]) || 'rrc_debug',
    },
  };
}

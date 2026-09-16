// modules/coreNet/config/defaults.ts
//
// Factory defaults for the Core configuration form. The values are the lab
// callbox's live mme.cfg (192.168.1.106, read 2026-09-15): PLMN 00101, the
// four APNs it serves, and the demo subscriber database. A fresh config
// therefore matches the bench the UE-SIM test cases attach to.

import type {
  CoreConfig, Erab, ImsStepData, LogPreset, NetworkStepData, PdnEntry,
  PdnStepData, SettingsStepData, SubscriberRange, SubscriberStepData,
} from './types';

/**
 * The core the bench runs, and the counterpart of the UE-SIM wizard's
 * BENCH_CELL. When the callbox is re-pointed, re-read /root/mme/config/mme.cfg
 * and change these.
 */
export const BENCH_CORE = {
  mcc: '001',
  mnc: '01',
  gtpAddr: '127.0.1.100',
  mmeGroupId: 32769,
  mmeCode: 1,
  imsAddr: '127.0.0.1',
  imsBindAddr: '127.0.0.2',
  pCscf: '192.168.4.1',
  licenseServerAddr: '192.168.0.11:9051',
  licenseTag: 'rnd-mme',
};

// ── Logging presets ──────────────────────────────────────────────────────
// ltemme's layers are nas, ip, s1ap, ngap, gtpu, rx, cx and 'all'.

export interface LogPresetInfo {
  label: string;
  logOptions: string;
}

export const LOG_PRESETS: Record<LogPreset, LogPresetInfo> = {
  nas_s1ap_debug: {
    label: 'nas_s1ap_debug',
    logOptions: 'all.level=error,all.max_size=0,nas.level=debug,nas.max_size=1,s1ap.level=debug,s1ap.max_size=1,ngap.level=debug,ngap.max_size=1,rx.level=debug,rx.max_size=1,cx.level=debug,cx.max_size=1',
  },
  nas_debug: { label: 'nas_debug', logOptions: 'all.level=error,all.max_size=0,nas.level=debug,nas.max_size=1' },
  debug: { label: 'debug', logOptions: 'all.level=debug,all.max_size=32' },
  info: { label: 'info', logOptions: 'all.level=info,all.max_size=1' },
  error: { label: 'error', logOptions: 'all.level=error,all.max_size=0' },
  disable: { label: 'disable', logOptions: 'all.level=none,all.max_size=0' },
};

/** NAS algorithm identifiers, most-preferred first in the *_pref arrays. */
export const NAS_ALGOS = [
  { value: 1, label: 'EEA1 / EIA1 (SNOW 3G)' },
  { value: 2, label: 'EEA2 / EIA2 (AES)' },
  { value: 3, label: 'EEA3 / EIA3 (ZUC)' },
];

/** Standard QCI / 5QI values with what they are normally used for. */
export const QCI_OPTIONS = [
  { value: 1, label: '1 — conversational voice' },
  { value: 2, label: '2 — conversational video' },
  { value: 3, label: '3 — real-time gaming' },
  { value: 4, label: '4 — non-conversational video' },
  { value: 5, label: '5 — IMS signalling' },
  { value: 6, label: '6 — video, buffered' },
  { value: 7, label: '7 — voice/video, interactive' },
  { value: 8, label: '8 — premium data' },
  { value: 9, label: '9 — default bearer' },
];

export function defaultErab(qci = 9): Erab {
  return {
    qci,
    priorityLevel: 15,
    preemptionCapability: 'shall_not_trigger_pre_emption',
    preemptionVulnerability: 'not_pre_emptable',
  };
}

// ── Per-step factories ───────────────────────────────────────────────────

export function makeNetworkStep(): NetworkStepData {
  return {
    coreType: 'Combined',
    mcc: BENCH_CORE.mcc,
    mnc: BENCH_CORE.mnc,
    tac: 100,
    mmeGroupId: BENCH_CORE.mmeGroupId,
    mmeCode: BENCH_CORE.mmeCode,
    gtpAddr: BENCH_CORE.gtpAddr,
    networkName: 'Simnovus Network',
    networkShortName: 'Simnovus',
    dcnrSupport: true,
    cpCiotOpt: true,
    epsInterworking: 'with_n26',
    fifteenBearers: false,
    // The bench runs eDRX on; ltemme only writes the keys when it is enabled.
    edrx: true,
    edrxCycleForced: 3,
    nssai: [{ sst: 1, sd: '' }],
  };
}

export function makePdn(id: number, seed?: Partial<PdnEntry>): PdnEntry {
  return {
    id,
    apn: id === 0 ? 'default' : `apn${id}`,
    pdnType: 'ipv4',
    gateway: '',
    firstIpAddr: `10.10.${id + 1}.2`,
    lastIpAddr: `10.10.${id + 1}.254`,
    ipAddrShift: 0,
    firstIpv6Prefix: '',
    lastIpv6Prefix: '',
    dnsAddr: '8.8.8.8',
    pCscfAddr: '',
    emergency: false,
    erabs: [defaultErab(9)],
    slices: [],
    ...seed,
  };
}

export function makePdnStep(): PdnStepData {
  return {
    // The bench's four APNs, in its order: the first is the default.
    pdns: [
      makePdn(0, { apn: 'default', gateway: '10.10.1.1', firstIpAddr: '10.10.1.2', lastIpAddr: '10.10.2.254' }),
      makePdn(1, {
        apn: 'ims', pdnType: 'ipv4v6', firstIpAddr: '10.10.3.2', lastIpAddr: '10.10.4.2',
        firstIpv6Prefix: '2001:468:3000:1::', lastIpv6Prefix: '2001:468:3000:ffff::',
        pCscfAddr: BENCH_CORE.pCscf, dnsAddr: '8.8.8.8, 2001:4860:4860::8888',
        erabs: [defaultErab(5)],
      }),
      makePdn(2, {
        apn: 'sos', pdnType: 'ipv4v6', emergency: true,
        firstIpAddr: '10.10.8.2', lastIpAddr: '10.10.8.254',
        firstIpv6Prefix: '2001:468:4000:1::', lastIpv6Prefix: '2001:468:4000:ffff::',
        pCscfAddr: '10.10.8.1', dnsAddr: '8.8.8.8, 2001:4860:4860::8888',
        erabs: [defaultErab(5)],
      }),
    ],
    tunSetupScript: 'mme-ifup',
  };
}

export function makeSubscriberRange(id: number, seed?: Partial<SubscriberRange>): SubscriberRange {
  return {
    id,
    count: 10,
    startingImsi: '001010123456001',
    simAlgo: 'xor',
    K: '00112233445566778899aabbccddeeff',
    incrementK: 0,
    opType: 'none',
    opValue: '000102030405060708090a0b0c0d0e0f',
    amf: '0x9001',
    sqn: '000000000000',
    imsEnabled: true,
    imsDomain: '',
    imsPassword: 'sim',
    msisdnBase: '+917600000000',
    shortNumberBase: '600',
    ...seed,
  };
}

export function makeSubscriberStep(): SubscriberStepData {
  return {
    ranges: [makeSubscriberRange(0)],
    separateFile: false,
    includeFilename: 'ue_db.cfg',
  };
}

export function makeImsStep(): ImsStepData {
  return {
    enabled: true,
    imsAddr: BENCH_CORE.imsAddr,
    bindAddr: BENCH_CORE.imsBindAddr,
    vopsEps: true,
    vops5gs: true,
    vops5gsN3gpp: true,
    rxEnabled: true,
    rxBindAddr: BENCH_CORE.gtpAddr,
    rxQciAudio: 1,
    rxQciVideo: 2,
    emergencyNumbers: [
      { category: 0x1f, digits: '911' },
      { category: 0x1f, digits: '112' },
    ],
  };
}

export function makeSettingsStep(name = 'untitled'): SettingsStepData {
  return {
    configName: name,
    description: '',
    logSettings: 'nas_s1ap_debug',
    logFilename: '',
    comPort: 9000,
    licenseServerAddr: BENCH_CORE.licenseServerAddr,
    licenseTag: BENCH_CORE.licenseTag,
    nasCipherPref: [],
    nasIntegPref: [2, 1],
  };
}

let seq = 0;
export function newCoreConfigId(): string {
  seq += 1;
  return `core-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 6)}`;
}

export function makeCoreConfig(name = 'untitled'): CoreConfig {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: newCoreConfigId(),
    createdAt: now,
    modifiedAt: now,
    network: makeNetworkStep(),
    pdn: makePdnStep(),
    subscriber: makeSubscriberStep(),
    ims: makeImsStep(),
    settings: makeSettingsStep(name),
  };
}

/** Merge a possibly-older or partial saved object onto fresh defaults so a
 *  field added later never comes back undefined. */
export function normalizeCoreConfig(raw: Partial<CoreConfig>): CoreConfig {
  const fresh = makeCoreConfig(raw.settings?.configName ?? 'untitled');
  return {
    ...fresh,
    ...raw,
    version: 1,
    id: raw.id ?? fresh.id,
    network: { ...fresh.network, ...(raw.network ?? {}) },
    pdn: {
      ...fresh.pdn,
      ...(raw.pdn ?? {}),
      pdns: (raw.pdn?.pdns ?? fresh.pdn.pdns).map((p, i) => ({
        ...makePdn(i), ...p,
        erabs: p.erabs?.length ? p.erabs : [defaultErab(9)],
        slices: p.slices ?? [],
      })),
    },
    subscriber: {
      ...fresh.subscriber,
      ...(raw.subscriber ?? {}),
      ranges: (raw.subscriber?.ranges ?? fresh.subscriber.ranges).map((r, i) => ({ ...makeSubscriberRange(i), ...r })),
    },
    ims: {
      ...fresh.ims,
      ...(raw.ims ?? {}),
      emergencyNumbers: raw.ims?.emergencyNumbers ?? fresh.ims.emergencyNumbers,
    },
    settings: { ...fresh.settings, ...(raw.settings ?? {}) },
  };
}

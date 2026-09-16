// modules/coreNet/config/types.ts
//
// The Core network (ltemme / EPC + 5GC) configuration as a five-step form:
// Network · PDN · Subscribers · IMS & Voice · Settings.
//
// This is the *intermediate* object the operator edits. It is embedded as
// JSON in the header of the generated mme.cfg so the form reopens exactly,
// the same contract the UE-SIM wizard uses. generateMmeCfg.ts turns it into
// the Amarisoft keys, checked against the live mme.cfg on the lab callbox.

// ── 1. Network ───────────────────────────────────────────────────────────

/** Which core the box presents. Amarisoft's ltemme serves both; the choice
 *  drives which interworking and IMS-VoPS keys are emitted. */
export type CoreType = 'EPC' | '5GC' | 'Combined';

export type EpsInterworking = 'none' | 'with_n26' | 'without_n26';

export interface NetworkStepData {
  coreType: CoreType;
  /** 3 digits. */
  mcc: string;
  /** 2 or 3 digits. */
  mnc: string;
  /** Tracking area code. */
  tac: number;
  mmeGroupId: number;
  mmeCode: number;
  /** GTP-U bind address; also the default S1AP/NGAP bind. */
  gtpAddr: string;
  networkName: string;
  networkShortName: string;
  /** Dual connectivity with NR (EN-DC) advertised to the UE. */
  dcnrSupport: boolean;
  /** Control-plane CIoT EPS optimisation. */
  cpCiotOpt: boolean;
  epsInterworking: EpsInterworking;
  fifteenBearers: boolean;
  edrx: boolean;
  edrxCycleForced: number;
  /** Network slices the AMF advertises (5GC only). */
  nssai: Array<{ sst: number; sd: string }>;
}

// ── 2. PDN / APN ─────────────────────────────────────────────────────────

export type PdnType = 'ipv4' | 'ipv6' | 'ipv4v6' | 'non-ip';

export type PreemptionCapability = 'shall_not_trigger_pre_emption' | 'may_trigger_pre_emption';
export type PreemptionVulnerability = 'not_pre_emptable' | 'pre_emptable';

export interface Erab {
  /** LTE QCI, or the 5QI when the core serves 5GC. */
  qci: number;
  priorityLevel: number;
  preemptionCapability: PreemptionCapability;
  preemptionVulnerability: PreemptionVulnerability;
}

export interface PdnSlice {
  sst: number;
  sd: string;
  /** 5QI flows carried on this slice. */
  qosFlows: Erab[];
}

export interface PdnEntry {
  id: number;
  apn: string;
  pdnType: PdnType;
  /** Optional; when empty the first address of the pool is used. */
  gateway: string;
  firstIpAddr: string;
  lastIpAddr: string;
  /** Gap between consecutive allocated addresses. 0 = consecutive. */
  ipAddrShift: number;
  firstIpv6Prefix: string;
  lastIpv6Prefix: string;
  /** Comma-separated; IPv4 and IPv6 both allowed. */
  dnsAddr: string;
  /** Comma-separated P-CSCF addresses, for an IMS APN. */
  pCscfAddr: string;
  /** Marks the APN reachable for emergency (SOS) bearers. */
  emergency: boolean;
  erabs: Erab[];
  slices: PdnSlice[];
}

export interface PdnStepData {
  /** The first entry is the default APN, as Amarisoft documents it. */
  pdns: PdnEntry[];
  tunSetupScript: string;
}

// ── 3. Subscribers (ue_db) ───────────────────────────────────────────────

export type SimAlgorithm = 'xor' | 'milenage' | 'tuak';

export interface SubscriberRange {
  id: number;
  /** How many consecutive subscribers this range creates. */
  count: number;
  /** 15-digit IMSI of the first subscriber. */
  startingImsi: string;
  simAlgo: SimAlgorithm;
  /** 32 hex characters. */
  K: string;
  /** Added to K per subscriber; 0 = every subscriber shares K. */
  incrementK: number;
  opType: 'OP' | 'OPc' | 'none';
  opValue: string;
  /** Authentication management field, hex. */
  amf: string;
  sqn: string;
  /** Give each subscriber IMS identities (impi / impu / domain / pwd). */
  imsEnabled: boolean;
  /** Defaults to ims.mnc<MNC>.mcc<MCC>.3gppnetwork.org when empty. */
  imsDomain: string;
  imsPassword: string;
  /** E.164 number of the first subscriber; incremented per subscriber. */
  msisdnBase: string;
  /** Short dial number of the first subscriber; incremented per subscriber. */
  shortNumberBase: string;
}

export interface SubscriberStepData {
  ranges: SubscriberRange[];
  /** Write the database to its own file and `include` it, the way the lab
   *  config keeps 1000 subscribers out of mme.cfg. */
  separateFile: boolean;
  includeFilename: string;
}

// ── 4. IMS & Voice ───────────────────────────────────────────────────────

export interface EmergencyNumber {
  /** Service-category bitmap per 3GPP 24.008 table 10.5.135d. */
  category: number;
  digits: string;
}

export interface ImsStepData {
  enabled: boolean;
  /** The IMS server ltemme connects to. */
  imsAddr: string;
  bindAddr: string;
  /** IMS voice over PS advertised on EPS / 5GS-3GPP / 5GS-non-3GPP. */
  vopsEps: boolean;
  vops5gs: boolean;
  vops5gsN3gpp: boolean;
  /** Rx interface toward the P-CSCF for dedicated bearers. */
  rxEnabled: boolean;
  rxBindAddr: string;
  rxQciAudio: number;
  rxQciVideo: number;
  emergencyNumbers: EmergencyNumber[];
}

// ── 5. Settings ──────────────────────────────────────────────────────────

export type LogPreset = 'nas_s1ap_debug' | 'nas_debug' | 'debug' | 'info' | 'error' | 'disable';

export interface SettingsStepData {
  configName: string;
  description: string;
  logSettings: LogPreset;
  /** Empty = /tmp/<config name>.log. */
  logFilename: string;
  comPort: number;
  licenseServerAddr: string;
  licenseTag: string;
  /** NAS algorithm preference, most preferred first. EEA0/EIA0 are implicit. */
  nasCipherPref: number[];
  nasIntegPref: number[];
}

// ── Config ───────────────────────────────────────────────────────────────

export interface CoreConfig {
  version: 1;
  id: string;
  createdAt: string;
  modifiedAt: string;
  network: NetworkStepData;
  pdn: PdnStepData;
  subscriber: SubscriberStepData;
  ims: ImsStepData;
  settings: SettingsStepData;
}

export type StepKey = 'network' | 'pdn' | 'subscriber' | 'ims' | 'settings';

export const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'network', label: 'Network' },
  { key: 'pdn', label: 'PDN' },
  { key: 'subscriber', label: 'Subscribers' },
  { key: 'ims', label: 'IMS & Voice' },
  { key: 'settings', label: 'Settings' },
];

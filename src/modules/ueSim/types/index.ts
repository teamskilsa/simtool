// modules/ueSim/types/index.ts
//
// Type definitions for the UESim section. Six data shapes — one per tab —
// plus the assembly types (UeProfile, ApplyDiff) and the parsed-cfg shape.
//
// Naming: Cell, Subscriber, Traffic, UserPlane, Channel, Settings align with
// the six top-level tabs. Persisted Section File "type" discriminator uses
// "ueSim_<tabname>" prefix to keep them distinct from existing testConfig
// section types (which use unprefixed names like 'pdn', 'cell', etc).

// ────────────────────────────────────────────────────────────────────────────
// 1. Cell tab
// ────────────────────────────────────────────────────────────────────────────

export type CellGroupType = 'lte' | 'nr' | 'catm' | 'nbiot';

export interface CellSpec {
  /** Index into rf_driver devices (0..N-1). */
  rf_port: number;
  /** Channel bandwidth in MHz. */
  bandwidth: number;
  /** LTE only. */
  dl_earfcn?: number;
  /** NR only. */
  dl_nr_arfcn?: number;
  /** NB-IoT — override for SIB2-broadcast UL. */
  ul_earfcn?: number;
  ul_carrier_freq_offset?: number;
  /** 1, 2, 4 — DL antennas. */
  n_antenna_dl: number;
  /** 1 typically — LTE/NB-IoT support only 1. */
  n_antenna_ul: number;
  /** NR subcarrier spacing in kHz: 15/30/60/120. */
  scs?: number;
  /** NR SSB position bitmap, e.g. "10000000". */
  ssb_pos_bitmap?: string;
  /** TDD pattern (NR). */
  tdd_config?: number;
  /** Passthrough for unknown per-cell keys. Preserved on emit. */
  _extra?: Record<string, unknown>;
}

export interface CellGroupSpec {
  group_type: CellGroupType;
  multi_ue: boolean;
  multi_ue_type?: string;
  cpu_core_list?: number[];
  rel13_5?: boolean;
  pdcch_decode_opt?: boolean;
  pdcch_decode_opt_threshold?: number;
  cells: CellSpec[];
  _extra?: Record<string, unknown>;
}

export interface CustomBandSpec {
  band: number;
  dl_low: number;
  dl_high: number;
  ul_low: number;
  ul_high: number;
  dl_offset?: number;
  ul_offset?: number;
}

export interface CellSectionData {
  cell_groups: CellGroupSpec[];
  bands?: CustomBandSpec[];
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Subscriber tab
// ────────────────────────────────────────────────────────────────────────────

export type SimAlgorithm = 'xor' | 'milenage' | 'tuak';

export interface SubscriberEntry {
  /** Stable index, used by Traffic + Channel to cross-reference. */
  ue_id: number;
  imsi: string;
  K: string;
  opc?: string;
  amf?: string;
  sqn?: string;
  sim_algo: SimAlgorithm;
  ue_category: number;
  as_release: number;
  ext_sim?: boolean;
  sim_reader_index?: number;
  default_nssai?: Array<{ sst: number; sd?: string }>;
  _extra?: Record<string, unknown>;
}

export interface SubscriberDefaults {
  sim_algo: SimAlgorithm;
  ue_category: number;
  as_release: number;
  default_apn?: string;
  default_nssai?: Array<{ sst: number; sd?: string }>;
}

export interface SubscriberSectionData {
  ues: SubscriberEntry[];
  defaults: SubscriberDefaults;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Traffic tab
// ────────────────────────────────────────────────────────────────────────────

export type SimEventType =
  | 'power_on'
  | 'power_off'
  | 'pdn_connect'
  | 'pdn_disconnect'
  | 'ext_app'
  | 'flood'
  | 'http'
  | 'voice'
  | 'ping'
  | 'handover';

export interface SimEventBase {
  event: SimEventType;
  /** Time relative to template start, in seconds. */
  start_time: number;
  /**
   * IMPORTANT: When `duration` is set on a power_on event, the emitter
   * automatically generates a matching power_off at start_time + duration.
   * This is how the Traffic tab translates "UE active for 60s starting at
   * t=5s" into the two Amarisoft events that actually go in ue.cfg.
   */
  duration?: number;
  loop_count?: number;
  loop_delay?: number;
  _extra?: Record<string, unknown>;
}

export interface PowerEvent extends SimEventBase {
  event: 'power_on' | 'power_off';
}

export interface PdnEvent extends SimEventBase {
  event: 'pdn_connect' | 'pdn_disconnect';
  apn?: string;
  pdn_type?: 'ipv4' | 'ipv6' | 'ipv4v6';
}

export interface ExtAppEvent extends SimEventBase {
  event: 'ext_app';
  prog: string;
  args?: string[];
  tag?: string;
}

export interface FloodEvent extends SimEventBase {
  event: 'flood';
  direction: 'dl' | 'ul' | 'both';
  bitrate: string; // e.g. "150M"
  packet_size?: number;
}

export interface HttpEvent extends SimEventBase {
  event: 'http';
  url: string;
  method?: 'GET' | 'POST';
}

export interface VoiceEvent extends SimEventBase {
  event: 'voice';
  codec?: string;
}

export interface PingEvent extends SimEventBase {
  event: 'ping';
  destination: string;
  count?: number;
  interval?: number;
}

export interface HandoverEvent extends SimEventBase {
  event: 'handover';
  target_cell_id: number;
}

export type SimEvent =
  | PowerEvent
  | PdnEvent
  | ExtAppEvent
  | FloodEvent
  | HttpEvent
  | VoiceEvent
  | PingEvent
  | HandoverEvent;

export interface TrafficTemplate {
  id: string;
  name: string;
  description?: string;
  events: SimEvent[];
  builtIn?: boolean;
}

export type TrafficServerKind = 'ltesim_server' | 'iperf' | 'custom';

export interface TrafficServerConfig {
  ip: string;
  port: number;
  kind: TrafficServerKind;
}

export interface UeAssignment {
  ue_id: number;
  template_id: string;
  start_offset: number;
}

export interface TrafficSectionData {
  templates: TrafficTemplate[];
  assignments: UeAssignment[];
  server: TrafficServerConfig;
  default_address?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. User Plane tab
// ────────────────────────────────────────────────────────────────────────────

export type UserPlaneMode = 'sim' | 'tun' | 'remote';

export interface PdnEntry {
  apn: string;
  pdn_type: 'ipv4' | 'ipv6' | 'ipv4v6';
  default?: boolean;
}

export interface UserPlaneSectionData {
  mode: UserPlaneMode;
  tun_setup_script?: string;
  tun_interface_name?: string;
  rue_addr?: string;
  rue_protocol?: 'sctp' | 'tcp';
  pdn_list: PdnEntry[];
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Channel Modelling tab
// ────────────────────────────────────────────────────────────────────────────

export type ChannelType =
  | 'awgn'
  | 'rayleigh'
  | 'epa'
  | 'eva'
  | 'etu'
  | 'tdl_a'
  | 'tdl_b'
  | 'tdl_c'
  | 'custom';

export interface PerCellChannel {
  cell_index: number;
  dl_type: ChannelType;
  ul_type: ChannelType;
  doppler_hz?: number;
  noise_floor_dbm_hz?: number;
  ref_signal_power_dbm?: number;
  ul_power_attenuation_db?: number;
  /** Antenna position in metres on the visual map (relative to origin). */
  antenna_x?: number;
  antenna_y?: number;
  antenna_type?: 'isotropic' | 'dipole' | 'directional';
}

/**
 * Per-UE mobility entry. Position is x/y/z in metres from map origin.
 * The visual mapping component renders these as draggable dots.
 */
export interface UeMobility {
  ue_id: number;
  position: [number, number, number];
  /** Speed in km/h. 0 = static. */
  speed: number;
  /** Direction in degrees (0 = +x, 90 = +y). */
  direction: number;
  antenna_type?: 'isotropic' | 'dipole';
  /** Optional waypoint sequence overriding constant velocity. */
  waypoints?: Array<[number, number, number]>;
}

export interface ChannelSectionData {
  channel_sim: boolean;
  delay_sim: boolean;
  /** Map size in metres for the visual mapper. */
  map_extent_m: number;
  per_cell: PerCellChannel[];
  mobility: UeMobility[];
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Settings tab
// ────────────────────────────────────────────────────────────────────────────

export type LogLayer =
  | 'phy'
  | 'mac'
  | 'rlc'
  | 'pdcp'
  | 'rrc'
  | 'nas'
  | 'gtpu'
  | 'ip'
  | 'all';

export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

export interface LayerLogConfig {
  layer: LogLayer;
  level: LogLevel;
  max_size: number;
}

export interface RfDriverConfig {
  name: string;
  args?: string;
  sync?: 'internal' | 'gps' | 'external';
  rx_antenna?: 'rx' | 'tx';
  fifo_tx_time?: number;
  rx_latency?: number;
}

export interface SettingsSectionData {
  log_layers: LayerLogConfig[];
  log_filename: string;
  com_addr: string;
  com_auth?: boolean;
  com_password?: string;
  tx_gain: number;
  rx_gain: number;
  rf_driver: RfDriverConfig;
  cpu_core_list?: number[];
  pdcch_decode_opt?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Section File envelope
// ────────────────────────────────────────────────────────────────────────────

export type UeSimSectionType =
  | 'ueSim_cell'
  | 'ueSim_subscriber'
  | 'ueSim_traffic'
  | 'ueSim_userPlane'
  | 'ueSim_channel'
  | 'ueSim_settings';

export interface UeSimSectionFile<T = unknown> {
  id: string;
  name: string;
  type: UeSimSectionType;
  description?: string;
  data: T;
  builtIn?: boolean;
  createdAt: string;
  modifiedAt: string;
  sourceFile?: string;
}

export type CellSectionFile = UeSimSectionFile<CellSectionData>;
export type SubscriberSectionFile = UeSimSectionFile<SubscriberSectionData>;
export type TrafficSectionFile = UeSimSectionFile<TrafficSectionData>;
export type UserPlaneSectionFile = UeSimSectionFile<UserPlaneSectionData>;
export type ChannelSectionFile = UeSimSectionFile<ChannelSectionData>;
export type SettingsSectionFile = UeSimSectionFile<SettingsSectionData>;

// ────────────────────────────────────────────────────────────────────────────
// Profile
// ────────────────────────────────────────────────────────────────────────────

export interface UeProfile {
  id: string;
  name: string;
  description?: string;
  sectionIds: {
    cell: string;
    subscriber: string;
    traffic: string;
    userPlane: string;
    channel: string;
    settings: string;
  };
  createdAt: string;
  modifiedAt: string;
}

export interface MaterializedProfile {
  cell: CellSectionData;
  subscriber: SubscriberSectionData;
  traffic: TrafficSectionData;
  userPlane: UserPlaneSectionData;
  channel: ChannelSectionData;
  settings: SettingsSectionData;
}

// ────────────────────────────────────────────────────────────────────────────
// Parsed ue.cfg
// ────────────────────────────────────────────────────────────────────────────

export interface ParsedUeCfg {
  raw: Record<string, unknown>;
  warnings: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Apply diff
// ────────────────────────────────────────────────────────────────────────────

export type ChangeKind = 'hot' | 'cold';

export interface DiffEntry {
  section: keyof MaterializedProfile;
  path: string;
  before: unknown;
  after: unknown;
  kind: ChangeKind;
}

export interface ApplyDiff {
  entries: DiffEntry[];
  hasCold: boolean;
  hasHot: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Loader result
// ────────────────────────────────────────────────────────────────────────────

export interface LoaderResult {
  parsed: ParsedUeCfg;
  detected: {
    rat: 'lte' | 'nr' | 'mixed' | 'unknown';
    cell_groups: number;
    ue_count: number;
    channel_sim: boolean;
  };
  sections: MaterializedProfile;
}

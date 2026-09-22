// Detection types for Amarisoft software packages — produced by /api/systems/sw-inspect
// Consumed by InstallForm to show only options that actually exist in the tar.

export type TargetArch = 'linux' | 'aarch64' | 'unknown';

/** A component detected in the tar (e.g., lteenb, ltemme). */
export interface DetectedComponent {
  id: string;                    // enb, mme, ims, ue, ots, mbmsgw, sat, view, www, license, n3iwf, probe, scan, monitor, simserver
  label: string;                 // Human-readable name
  description?: string;
  arches: TargetArch[];          // Which arches have a tar for this component
  available: boolean;            // False means not in this tar (we still list for UI consistency)
  defaultOn: boolean;            // Whether to check by default when available
  subOf?: string;                // For sub-components like "ims" which is a sub of "mme"
}

/** A TRX frontend detected in the tar (e.g., sdr, ip, s72, n2x0 from trx_uhd). */
export interface DetectedTrx {
  id: string;                    // install.sh --trx value: sdr, ip, s72, n2x0, b2x0, x3x0, n3x0, lms
  label: string;                 // Display name
  arches: TargetArch[];
  packageName?: string;          // trx_<packageName> tarball it comes from
}

/** Result of scanning an Amarisoft tar archive. */
export interface DetectionResult {
  success: boolean;
  error?: string;
  version?: string;              // e.g. "2026-04-22"
  rootDir?: string;              // Top-level directory inside tar (e.g. "2026-04-22")
  installScript?: string;        // Path to install.sh inside tar
  components: DetectedComponent[];
  trxDrivers: DetectedTrx[];
  licenses: number;              // Count of license files in <root>/licenses/
  targetArch: TargetArch;        // Detected architecture of the target system
  /** What is installed/running on the target right now (null-ish when unreachable). */
  systemState?: SystemState;
  warning?: string;
}

// ── Current state of the target system ─────────────────────────────────────
// Produced by sw-inspect (SSH first, SimTool agent read route as fallback) so
// the install form can pre-select what the box already runs instead of the
// package's static defaults.

export type SystemStateSource = 'ssh' | 'agent' | 'none';

export interface SystemStateEvidence {
  key: string;        // what this proves, e.g. 'trx', 'autostart'
  source: string;     // file path or command
  detail: string;     // the key line(s)
  inferred?: boolean; // true when derived indirectly (heuristic)
}

export interface SystemComponentState {
  id: string;               // same ids as KNOWN_COMPONENTS
  installed: boolean | null; // null = could not tell
  active: boolean;          // listed in the LTE service (ots.cfg COMPONENTS)
  autostart?: boolean;      // <COMP>_AUTOSTART
  version?: string;
}

export interface SystemLicenseFile {
  path: string;
  productId?: string;
  productIds?: string;
  licenseUid?: string;
  hostId?: string;
  /** `version=` in the key: newest software release date the key allows. */
  maxVersion?: string;
}

export interface ActiveConfigState {
  component: string;               // ENB / MME / IMS / UE / OTS
  path: string;                    // absolute path of the config the service loads
  isSymlink: boolean | null;       // null = unknown
  symlinkInferred?: boolean;       // decided from stat heuristics, not lstat
  /** What install.sh's MigrateConfig will do with it. */
  migration: 'kept' | 'backup-only' | 'not-migrated' | 'unknown';
}

export interface SystemStateWarning {
  level: 'info' | 'warn' | 'danger';
  text: string;
}

export interface SystemState {
  ok: boolean;
  via: SystemStateSource;
  error?: string;
  hostname?: string;
  hostId?: string;
  arch: TargetArch;
  installDir: string;
  installedVersion?: string;
  components: SystemComponentState[];
  /** rf_driver.name of the config the eNB actually loads. */
  rfDriver?: string;
  sdrBoards: number;              // PCI functions bound to / identifying the Amarisoft `sdr` driver
  uhdPresent: boolean | null;     // any sign of Ettus UHD host software / devices
  /** TRX frontend id (install.sh --trx value) matching the hardware. */
  recommendedTrx?: string;
  nAntennaDl?: number;
  nAntennaUl?: number;
  mimo?: boolean;
  autostart: boolean | null;
  nat: boolean | null;
  ipv6: boolean | null;
  ipv6Nat: boolean | null;
  licenseDir?: string;
  licenses: SystemLicenseFile[];
  activeConfigs: ActiveConfigState[];
  warnings: SystemStateWarning[];
  evidence: SystemStateEvidence[];
}

// ── Component metadata (shared between detection + UI) ─────────────────────
export interface ComponentMeta {
  id: string;
  label: string;
  description: string;
  defaultOn: boolean;
  // Regex to match the component's tar file (captures arch if present)
  pattern: RegExp;
  subOf?: string;
}

export const KNOWN_COMPONENTS: ComponentMeta[] = [
  // Required base
  { id: 'enb',      label: 'eNB / gNB',       description: 'LTE eNodeB / 5G gNB base station', defaultOn: true,  pattern: /^lteenb(-(linux|aarch64))?-/ },
  { id: 'mme',      label: 'MME / EPC',       description: 'Core: MME + HSS',                 defaultOn: true,  pattern: /^ltemme(-(linux|aarch64))?-/ },
  { id: 'ims',      label: 'IMS',             description: 'IMS for VoLTE/VoNR (needs MME)',  defaultOn: true,  pattern: /^ltemme(-(linux|aarch64))?-/, subOf: 'mme' },
  { id: 'simserver',label: 'SIM Server',      description: 'Virtual SIM server',              defaultOn: false, pattern: /^ltemme(-(linux|aarch64))?-/, subOf: 'mme' },
  { id: 'ue',       label: 'UE Simulator',    description: 'UE emulation for testing',        defaultOn: false, pattern: /^lteue(-(linux|aarch64))?-/ },
  { id: 'mbmsgw',   label: 'MBMS Gateway',    description: 'Multicast/broadcast gateway',     defaultOn: false, pattern: /^ltembmsgw(-(linux|aarch64))?-/ },
  { id: 'n3iwf',    label: 'N3IWF',           description: 'Non-3GPP Interworking Function',  defaultOn: false, pattern: /^lten3iwf(-(linux|aarch64))?-/ },
  { id: 'sat',      label: 'Satellite',       description: 'NTN / satellite utilities',       defaultOn: false, pattern: /^ltesat(-(linux|aarch64))?-/ },
  { id: 'probe',    label: 'Probe',           description: 'Traffic probe',                   defaultOn: false, pattern: /^lteprobe(-(linux|aarch64))?-/ },
  { id: 'scan',     label: 'Scanner',         description: 'Frequency scanner',               defaultOn: false, pattern: /^ltescan(-(linux|aarch64))?-/ },
  { id: 'monitor',  label: 'Monitor',         description: 'Monitoring system',               defaultOn: false, pattern: /^ltemonitor(-(linux|aarch64))?-/ },
  { id: 'ots',      label: 'LTE Auto Service',description: 'Systemd service wrapper',         defaultOn: true,  pattern: /^lteots(-(linux|aarch64))?-/ },
  // lteview is Amarisoft's receive-only signal analyzer (spectrum, constellation,
  // EVM on a captured DL signal), not a web UI. It needs its own SDR, so it
  // stays off by default on a callbox whose boards all run cells.
  { id: 'view',     label: 'Signal Analyzer (lteview)', description: 'RF analyzer: spectrum, constellation, EVM', defaultOn: false, pattern: /^lteview(-(linux|aarch64))?-/ },
  { id: 'www',      label: 'Web Interface',   description: 'Apache + PHP web management',     defaultOn: true,  pattern: /^ltewww-/ },
  { id: 'license',  label: 'License Server',  description: 'Local license server',            defaultOn: false, pattern: /^ltelicense(-(linux|aarch64))?-/ },
];

// TRX drivers — detected via trx_<name>-<arch>-<version>.tar.gz
//
// `id` is what we pass to `install.sh --trx`, which validates it against
// TRX_FE: the union of every package's `fe_list` file (or the package name
// when there is none). Some packages expose several frontends and NOT their
// own name — trx_uhd's fe_list is "n2x0 b2x0 x3x0 n3x0", so `--trx uhd` makes
// install.sh exit 1 ("TRX driver uhd not found"). `frontends` encodes that.
// trx_example is skipped by install.sh entirely, so it is not offered.
export const KNOWN_TRX: Array<{ id: string; label: string; frontends?: Array<{ id: string; label: string }>; notInstallable?: boolean }> = [
  { id: 'sdr',     label: 'Amarisoft SDR PCIe (trx_sdr)' },
  { id: 'ip',      label: 'IP (trx_ip)' },
  { id: 's72',     label: 'Split 7.2 (DU)' },
  { id: 'uhd',     label: 'Ettus UHD', frontends: [
    // From trx_uhd-2026-09-11/fe_list
    { id: 'n2x0', label: 'Ettus USRP N200/N210 (trx_uhd)' },
    { id: 'b2x0', label: 'Ettus USRP B200/B210 (trx_uhd)' },
    { id: 'x3x0', label: 'Ettus USRP X300/X310 (trx_uhd)' },
    { id: 'n3x0', label: 'Ettus USRP N300/N310 (trx_uhd)' },
  ] },
  { id: 'lms',     label: 'LimeSDR (LMS)' },
  { id: 'n2x0',    label: 'Ettus USRP N200/N210' },
  { id: 'b2x0',    label: 'Ettus USRP B200/B210' },
  { id: 'x3x0',    label: 'Ettus USRP X300/X310' },
  { id: 'example', label: 'Example driver', notInstallable: true },
];

/** eNB rf_driver.name → install.sh --trx frontend id. */
export function trxIdForRfDriver(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase();
  if (n === 'sdr' || n === 'ip' || n === 's72' || n === 'lms') return n;
  // trx_uhd configs use name "uhd"; the frontend is not recoverable from
  // the name alone, so callers fall back to hardware hints.
  return undefined;
}

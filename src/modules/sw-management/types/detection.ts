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

/** A TRX driver detected in the tar (e.g., trx_sdr, trx_ip, trx_s72). */
export interface DetectedTrx {
  id: string;                    // sdr, ip, s72, uhd, lms, example
  label: string;                 // Display name
  arches: TargetArch[];
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
  { id: 'view',     label: 'Web View',        description: 'Web UI for eNB',                  defaultOn: true,  pattern: /^lteview(-(linux|aarch64))?-/ },
  { id: 'www',      label: 'Web Interface',   description: 'Apache + PHP web management',     defaultOn: true,  pattern: /^ltewww-/ },
  { id: 'license',  label: 'License Server',  description: 'Local license server',            defaultOn: false, pattern: /^ltelicense(-(linux|aarch64))?-/ },
];

// TRX drivers — detected via trx_<name>-<arch>-<version>.tar.gz
export const KNOWN_TRX: Array<{ id: string; label: string }> = [
  { id: 'sdr',     label: 'SDR (generic, default)' },
  { id: 'ip',      label: 'IP (trx_ip)' },
  { id: 's72',     label: 'Split 7.2 (DU)' },
  { id: 'uhd',     label: 'Ettus UHD' },
  { id: 'lms',     label: 'LimeSDR (LMS)' },
  { id: 'n2x0',    label: 'Ettus USRP N200/N210' },
  { id: 'b2x0',    label: 'Ettus USRP B200/B210' },
  { id: 'x3x0',    label: 'Ettus USRP X300/X310' },
  { id: 'example', label: 'Example driver' },
];

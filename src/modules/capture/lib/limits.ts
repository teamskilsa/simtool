// Size limits and estimates for captures. Pure — imported by both the API
// routes and the Capture tab, so the numbers the UI warns with are the same
// numbers the server enforces.

export const GiB = 1024 ** 3;
export const MiB = 1024 ** 2;

/** lteenb `trx_iq_dump`: "duration … default = 1s, max = 30s" (ms). */
export const IQ_MAX_DURATION_MS = 30_000;
export const IQ_MIN_DURATION_MS = 1;
/** Each IQ sample is two little-endian float32s (I then Q). */
export const IQ_BYTES_PER_SAMPLE = 8;

/** Hard cap on one IQ capture (all files, RX+TX, all antennas). Past this the
 *  server refuses to start the dump, and refuses to fetch if the real files
 *  turn out bigger than the estimate. 30.72 Msps × 8 B × 2 antennas is
 *  ~490 MiB per second, so this allows ~8 s of 2x2 20 MHz LTE. */
export const IQ_MAX_TOTAL_BYTES = 4 * GiB;
/** Above this the UI warns and the job waits for an explicit Fetch instead of
 *  pulling the files automatically. */
export const IQ_WARN_BYTES = 1 * GiB;
/** Headroom kept free on the SimTool host after a fetch. */
export const HOST_DISK_RESERVE_BYTES = 1 * GiB;
/** Headroom required on the callbox's /tmp (often tmpfs, i.e. RAM) on top of
 *  the estimated dump size. */
export const BOX_TMP_MARGIN = 1.1;

/** Log capture: duration and file size caps. */
export const LOG_MAX_DURATION_SEC = 3600;
export const LOG_MAX_BYTES = 512 * MiB;
/** Protocol pcap (tcpdump on the box): duration and file size caps. */
export const PCAP_MAX_DURATION_SEC = 3600;
export const PCAP_MAX_BYTES = 2 * GiB;

/** Amarisoft picks a sample rate that is 1.92 Msps × 2^k and comfortably
 *  covers the occupied bandwidth. 1.25 × occupied BW reproduces the usual
 *  choices (6 RB → 1.92, 25 → 7.68, 50 → 15.36, 100 → 30.72 Msps; NR 273 RB
 *  at 30 kHz → 122.88 Msps). It is only an estimate — the real rate comes
 *  back in the trx_iq_dump response and is what the manifest records. */
export function estimateSampleRate(nRb: number, scsHz: number): number {
  if (!(nRb > 0) || !(scsHz > 0)) return 30.72e6;
  const occupied = nRb * 12 * scsHz;
  const k = Math.max(0, Math.ceil(Math.log2((occupied * 1.25) / 1.92e6)));
  return 1.92e6 * 2 ** k;
}

export function iqBytes(sampleRate: number, channels: number, durationMs: number): number {
  return Math.ceil((sampleRate * durationMs) / 1000) * IQ_BYTES_PER_SAMPLE * Math.max(0, channels);
}

/** Longest duration (ms) that keeps an IQ capture under IQ_MAX_TOTAL_BYTES. */
export function iqMaxDurationMs(sampleRate: number, channels: number): number {
  const perMs = (sampleRate / 1000) * IQ_BYTES_PER_SAMPLE * Math.max(1, channels);
  return Math.max(IQ_MIN_DURATION_MS, Math.min(IQ_MAX_DURATION_MS, Math.floor(IQ_MAX_TOTAL_BYTES / perMs)));
}

/** Estimated size of an IQ capture for the chosen RF ports and directions,
 *  and the longest duration that stays under IQ_MAX_TOTAL_BYTES. */
export function iqEstimate(
  ports: { port: number; sampleRate: number; rxChannels: unknown[]; txChannels: unknown[] }[],
  rfPorts: number[], directions: ('rx' | 'tx')[], durationMs: number,
) {
  let bytes = 0, channels = 0, perMs = 0;
  for (const p of ports.filter(x => rfPorts.includes(x.port))) {
    const ch = (directions.includes('rx') ? p.rxChannels.length : 0) + (directions.includes('tx') ? p.txChannels.length : 0);
    channels += ch;
    bytes += iqBytes(p.sampleRate, ch, durationMs);
    perMs += (p.sampleRate / 1000) * IQ_BYTES_PER_SAMPLE * ch;
  }
  const maxDurationMs = perMs > 0 ? Math.max(IQ_MIN_DURATION_MS, Math.min(IQ_MAX_DURATION_MS, Math.floor(IQ_MAX_TOTAL_BYTES / perMs))) : IQ_MAX_DURATION_MS;
  return { bytes, channels, maxDurationMs };
}

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= GiB) return `${(n / GiB).toFixed(2)} GiB`;
  if (n >= MiB) return `${(n / MiB).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

export function fmtHz(hz: number): string {
  const a = Math.abs(hz);
  // Carriers read in MHz with kHz precision (1748.750 MHz, not 1.7487 GHz).
  if (a >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (a >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}

/** Log layers the remote API accepts per component (from the 2026-09-11 docs:
 *  lteenb/ltemme/lteue "Available layers are: …"). */
export const LOG_LAYERS: Record<'enb' | 'mme' | 'ue', string[]> = {
  enb: ['phy', 'mac', 'rlc', 'pdcp', 'rrc', 'nas', 's1ap', 'ngap', 'x2ap', 'xnap', 'm2ap', 'lppa', 'nrppa', 'gtpu'],
  mme: ['nas', 'ip', 's1ap', 'ngap', 'gtpu', 'rx', 's6', 'cx', 's13', 'sgsap', 'sbcap', 'lcsap', 'lppa', 'n12', 'n13', 'n8',
    'n17', 'n50', 'n5', 'nl1', 'nrppa', 'epdg', 'ikev2', 'ipsec', 'n20', 'n62'],
  ue: ['phy', 'mac', 'rlc', 'pdcp', 'rrc', 'nas', 'ip', 'ikev2', 'swu', 'nwu', 'ipsec', 'lpp'],
};
export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
export type LogLevel = typeof LOG_LEVELS[number];
export const DEFAULT_API_PORT: Record<'enb' | 'mme' | 'ue', number> = { enb: 9001, mme: 9000, ue: 9002 };

/** tcpdump filters offered for the protocol pcap. Fixed strings — the user
 *  picks a key, never types a filter, so nothing free-form reaches the shell. */
export const PCAP_FILTERS: Record<string, { label: string; filter: string; hint: string }> = {
  control: { label: 'S1AP / NGAP / X2AP / XnAP (SCTP)', filter: 'sctp', hint: 'Signalling between eNB/gNB and core' },
  gtpu: { label: 'GTP-U user plane', filter: 'udp port 2152', hint: 'Grows fast under traffic' },
  core: { label: 'SCTP + GTP-U + GTP-C + SIP', filter: 'sctp or udp port 2152 or udp port 2123 or port 5060', hint: 'Everything the core speaks' },
  all: { label: 'Everything except SSH', filter: 'not port 22', hint: 'Includes the remote API websockets — large' },
};

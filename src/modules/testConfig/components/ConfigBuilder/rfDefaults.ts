// Mode-specific defaults for the RF driver. Used to:
//   - seed `rf_driver.args` when the user switches RF mode
//   - bump TX/RX gain when antenna count changes
//   - drive the per-mode hint text in the RF section
//
// Values are based on what Amarisoft ships in the default sample configs.

export type RfMode = 'sdr' | 'split' | 'ip';

/**
 * Default `rf_driver.args` for a given mode + antenna count.
 *
 * SDR:    one /dev/sdrN per pair of antennas per cell (an Amarisoft SDR board is
 *         2T2R): 1-2 ant → 1 device per cell, 4 ant → 2. E.g. 6 cells × 4x4 → dev0..dev11.
 * Split:  O-RAN 7.2 fronthaul defaults (VLAN 10, BFP IQ 9-bit compression)
 * IP:     ZMQ socket pair on localhost (sample/test setup)
 */
export function defaultRfArgs(mode: RfMode, nAntennaDl: number, nCells = 1): string {
  if (mode === 'sdr') {
    const n = sdrDeviceCount(nAntennaDl, nCells);
    return Array.from({ length: n }, (_, i) => `dev${i}=/dev/sdr${i}`).join(',');
  }
  if (mode === 'split') {
    // ORAN 7.2 fronthaul — typical defaults for a single-cell DU testbed.
    return 'vlan_tagging=1,vlan_id=10,if_name=eth0,bfp_iq_width=9';
  }
  if (mode === 'ip') {
    // ZMQ-style IP RF — TX/RX pair on localhost (commonly used with srsRAN UEs).
    // use_tcp=0 (UDP) + multi_thread=0 are the values verified working with
    // the typical eNB-first / UE-sim-second startup order. The trx_ip block
    // emitted from these args sets dst<N>/src<N> per port.
    return 'tx_addr=tcp://127.0.0.1:2000,rx_addr=tcp://127.0.0.1:2001,use_tcp=0,multi_thread=0';
  }
  return '';
}

/** SDR boards needed: each board carries 2 channels, one rf_port per cell. */
export function sdrDeviceCount(nAntenna: number, nCells = 1): number {
  return Math.max(1, nCells) * Math.max(1, Math.ceil((Number(nAntenna) || 1) / 2));
}

/**
 * Default TX/RX gain. Unified 90/60 across NR and LTE per user spec; higher
 * antenna counts get a small bump since the per-element budget shrinks.
 */
export function defaultGains(_rat: 'nr' | 'lte', nAntennaDl: number): { txGain: number; rxGain: number } {
  // +0 dB at 1 ant, +5 dB at 2, +10 dB at 4+
  const bump = nAntennaDl >= 4 ? 10 : nAntennaDl >= 2 ? 5 : 0;
  return { txGain: 90 + bump, rxGain: 60 + bump };
}

/** Build a per-antenna gain array of length n with all entries = scalar. */
export function gainArrayFromScalar(scalar: number, n: number): number[] {
  return Array.from({ length: n }, () => scalar);
}

/** Reduce a gain (scalar | array) to a single representative scalar. */
export function gainAsScalar(g: number | number[]): number {
  return Array.isArray(g) ? (g[0] ?? 0) : g;
}

/**
 * Format a gain value for emission into Amarisoft cfg.
 *   number     →  "90"
 *   number[]   →  "[90, 90, 90, 90]"
 * Either form is accepted by the lteenb / lteue / ltemme parsers.
 */
export function formatGain(g: number | number[]): string {
  if (Array.isArray(g)) return `[${g.map(v => String(v)).join(', ')}]`;
  return String(g);
}

/** UI hint shown below the args input — explains what the field expects. */
export function rfArgsHint(mode: RfMode): string {
  switch (mode) {
    case 'sdr':
      return 'SDR device path. Format: dev0=/dev/sdrN[,dev1=/dev/sdrN]. Use one device per 2 antennas per cell (1-2 ant → dev0; 4 ant → dev0+dev1; 6 cells × 4 ant → dev0..dev11).';
    case 'split':
      return 'O-RAN 7.2 fronthaul. Common opts: vlan_id (DU↔O-RU VLAN), if_name (NIC), bfp_iq_width (IQ compression bits, typ. 9), c_plane_dst_mac, u_plane_dst_mac.';
    case 'ip':
      return 'IP / ZMQ RF. tx_addr / rx_addr as tcp://HOST:PORT. Each must be reachable from the peer (UE or RU).';
    default:
      return '';
  }
}

// ─── rf_driver.args parsing ──────────────────────────────────────────────────
// Amarisoft's rf_driver.args is a comma-delimited "key=value" string. To let
// users edit individual fields (e.g. VLAN ID for Split 7.2) without managing
// the raw string, we parse to a map and re-serialise on every change.

/** Parse "k1=v1,k2=v2" into { k1: 'v1', k2: 'v2' }. Whitespace tolerant. */
export function parseRfArgs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const part of s.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

/** Serialise a map back to the args string. Empty values are dropped. */
export function serializeRfArgs(o: Record<string, string>): string {
  return Object.entries(o)
    .filter(([k, v]) => k && v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

/** Update a single key inside the rfArgs string and return the new string. */
export function setRfArg(rfArgs: string, key: string, value: string): string {
  const map = parseRfArgs(rfArgs);
  if (value === '' || value === undefined || value === null) {
    delete map[key];
  } else {
    map[key] = String(value);
  }
  return serializeRfArgs(map);
}

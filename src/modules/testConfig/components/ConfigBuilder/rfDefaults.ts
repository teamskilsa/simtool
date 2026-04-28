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
 * SDR:    one /dev/sdrN per pair of antennas (1-2 ant → 1 device, 4 ant → 2)
 * Split:  O-RAN 7.2 fronthaul defaults (VLAN 10, BFP IQ 9-bit compression)
 * IP:     ZMQ socket pair on localhost (sample/test setup)
 */
export function defaultRfArgs(mode: RfMode, nAntennaDl: number): string {
  if (mode === 'sdr') {
    return nAntennaDl >= 4 ? 'dev0=/dev/sdr0,dev1=/dev/sdr1' : 'dev0=/dev/sdr0';
  }
  if (mode === 'split') {
    // ORAN 7.2 fronthaul — typical defaults for a single-cell DU testbed.
    return 'vlan_tagging=1,vlan_id=10,if_name=eth0,bfp_iq_width=9';
  }
  if (mode === 'ip') {
    // ZMQ-style IP RF — TX/RX pair on localhost (commonly used with srsRAN UEs)
    return 'tx_addr=tcp://127.0.0.1:2000,rx_addr=tcp://127.0.0.1:2001';
  }
  return '';
}

/**
 * Default TX/RX gain for a given RAT + antenna count.
 *
 * Higher antenna counts get a small gain bump (more elements split the EIRP)
 * and NR generally sits 5–10 dB higher than LTE on the same setup. These
 * are sane starting points; users tune for their specific RU/SDR.
 */
export function defaultGains(rat: 'nr' | 'lte', nAntennaDl: number): { txGain: number; rxGain: number } {
  const baseTx = rat === 'nr' ? 90 : 80;
  const baseRx = rat === 'nr' ? 60 : 40;
  // +0 dB at 1 ant, +5 dB at 2, +10 dB at 4+
  const bump = nAntennaDl >= 4 ? 10 : nAntennaDl >= 2 ? 5 : 0;
  return { txGain: baseTx + bump, rxGain: baseRx + bump };
}

/** UI hint shown below the args input — explains what the field expects. */
export function rfArgsHint(mode: RfMode): string {
  switch (mode) {
    case 'sdr':
      return 'SDR device path. Format: dev0=/dev/sdrN[,dev1=/dev/sdrN]. Use one device per 2 antennas (1-2 ant → dev0; 4 ant → dev0+dev1).';
    case 'split':
      return 'O-RAN 7.2 fronthaul. Common opts: vlan_id (DU↔O-RU VLAN), if_name (NIC), bfp_iq_width (IQ compression bits, typ. 9), c_plane_dst_mac, u_plane_dst_mac.';
    case 'ip':
      return 'IP / ZMQ RF. tx_addr / rx_addr as tcp://HOST:PORT. Each must be reachable from the peer (UE or RU).';
    default:
      return '';
  }
}

// Canned lteenb config_get for Capture QA: an LTE B3 2x2 cell on RF port 0
// and an NR n78 40 MHz 2x2 cell on RF port 1. Shape follows the 2026-09-11
// remote API docs (cells / nr_cells / rx_channels / tx_channels / rf_ports).
export const mockConfigGet: any = {
  message: 'config_get',
  type: 'ENB',
  name: 'mock-enb',
  version: '2026-06-12',
  logs: {
    layers: {
      phy: { level: 'warn', max_size: 1 }, mac: { level: 'warn' }, rrc: { level: 'info', max_size: 1 },
      s1ap: { level: 'info' }, nas: { level: 'info' }, ngap: { level: 'info' },
    },
    count: 8192,
    bcch: false,
    mib: false,
  },
  cells: {
    '1': { n_antenna_dl: 2, n_antenna_ul: 2, rf_port: 0, label: 'LTE B3', band: 3, n_id_cell: 1, n_rb_dl: 100, n_rb_ul: 100, dl_earfcn: 1575, ul_earfcn: 19575, dl_freq: 1842500000, ul_freq: 1747500000, mode: 'FDD' },
  },
  nr_cells: {
    '2': { n_antenna_dl: 2, n_antenna_ul: 2, rf_port: 1, band: 78, n_id_nrcell: 500, n_rb_dl: 106, n_rb_ul: 106, dl_nr_arfcn: 632628, ul_nr_arfcn: 632628, dl_mu: 1, ul_mu: 1, mode: 'TDD' },
  },
  rx_channels: [
    { gain: 60, freq: 1747.5, port: 0 }, { gain: 60, freq: 1747.5, port: 0 },
    { gain: 60, freq: 3489.42, port: 1 }, { gain: 60, freq: 3489.42, port: 1 },
  ],
  tx_channels: [
    { gain: 70, freq: 1842.5, port: 0 }, { gain: 70, freq: 1842.5, port: 0 },
    { gain: 70, freq: 3489.42, port: 1 }, { gain: 70, freq: 3489.42, port: 1 },
  ],
  rf_ports: [{ sample_rate: 30720000 }],
};

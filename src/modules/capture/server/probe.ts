// What can be captured on a component: RF ports with their cells and channel
// counts (for IQ), and the current log levels (for log capture), all from
// `config_get`.
import { estimateSampleRate } from '../lib/limits';
import { remoteApiOnce } from './remoteApi';
import type { IqCellInfo } from './store';

export interface RfPortInfo {
  port: number;
  cells: IqCellInfo[];
  rxChannels: { index: number; freqHz?: number }[];
  txChannels: { index: number; freqHz?: number }[];
  sampleRate: number;
  sampleRateSource: 'config_get' | 'estimate';
}

export interface ProbeResult {
  type: string;
  name?: string;
  version?: string;
  ports: RfPortInfo[];
  logLayers: Record<string, string>;
  logsLocked: boolean;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Pure mapping so the QA script can check it against canned responses. */
export function portsFromConfig(cfg: any): RfPortInfo[] {
  const cells: IqCellInfo[] = [];
  const add = (obj: any, rat: IqCellInfo['rat']) => {
    for (const [id, c] of Object.entries<any>(obj ?? {})) {
      const rfPort = num(c?.rf_port) ?? 0;
      cells.push({
        id: String(id), rat, label: typeof c?.label === 'string' ? c.label : undefined, band: num(c?.band),
        pci: num(c?.n_id_cell) ?? num(c?.n_id_nrcell) ?? num(c?.n_id_ncell), rfPort,
        dlFreqHz: num(c?.dl_freq), ulFreqHz: num(c?.ul_freq), nRbDl: num(c?.n_rb_dl),
        nAntennaDl: num(c?.n_antenna_dl), nAntennaUl: num(c?.n_antenna_ul),
      });
    }
  };
  add(cfg?.cells, 'lte');
  add(cfg?.nr_cells, 'nr');
  add(cfg?.nb_cells, 'nbiot');

  const nrMu = new Map<string, number>();
  for (const [id, c] of Object.entries<any>(cfg?.nr_cells ?? {})) nrMu.set(String(id), num(c?.dl_mu) ?? 1);

  const rxRaw: any[] = Array.isArray(cfg?.rx_channels) ? cfg.rx_channels : [];
  const txRaw: any[] = Array.isArray(cfg?.tx_channels) ? cfg.tx_channels : [];
  const rfPortsRaw: any[] = Array.isArray(cfg?.rf_ports) ? cfg.rf_ports : [];

  const portIds = new Set<number>(cells.map(c => c.rfPort));
  rxRaw.forEach(ch => { if (num(ch?.port) !== undefined) portIds.add(ch.port); });
  txRaw.forEach(ch => { if (num(ch?.port) !== undefined) portIds.add(ch.port); });

  // Channels without a port field: assign in port order by antenna count.
  const antennas = (p: number, dir: 'dl' | 'ul') =>
    Math.max(1, ...cells.filter(c => c.rfPort === p).map(c => (dir === 'dl' ? c.nAntennaDl : c.nAntennaUl) ?? 1));
  const channelsFor = (raw: any[], p: number, dir: 'dl' | 'ul') => {
    if (raw.some(ch => num(ch?.port) !== undefined)) {
      return raw.map((ch, index) => ({ ch, index })).filter(x => x.ch?.port === p)
        .map(x => ({ index: x.index, freqHz: num(x.ch?.freq) !== undefined ? x.ch.freq * 1e6 : undefined }));
    }
    let start = 0;
    for (const q of [...portIds].sort((a, b) => a - b)) {
      if (q === p) break;
      start += antennas(q, dir);
    }
    return Array.from({ length: antennas(p, dir) }, (_, i) => {
      const ch = raw[start + i];
      return { index: start + i, freqHz: num(ch?.freq) !== undefined ? ch.freq * 1e6 : undefined };
    });
  };

  return [...portIds].sort((a, b) => a - b).map(port => {
    const onPort = cells.filter(c => c.rfPort === port);
    const configured = num(rfPortsRaw[port]?.sample_rate);
    const estimate = Math.max(30.72e6 / 16, ...onPort.map(c =>
      estimateSampleRate(c.nRbDl ?? (c.rat === 'nbiot' ? 1 : 100), c.rat === 'nr' ? 15e3 * 2 ** (nrMu.get(c.id) ?? 1) : c.rat === 'nbiot' ? 180e3 / 12 : 15e3)));
    return {
      port,
      cells: onPort,
      // RX channels carry the UL frequency, TX the DL.
      rxChannels: channelsFor(rxRaw, port, 'ul'),
      txChannels: channelsFor(txRaw, port, 'dl'),
      sampleRate: configured ?? estimate,
      sampleRateSource: configured ? 'config_get' : 'estimate',
    };
  });
}

export function logLevelsFromConfig(cfg: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [layer, v] of Object.entries<any>(cfg?.logs?.layers ?? {})) {
    if (typeof v?.level === 'string') out[layer] = v.level;
  }
  return out;
}

export async function probe(host: string, port: number): Promise<ProbeResult> {
  const cfg = await remoteApiOnce<any>(host, port, { message: 'config_get' }, 6000);
  return {
    type: String(cfg.type ?? '?'),
    name: typeof cfg.name === 'string' ? cfg.name : undefined,
    version: typeof cfg.version === 'string' ? cfg.version : undefined,
    ports: cfg.type === 'MME' ? [] : portsFromConfig(cfg),
    logLayers: logLevelsFromConfig(cfg),
    logsLocked: !!cfg?.logs?.locked,
  };
}

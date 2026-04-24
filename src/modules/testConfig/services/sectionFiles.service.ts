// Section Files — reusable pieces of Amarisoft configuration that can be loaded
// into or saved from the visual builder. Stored client-side in localStorage so
// they persist across sessions without requiring backend work.
//
// Types of section files:
//   - pdn      → PDN / APN list
//   - uedb     → UE Database entries
//   - general  → MME/AMF network settings (PLMN, TAC, addresses, security)
//   - cell     → Cell identity (cellId, PCI, DMRS, SSB)
//   - band     → Band + frequency settings
//   - rf       → RF driver, antennas, gains
//   - log      → Logging configuration

import type { PdnEntry, UeDbEntry } from '../components/ConfigBuilder/constants';

export type SectionType = 'pdn' | 'uedb' | 'general' | 'cell' | 'band' | 'rf' | 'log';

export interface SectionFile {
  id: string;
  name: string;
  type: SectionType;
  description?: string;
  data: any;
  builtIn?: boolean;  // true = shipped template, false = user-saved
  createdAt: string;
  modifiedAt: string;
}

const STORAGE_KEY = 'simtool_section_files_v1';

// ── Built-in templates shipped with the app ─────────────────────────────────
const BUILT_IN: SectionFile[] = [
  {
    id: 'builtin-pdn-1apn',
    name: '1 APN (internet)',
    type: 'pdn',
    description: 'Single APN with IPv4',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: [
      { pdn_type: 'ipv4', access_point_name: 'internet', first_ip_addr: '192.168.2.2', last_ip_addr: '192.168.2.254', dns_addr: '8.8.8.8' },
    ] as PdnEntry[],
  },
  {
    id: 'builtin-pdn-internet-ims',
    name: 'Internet + IMS',
    type: 'pdn',
    description: 'Internet APN + IMS APN for VoLTE/VoNR',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: [
      { pdn_type: 'ipv4', access_point_name: 'internet', first_ip_addr: '192.168.2.2', last_ip_addr: '192.168.2.254', dns_addr: '8.8.8.8' },
      { pdn_type: 'ipv4v6', access_point_name: 'ims', first_ip_addr: '192.168.3.2', last_ip_addr: '192.168.3.254', ims_vops: true },
    ] as PdnEntry[],
  },
  {
    id: 'builtin-pdn-multislice',
    name: 'Multi-Slice (Internet + IoT)',
    type: 'pdn',
    description: 'Two slices with different NSSAI',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: [
      { pdn_type: 'ipv4', access_point_name: 'internet', first_ip_addr: '192.168.2.2', last_ip_addr: '192.168.2.254' },
      { pdn_type: 'ipv4', access_point_name: 'iot', first_ip_addr: '192.168.4.2', last_ip_addr: '192.168.4.254' },
    ] as PdnEntry[],
  },
  {
    id: 'builtin-uedb-single',
    name: 'Single UE',
    type: 'uedb',
    description: 'Default single UE with milenage',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: [
      { sim_algo: 'milenage', imsi: '001010000000001', K: '00112233445566778899aabbccddeeff', opc: '63bfa50ee6523365ff14c1f45f88737d', amf: 0x9001, sqn: '000000000000', nb_ue: 1 },
    ] as UeDbEntry[],
  },
  {
    id: 'builtin-uedb-100',
    name: '100 UEs',
    type: 'uedb',
    description: '100 UEs via nb_ue counter',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: [
      { sim_algo: 'milenage', imsi: '001010000000001', K: '00112233445566778899aabbccddeeff', opc: '63bfa50ee6523365ff14c1f45f88737d', amf: 0x9001, sqn: '000000000000', nb_ue: 100 },
    ] as UeDbEntry[],
  },
  {
    id: 'builtin-uedb-ims',
    name: 'IMS UEs',
    type: 'uedb',
    description: '10 UEs with IMS enabled',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: [
      { sim_algo: 'milenage', imsi: '001010000000001', K: '00112233445566778899aabbccddeeff', opc: '63bfa50ee6523365ff14c1f45f88737d', amf: 0x9001, sqn: '000000000000', nb_ue: 10, ims: true },
    ] as UeDbEntry[],
  },
  {
    id: 'builtin-general-default',
    name: 'Default Test PLMN',
    type: 'general',
    description: 'MCC=001, MNC=01, loopback addresses',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: {
      plmn: { mcc: '001', mnc: '01' },
      tac: 1,
      amfAddr: '127.0.1.100',
      gtpAddr: '127.0.1.1',
    },
  },
  // ── Cell templates ────────────────────────────────────────────────────────
  {
    id: 'builtin-cell-n78-tdd',
    name: 'n78 TDD 40MHz',
    type: 'cell',
    description: 'Band n78 (3.5 GHz), 40 MHz, 30 kHz SCS, TDD',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: {
      cellId: 500, nrTdd: 1, fr2: 0, band: 78, nrBandwidth: 40, subcarrierSpacing: 30,
      dlNrArfcn: 632628, ssbPosBitmap: '10000000',
      tddPattern: { period: 5, dlSlots: 7, dlSymbols: 6, ulSlots: 2, ulSymbols: 4 },
    },
  },
  {
    id: 'builtin-cell-n77-tdd',
    name: 'n77 TDD 100MHz',
    type: 'cell',
    description: 'Band n77 (3.7 GHz), 100 MHz, 30 kHz SCS, TDD',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: {
      cellId: 501, nrTdd: 1, fr2: 0, band: 77, nrBandwidth: 100, subcarrierSpacing: 30,
      dlNrArfcn: 622000, ssbPosBitmap: '10000000',
      tddPattern: { period: 5, dlSlots: 7, dlSymbols: 6, ulSlots: 2, ulSymbols: 4 },
    },
  },
  {
    id: 'builtin-cell-n41-tdd',
    name: 'n41 TDD 100MHz',
    type: 'cell',
    description: 'Band n41 (2.5 GHz), 100 MHz, 30 kHz SCS, TDD',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: {
      cellId: 502, nrTdd: 1, fr2: 0, band: 41, nrBandwidth: 100, subcarrierSpacing: 30,
      dlNrArfcn: 514056, ssbPosBitmap: '10000000',
      tddPattern: { period: 5, dlSlots: 7, dlSymbols: 6, ulSlots: 2, ulSymbols: 4 },
    },
  },
  // ── RF templates ──────────────────────────────────────────────────────────
  {
    id: 'builtin-rf-sdr-1x1',
    name: 'SDR 1x1',
    type: 'rf',
    description: 'Single antenna SDR, TX 90 dB / RX 60 dB',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: { rfMode: 'sdr', nAntennaDl: 1, nAntennaUl: 1, txGain: 90, rxGain: 60, rxAntenna: 'rx' },
  },
  {
    id: 'builtin-rf-sdr-2x2',
    name: 'SDR 2x2 MIMO',
    type: 'rf',
    description: 'Dual antenna SDR for 2x2 MIMO',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: { rfMode: 'sdr', nAntennaDl: 2, nAntennaUl: 2, txGain: 90, rxGain: 60, rxAntenna: 'rx' },
  },
  {
    id: 'builtin-rf-sdr-4x4',
    name: 'SDR 4x4 MIMO',
    type: 'rf',
    description: 'Quad antenna SDR for 4x4 MIMO',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: { rfMode: 'sdr', nAntennaDl: 4, nAntennaUl: 4, txGain: 90, rxGain: 60, rxAntenna: 'rx' },
  },
  // ── Log templates ─────────────────────────────────────────────────────────
  {
    id: 'builtin-log-minimal',
    name: 'Minimal (errors only)',
    type: 'log',
    description: 'Only errors, no layer details',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: { logFilename: '/tmp/gnb0.log', logLevel: 'error', logLayers: {} },
  },
  {
    id: 'builtin-log-debug',
    name: 'Full Debug',
    type: 'log',
    description: 'Debug on NAS, RRC, NGAP for troubleshooting',
    builtIn: true,
    createdAt: new Date('2025-01-01').toISOString(),
    modifiedAt: new Date('2025-01-01').toISOString(),
    data: {
      logFilename: '/tmp/gnb0.log', logLevel: 'error',
      logLayers: { nas: 'debug', rrc: 'debug', ngap: 'debug', mac: 'info' },
    },
  },
];

class SectionFilesService {
  private loadAll(): SectionFile[] {
    if (typeof window === 'undefined') return [...BUILT_IN];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const userFiles: SectionFile[] = raw ? JSON.parse(raw) : [];
      return [...BUILT_IN, ...userFiles];
    } catch {
      return [...BUILT_IN];
    }
  }

  private persistUserFiles(files: SectionFile[]): void {
    if (typeof window === 'undefined') return;
    const userOnly = files.filter(f => !f.builtIn);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
  }

  list(type?: SectionType): SectionFile[] {
    const all = this.loadAll();
    return type ? all.filter(f => f.type === type) : all;
  }

  get(id: string): SectionFile | undefined {
    return this.loadAll().find(f => f.id === id);
  }

  save(input: Omit<SectionFile, 'id' | 'createdAt' | 'modifiedAt' | 'builtIn'>): SectionFile {
    const now = new Date().toISOString();
    const sf: SectionFile = {
      ...input,
      id: `user-${input.type}-${Date.now()}`,
      builtIn: false,
      createdAt: now,
      modifiedAt: now,
    };
    const all = this.loadAll();
    this.persistUserFiles([...all, sf]);
    return sf;
  }

  remove(id: string): boolean {
    const all = this.loadAll();
    const target = all.find(f => f.id === id);
    if (!target || target.builtIn) return false;
    this.persistUserFiles(all.filter(f => f.id !== id));
    return true;
  }

  /** Export a section file as a downloadable JSON string. */
  exportAsJson(sf: SectionFile): string {
    const payload = {
      simtool_section_file_version: 1,
      name: sf.name,
      type: sf.type,
      description: sf.description || '',
      data: sf.data,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(payload, null, 2);
  }

  /** Download a section file as a .json file via the browser. */
  downloadAsFile(sf: SectionFile): void {
    const json = this.exportAsJson(sf);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sf.type}-${sf.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import a JSON section-file payload. Returns the created SectionFile or throws.
   * Accepts either the full export payload (with simtool_section_file_version)
   * or a bare {name, type, data} object.
   */
  importFromJson(json: string): SectionFile {
    const parsed = JSON.parse(json);
    const name = parsed.name;
    const type = parsed.type as SectionType;
    const data = parsed.data ?? parsed.config ?? parsed;
    const description = parsed.description;
    if (!name || !type) {
      throw new Error('Invalid section file: missing "name" or "type".');
    }
    if (!['pdn', 'uedb', 'general', 'cell', 'band', 'rf', 'log'].includes(type)) {
      throw new Error(`Invalid section type: ${type}`);
    }
    return this.save({ name, type, description, data });
  }
}

export const sectionFilesService = new SectionFilesService();

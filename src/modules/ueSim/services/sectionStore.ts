// modules/ueSim/services/sectionStore.ts
//
// localStorage-backed persistence for UESim section files and profiles.
// Mirrors the existing testConfig sectionFiles.service.ts pattern so the
// behavior is consistent across the app.
//
// Storage keys:
//   simtool_uesim_sections_v1   → user-saved section files
//   simtool_uesim_profiles_v1   → profiles (six section IDs each)
//
// Built-in section files are seeded at module load time and live in memory.
// User-created sections persist in localStorage. Built-ins cannot be
// modified or deleted — Save As on a built-in creates a new user-owned copy.

import {
  UeSimSectionFile,
  UeSimSectionType,
  CellSectionFile,
  SubscriberSectionFile,
  TrafficSectionFile,
  UserPlaneSectionFile,
  ChannelSectionFile,
  SettingsSectionFile,
  UeProfile,
  MaterializedProfile,
  CellSectionData,
  SubscriberSectionData,
  TrafficSectionData,
  UserPlaneSectionData,
  ChannelSectionData,
  SettingsSectionData,
} from '../types';

const SECTIONS_KEY = 'simtool_uesim_sections_v1';
const PROFILES_KEY = 'simtool_uesim_profiles_v1';

// ────────────────────────────────────────────────────────────────────────────
// Built-in section seeds — minimal sane defaults so the UI never starts empty
// ────────────────────────────────────────────────────────────────────────────

const ISO = new Date('2025-01-01').toISOString();

const DEFAULT_CELL: CellSectionData = {
  cell_groups: [{
    group_type: 'nr',
    multi_ue: true,
    cells: [{
      rf_port: 0,
      bandwidth: 100,
      dl_nr_arfcn: 632628,
      n_antenna_dl: 2,
      n_antenna_ul: 1,
      scs: 30,
      ssb_pos_bitmap: '10000000',
    }],
  }],
};

const DEFAULT_SUBSCRIBER: SubscriberSectionData = {
  ues: [{
    ue_id: 0,
    imsi: '001010000000001',
    K: '00112233445566778899aabbccddeeff',
    opc: '63bfa50ee6523365ff14c1f45f88737d',
    amf: '0x9001',
    sqn: '000000000000',
    sim_algo: 'milenage',
    ue_category: 4,
    as_release: 17,
  }],
  defaults: {
    sim_algo: 'milenage',
    ue_category: 4,
    as_release: 17,
  },
};

const DEFAULT_TRAFFIC: TrafficSectionData = {
  templates: [
    {
      id: 'builtin-tpl-quick-attach',
      name: 'Quick Attach',
      description: 'Power on at t=5s and stay attached',
      builtIn: true,
      events: [{ event: 'power_on', start_time: 5 }],
    },
    {
      id: 'builtin-tpl-attach-iperf-dl',
      name: 'Attach + iperf DL 100M',
      description: 'Attach, then run iperf to LTE SimServer for 60s downlink',
      builtIn: true,
      events: [
        { event: 'power_on', start_time: 5, duration: 70 },
        { event: 'pdn_connect', start_time: 7, apn: 'internet' },
        { event: 'ext_app', start_time: 10, prog: 'ext_app.sh', args: ['iperf -c 192.168.3.1 -u -b 100M -i 1 -t 60'] },
      ],
    },
    {
      id: 'builtin-tpl-idle-camp',
      name: 'Idle Camp',
      description: 'Power on, no traffic — used for capacity tests',
      builtIn: true,
      events: [{ event: 'power_on', start_time: 5 }],
    },
  ],
  assignments: [{ ue_id: 0, template_id: 'builtin-tpl-quick-attach', start_offset: 0 }],
  server: { ip: '192.168.3.1', port: 5001, kind: 'ltesim_server' },
};

const DEFAULT_USER_PLANE: UserPlaneSectionData = {
  mode: 'tun',
  tun_setup_script: 'ue-ifup',
  pdn_list: [{ apn: 'internet', pdn_type: 'ipv4', default: true }],
};

const DEFAULT_CHANNEL: ChannelSectionData = {
  channel_sim: false,
  delay_sim: true,
  map_extent_m: 1000,
  per_cell: [{
    cell_index: 0,
    dl_type: 'awgn',
    ul_type: 'awgn',
    antenna_x: 0,
    antenna_y: 0,
    antenna_type: 'isotropic',
  }],
  mobility: [{
    ue_id: 0,
    position: [50, 0, 0],
    speed: 0,
    direction: 0,
  }],
};

const DEFAULT_SETTINGS: SettingsSectionData = {
  log_layers: [
    { layer: 'all', level: 'error', max_size: 0 },
    { layer: 'phy', level: 'error', max_size: 0 },
    { layer: 'mac', level: 'info', max_size: 1 },
    { layer: 'rlc', level: 'info', max_size: 1 },
    { layer: 'pdcp', level: 'info', max_size: 1 },
    { layer: 'rrc', level: 'debug', max_size: 1 },
    { layer: 'nas', level: 'debug', max_size: 1 },
  ],
  log_filename: '/tmp/ue0.log',
  com_addr: '[::]:9002',
  tx_gain: 90,
  rx_gain: 60,
  rf_driver: { name: 'sdr', args: 'dev0=/dev/sdr0' },
};

const BUILT_IN_SECTIONS: UeSimSectionFile[] = [
  {
    id: 'builtin-cell-default-nr',
    name: 'Default NR n78 100MHz',
    type: 'ueSim_cell',
    description: '5G NR SA, n78, 100 MHz, 30 kHz SCS',
    builtIn: true,
    createdAt: ISO,
    modifiedAt: ISO,
    data: DEFAULT_CELL,
  },
  {
    id: 'builtin-cell-default-lte',
    name: 'Default LTE B7 20MHz',
    type: 'ueSim_cell',
    description: 'LTE FDD Band 7, 20 MHz, 2x2 MIMO',
    builtIn: true,
    createdAt: ISO,
    modifiedAt: ISO,
    data: {
      cell_groups: [{
        group_type: 'lte',
        multi_ue: true,
        cells: [{
          rf_port: 0,
          bandwidth: 20,
          dl_earfcn: 3350,
          n_antenna_dl: 2,
          n_antenna_ul: 1,
        }],
      }],
    },
  },
  {
    id: 'builtin-subscriber-1ue',
    name: 'Single UE (Milenage)',
    type: 'ueSim_subscriber',
    description: 'One subscriber, default Milenage credentials',
    builtIn: true,
    createdAt: ISO,
    modifiedAt: ISO,
    data: DEFAULT_SUBSCRIBER,
  },
  {
    id: 'builtin-subscriber-32ue',
    name: '32 UE Pool',
    type: 'ueSim_subscriber',
    description: '32 sequential UEs with shared K/OPC (xor)',
    builtIn: true,
    createdAt: ISO,
    modifiedAt: ISO,
    data: {
      ues: Array.from({ length: 32 }, (_, i) => ({
        ue_id: i,
        imsi: `00101000000${String(i + 1).padStart(4, '0')}`,
        K: '00112233445566778899aabbccddeeff',
        sim_algo: 'xor' as const,
        ue_category: 4,
        as_release: 17,
      })),
      defaults: { sim_algo: 'xor' as const, ue_category: 4, as_release: 17 },
    },
  },
  {
    id: 'builtin-traffic-default',
    name: 'Default Traffic',
    type: 'ueSim_traffic',
    description: 'Quick Attach + Attach+iperf templates',
    builtIn: true,
    createdAt: ISO,
    modifiedAt: ISO,
    data: DEFAULT_TRAFFIC,
  },
  {
    id: 'builtin-userplane-tun',
    name: 'TUN mode (default)',
    type: 'ueSim_userPlane',
    description: 'TUN per UE with ue-ifup, single internet APN',
    builtIn: true,
    createdAt: ISO,
    modifiedAt: ISO,
    data: DEFAULT_USER_PLANE,
  },
  {
    id: 'builtin-userplane-sim',
    name: 'Sim mode',
    type: 'ueSim_userPlane',
    description: 'No TUN, use ltesim_server for traffic',
    builtIn: true,
    createdAt: ISO,
    modifiedAt: ISO,
    data: { mode: 'sim' as const, pdn_list: [{ apn: 'internet', pdn_type: 'ipv4' as const, default: true }] },
  },
  {
    id: 'builtin-channel-off',
    name: 'No Channel Sim',
    type: 'ueSim_channel',
    description: 'Channel simulator disabled — direct cable connection',
    builtIn: true,
    createdAt: ISO,
    modifiedAt: ISO,
    data: DEFAULT_CHANNEL,
  },
  {
    id: 'builtin-channel-epa',
    name: 'EPA Pedestrian Fading',
    type: 'ueSim_channel',
    description: '3GPP EPA fading model on DL/UL',
    builtIn: true,
    createdAt: ISO,
    modifiedAt: ISO,
    data: {
      channel_sim: true,
      delay_sim: true,
      map_extent_m: 1000,
      per_cell: [{
        cell_index: 0,
        dl_type: 'epa' as const,
        ul_type: 'epa' as const,
        doppler_hz: 5,
        antenna_x: 0,
        antenna_y: 0,
        antenna_type: 'isotropic' as const,
      }],
      mobility: [{ ue_id: 0, position: [50, 0, 0] as [number, number, number], speed: 5, direction: 0 }],
    },
  },
  {
    id: 'builtin-settings-default',
    name: 'Default Settings',
    type: 'ueSim_settings',
    description: 'tx=90 rx=60, debug NAS+RRC, port 9002',
    builtIn: true,
    createdAt: ISO,
    modifiedAt: ISO,
    data: DEFAULT_SETTINGS,
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Section File store
// ────────────────────────────────────────────────────────────────────────────

class SectionStore {
  private loadAll(): UeSimSectionFile[] {
    if (typeof window === 'undefined') return [...BUILT_IN_SECTIONS];
    try {
      const raw = window.localStorage.getItem(SECTIONS_KEY);
      const userFiles: UeSimSectionFile[] = raw ? JSON.parse(raw) : [];
      return [...BUILT_IN_SECTIONS, ...userFiles];
    } catch {
      return [...BUILT_IN_SECTIONS];
    }
  }

  private persistUserFiles(files: UeSimSectionFile[]): void {
    if (typeof window === 'undefined') return;
    const userOnly = files.filter(f => !f.builtIn);
    window.localStorage.setItem(SECTIONS_KEY, JSON.stringify(userOnly));
  }

  list(type?: UeSimSectionType): UeSimSectionFile[] {
    const all = this.loadAll();
    return type ? all.filter(f => f.type === type) : all;
  }

  get<T = unknown>(id: string): UeSimSectionFile<T> | undefined {
    return this.loadAll().find(f => f.id === id) as UeSimSectionFile<T> | undefined;
  }

  /**
   * Save a brand-new section file (always creates a new ID — never updates).
   * Use update() to modify an existing user-owned section.
   */
  save<T>(input: {
    name: string;
    type: UeSimSectionType;
    description?: string;
    data: T;
    sourceFile?: string;
  }): UeSimSectionFile<T> {
    const now = new Date().toISOString();
    const sf: UeSimSectionFile<T> = {
      id: `user-${input.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      type: input.type,
      description: input.description,
      data: input.data,
      builtIn: false,
      createdAt: now,
      modifiedAt: now,
      sourceFile: input.sourceFile,
    };
    const all = this.loadAll();
    this.persistUserFiles([...all, sf as UeSimSectionFile]);
    return sf;
  }

  /** Update an existing user-owned section. Built-ins cannot be updated. */
  update<T>(id: string, patch: Partial<{ name: string; description?: string; data: T }>): UeSimSectionFile<T> | null {
    const all = this.loadAll();
    const target = all.find(f => f.id === id);
    if (!target || target.builtIn) return null;
    const updated: UeSimSectionFile<T> = {
      ...(target as UeSimSectionFile<T>),
      ...patch,
      modifiedAt: new Date().toISOString(),
    };
    const next = all.map(f => f.id === id ? (updated as UeSimSectionFile) : f);
    this.persistUserFiles(next);
    return updated;
  }

  remove(id: string): boolean {
    const all = this.loadAll();
    const target = all.find(f => f.id === id);
    if (!target || target.builtIn) return false;
    this.persistUserFiles(all.filter(f => f.id !== id));
    return true;
  }
}

export const sectionStore = new SectionStore();

// ────────────────────────────────────────────────────────────────────────────
// Profile store
// ────────────────────────────────────────────────────────────────────────────

class ProfileStore {
  private loadAll(): UeProfile[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(PROFILES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persist(profiles: UeProfile[]): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  }

  list(): UeProfile[] {
    return this.loadAll();
  }

  get(id: string): UeProfile | undefined {
    return this.loadAll().find(p => p.id === id);
  }

  save(input: {
    name: string;
    description?: string;
    sectionIds: UeProfile['sectionIds'];
  }): UeProfile {
    const now = new Date().toISOString();
    const profile: UeProfile = {
      id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      description: input.description,
      sectionIds: input.sectionIds,
      createdAt: now,
      modifiedAt: now,
    };
    this.persist([...this.loadAll(), profile]);
    return profile;
  }

  update(id: string, patch: Partial<Omit<UeProfile, 'id' | 'createdAt'>>): UeProfile | null {
    const all = this.loadAll();
    const idx = all.findIndex(p => p.id === id);
    if (idx < 0) return null;
    const updated: UeProfile = {
      ...all[idx],
      ...patch,
      modifiedAt: new Date().toISOString(),
    };
    all[idx] = updated;
    this.persist(all);
    return updated;
  }

  remove(id: string): boolean {
    const all = this.loadAll();
    if (!all.find(p => p.id === id)) return false;
    this.persist(all.filter(p => p.id !== id));
    return true;
  }

  /** Materialize a profile by resolving each section ID to its data. */
  materialize(profile: UeProfile): MaterializedProfile | null {
    const cell = sectionStore.get<CellSectionData>(profile.sectionIds.cell);
    const subscriber = sectionStore.get<SubscriberSectionData>(profile.sectionIds.subscriber);
    const traffic = sectionStore.get<TrafficSectionData>(profile.sectionIds.traffic);
    const userPlane = sectionStore.get<UserPlaneSectionData>(profile.sectionIds.userPlane);
    const channel = sectionStore.get<ChannelSectionData>(profile.sectionIds.channel);
    const settings = sectionStore.get<SettingsSectionData>(profile.sectionIds.settings);
    if (!cell || !subscriber || !traffic || !userPlane || !channel || !settings) {
      return null;
    }
    return {
      cell: cell.data,
      subscriber: subscriber.data,
      traffic: traffic.data,
      userPlane: userPlane.data,
      channel: channel.data,
      settings: settings.data,
    };
  }
}

export const profileStore = new ProfileStore();

// ────────────────────────────────────────────────────────────────────────────
// Helpers — typed get/save for each section type
// ────────────────────────────────────────────────────────────────────────────

export const cellSections = {
  list: () => sectionStore.list('ueSim_cell') as CellSectionFile[],
  get: (id: string) => sectionStore.get<CellSectionData>(id) as CellSectionFile | undefined,
  save: (name: string, data: CellSectionData, description?: string, sourceFile?: string) =>
    sectionStore.save({ name, type: 'ueSim_cell', data, description, sourceFile }) as CellSectionFile,
  update: (id: string, patch: { name?: string; description?: string; data?: CellSectionData }) =>
    sectionStore.update<CellSectionData>(id, patch) as CellSectionFile | null,
  remove: (id: string) => sectionStore.remove(id),
};

export const subscriberSections = {
  list: () => sectionStore.list('ueSim_subscriber') as SubscriberSectionFile[],
  get: (id: string) => sectionStore.get<SubscriberSectionData>(id) as SubscriberSectionFile | undefined,
  save: (name: string, data: SubscriberSectionData, description?: string, sourceFile?: string) =>
    sectionStore.save({ name, type: 'ueSim_subscriber', data, description, sourceFile }) as SubscriberSectionFile,
  update: (id: string, patch: { name?: string; description?: string; data?: SubscriberSectionData }) =>
    sectionStore.update<SubscriberSectionData>(id, patch) as SubscriberSectionFile | null,
  remove: (id: string) => sectionStore.remove(id),
};

export const trafficSections = {
  list: () => sectionStore.list('ueSim_traffic') as TrafficSectionFile[],
  get: (id: string) => sectionStore.get<TrafficSectionData>(id) as TrafficSectionFile | undefined,
  save: (name: string, data: TrafficSectionData, description?: string, sourceFile?: string) =>
    sectionStore.save({ name, type: 'ueSim_traffic', data, description, sourceFile }) as TrafficSectionFile,
  update: (id: string, patch: { name?: string; description?: string; data?: TrafficSectionData }) =>
    sectionStore.update<TrafficSectionData>(id, patch) as TrafficSectionFile | null,
  remove: (id: string) => sectionStore.remove(id),
};

export const userPlaneSections = {
  list: () => sectionStore.list('ueSim_userPlane') as UserPlaneSectionFile[],
  get: (id: string) => sectionStore.get<UserPlaneSectionData>(id) as UserPlaneSectionFile | undefined,
  save: (name: string, data: UserPlaneSectionData, description?: string, sourceFile?: string) =>
    sectionStore.save({ name, type: 'ueSim_userPlane', data, description, sourceFile }) as UserPlaneSectionFile,
  update: (id: string, patch: { name?: string; description?: string; data?: UserPlaneSectionData }) =>
    sectionStore.update<UserPlaneSectionData>(id, patch) as UserPlaneSectionFile | null,
  remove: (id: string) => sectionStore.remove(id),
};

export const channelSections = {
  list: () => sectionStore.list('ueSim_channel') as ChannelSectionFile[],
  get: (id: string) => sectionStore.get<ChannelSectionData>(id) as ChannelSectionFile | undefined,
  save: (name: string, data: ChannelSectionData, description?: string, sourceFile?: string) =>
    sectionStore.save({ name, type: 'ueSim_channel', data, description, sourceFile }) as ChannelSectionFile,
  update: (id: string, patch: { name?: string; description?: string; data?: ChannelSectionData }) =>
    sectionStore.update<ChannelSectionData>(id, patch) as ChannelSectionFile | null,
  remove: (id: string) => sectionStore.remove(id),
};

export const settingsSections = {
  list: () => sectionStore.list('ueSim_settings') as SettingsSectionFile[],
  get: (id: string) => sectionStore.get<SettingsSectionData>(id) as SettingsSectionFile | undefined,
  save: (name: string, data: SettingsSectionData, description?: string, sourceFile?: string) =>
    sectionStore.save({ name, type: 'ueSim_settings', data, description, sourceFile }) as SettingsSectionFile,
  update: (id: string, patch: { name?: string; description?: string; data?: SettingsSectionData }) =>
    sectionStore.update<SettingsSectionData>(id, patch) as SettingsSectionFile | null,
  remove: (id: string) => sectionStore.remove(id),
};

// ────────────────────────────────────────────────────────────────────────────
// Default profile bootstrap
// ────────────────────────────────────────────────────────────────────────────

export function getDefaultProfileSectionIds(): UeProfile['sectionIds'] {
  return {
    cell: 'builtin-cell-default-nr',
    subscriber: 'builtin-subscriber-1ue',
    traffic: 'builtin-traffic-default',
    userPlane: 'builtin-userplane-tun',
    channel: 'builtin-channel-off',
    settings: 'builtin-settings-default',
  };
}

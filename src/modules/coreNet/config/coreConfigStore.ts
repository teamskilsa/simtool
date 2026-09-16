// modules/coreNet/config/coreConfigStore.ts
//
// "My Cores" — the editable Core configurations, kept in localStorage the
// same way the UE-SIM test cases are. The generated mme.cfg is a separate
// artefact that goes to the server-side config store under module 'mme'.

import type { CoreConfig } from './types';
import { normalizeCoreConfig } from './defaults';

const KEY = 'simtool_corenet_configs_v1';

function readAll(): CoreConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(p => normalizeCoreConfig(p)) : [];
  } catch {
    return [];
  }
}

function writeAll(list: CoreConfig[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota or private mode */
  }
}

export const coreConfigStore = {
  list(): CoreConfig[] {
    return readAll().sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
  },

  get(id: string): CoreConfig | undefined {
    return readAll().find(c => c.id === id);
  },

  upsert(cfg: CoreConfig): CoreConfig {
    const now = new Date().toISOString();
    const stored: CoreConfig = { ...cfg, modifiedAt: now, createdAt: cfg.createdAt || now };
    const all = readAll();
    const idx = all.findIndex(c => c.id === cfg.id);
    if (idx >= 0) all[idx] = stored;
    else all.push(stored);
    writeAll(all);
    return stored;
  },

  remove(id: string): void {
    writeAll(readAll().filter(c => c.id !== id));
  },

  uniqueName(base: string): string {
    const names = new Set(readAll().map(c => c.settings.configName));
    if (!names.has(base)) return base;
    let n = 2;
    while (names.has(`${base}_${n}`)) n += 1;
    return `${base}_${n}`;
  },
};

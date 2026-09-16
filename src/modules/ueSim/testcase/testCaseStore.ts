// modules/ueSim/testcase/testCaseStore.ts
//
// "My Tests" for the UE simulator: the editable test cases, kept in
// localStorage (same posture as the section-file store). The generated
// ue.cfg is a separate artefact — it goes to the server-side config store
// via /api/configs so it shows up under Test Configurations and can be
// deployed — but the source of truth for re-editing is this list.

import type { UeTestCase } from './types';
import { normalizeTestCase } from './defaults';

const KEY = 'simtool_uesim_testcases_v1';

function readAll(): UeTestCase[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(p => normalizeTestCase(p)) : [];
  } catch {
    return [];
  }
}

function writeAll(list: UeTestCase[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota or private mode — nothing to do */
  }
}

export const testCaseStore = {
  list(): UeTestCase[] {
    return readAll().sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
  },

  get(id: string): UeTestCase | undefined {
    return readAll().find(t => t.id === id);
  },

  /** Insert or replace by id. Returns the stored copy. */
  upsert(tc: UeTestCase): UeTestCase {
    const now = new Date().toISOString();
    const stored: UeTestCase = { ...tc, modifiedAt: now, createdAt: tc.createdAt || now };
    const all = readAll();
    const idx = all.findIndex(t => t.id === tc.id);
    if (idx >= 0) all[idx] = stored;
    else all.push(stored);
    writeAll(all);
    return stored;
  },

  remove(id: string): void {
    writeAll(readAll().filter(t => t.id !== id));
  },

  /** A name that does not collide with an existing test case. */
  uniqueName(base: string): string {
    const names = new Set(readAll().map(t => t.settings.testCaseName));
    if (!names.has(base)) return base;
    let n = 2;
    while (names.has(`${base}_${n}`)) n += 1;
    return `${base}_${n}`;
  },
};

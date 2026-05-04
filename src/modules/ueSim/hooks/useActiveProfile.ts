// modules/ueSim/hooks/useActiveProfile.ts
//
// React hook that owns the "currently active UE profile" + per-tab section
// selection. The 6 tab components read/write through here so they don't have
// to know about localStorage or the profile/section split.
//
// Storage:
//   simtool_uesim_active_profile_v1 → string | null   (profile ID)
//   simtool_uesim_sections_v1, simtool_uesim_profiles_v1 (handled by sectionStore)
//
// Mutation flow:
//   selectProfile(id)            → swap which profile is active
//   setSectionForTab(tab, secId) → swap one of the 6 sections inside the active profile
//   refresh()                    → re-read after an external change (e.g. import dialog)

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cellSections,
  channelSections,
  getDefaultProfileSectionIds,
  profileStore,
  sectionStore,
  settingsSections,
  subscriberSections,
  trafficSections,
  userPlaneSections,
} from '../services/sectionStore';
import type {
  CellSectionFile,
  ChannelSectionFile,
  MaterializedProfile,
  SettingsSectionFile,
  SubscriberSectionFile,
  TrafficSectionFile,
  UeProfile,
  UeSimSectionFile,
  UeSimSectionType,
  UserPlaneSectionFile,
} from '../types';

export type TabKey = keyof UeProfile['sectionIds'];

const ACTIVE_KEY = 'simtool_uesim_active_profile_v1';

export interface ActiveProfileSections {
  cell: CellSectionFile | undefined;
  subscriber: SubscriberSectionFile | undefined;
  traffic: TrafficSectionFile | undefined;
  userPlane: UserPlaneSectionFile | undefined;
  channel: ChannelSectionFile | undefined;
  settings: SettingsSectionFile | undefined;
}

export interface UseActiveProfileResult {
  hydrated: boolean;
  profile: UeProfile | null;
  profiles: UeProfile[];
  sections: ActiveProfileSections;
  materialized: MaterializedProfile | null;
  selectProfile: (id: string) => void;
  createProfile: (name: string, sectionIds?: UeProfile['sectionIds']) => UeProfile;
  setSectionForTab: (tab: TabKey, sectionId: string) => void;
  duplicateActiveProfile: (newName: string) => UeProfile | null;
  deleteCurrentProfile: () => void;
  refresh: () => void;
}

const TAB_TO_TYPE: Record<TabKey, UeSimSectionType> = {
  cell: 'ueSim_cell',
  subscriber: 'ueSim_subscriber',
  traffic: 'ueSim_traffic',
  userPlane: 'ueSim_userPlane',
  channel: 'ueSim_channel',
  settings: 'ueSim_settings',
};

function readActiveId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActiveId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* best effort */
  }
}

/**
 * Ensures there's at least one profile (auto-creates "Default" on first use)
 * and returns the active one. Hydration is two-phase to avoid SSR mismatch:
 * first render returns hydrated=false so components can show a stable
 * skeleton.
 */
export function useActiveProfile(): UseActiveProfileResult {
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);

  // Initial hydration: ensure default profile exists, pick active.
  useEffect(() => {
    let allProfiles = profileStore.list();
    if (allProfiles.length === 0) {
      profileStore.save({
        name: 'Default',
        description: 'Auto-created default UE profile',
        sectionIds: getDefaultProfileSectionIds(),
      });
      allProfiles = profileStore.list();
    }
    let activeId = readActiveId();
    if (!activeId || !allProfiles.find(p => p.id === activeId)) {
      activeId = allProfiles[0].id;
      writeActiveId(activeId);
    }
    setHydrated(true);
  }, []);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  const profiles = useMemo<UeProfile[]>(() => {
    if (!hydrated) return [];
    return profileStore.list();
    // tick is intentionally a dep so we re-read after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tick]);

  const profile = useMemo<UeProfile | null>(() => {
    if (!hydrated) return null;
    const id = readActiveId();
    if (!id) return profiles[0] ?? null;
    return profiles.find(p => p.id === id) ?? profiles[0] ?? null;
  }, [hydrated, profiles]);

  const sections = useMemo<ActiveProfileSections>(() => {
    if (!profile) {
      return {
        cell: undefined, subscriber: undefined, traffic: undefined,
        userPlane: undefined, channel: undefined, settings: undefined,
      };
    }
    return {
      cell: cellSections.get(profile.sectionIds.cell),
      subscriber: subscriberSections.get(profile.sectionIds.subscriber),
      traffic: trafficSections.get(profile.sectionIds.traffic),
      userPlane: userPlaneSections.get(profile.sectionIds.userPlane),
      channel: channelSections.get(profile.sectionIds.channel),
      settings: settingsSections.get(profile.sectionIds.settings),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, tick]);

  const materialized = useMemo<MaterializedProfile | null>(() => {
    if (!profile) return null;
    return profileStore.materialize(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, tick]);

  const selectProfile = useCallback((id: string) => {
    writeActiveId(id);
    refresh();
  }, [refresh]);

  const createProfile = useCallback(
    (name: string, sectionIds?: UeProfile['sectionIds']) => {
      const created = profileStore.save({
        name,
        sectionIds: sectionIds ?? getDefaultProfileSectionIds(),
      });
      writeActiveId(created.id);
      refresh();
      return created;
    },
    [refresh],
  );

  const setSectionForTab = useCallback((tab: TabKey, sectionId: string) => {
    const id = readActiveId();
    if (!id) return;
    const cur = profileStore.get(id);
    if (!cur) return;
    // Validate that the section exists and is the correct type.
    const sec = sectionStore.get(sectionId);
    if (!sec || sec.type !== TAB_TO_TYPE[tab]) return;
    profileStore.update(id, {
      sectionIds: { ...cur.sectionIds, [tab]: sectionId },
    });
    refresh();
  }, [refresh]);

  const duplicateActiveProfile = useCallback((newName: string) => {
    if (!profile) return null;
    const dup = profileStore.save({
      name: newName,
      description: profile.description,
      sectionIds: { ...profile.sectionIds },
    });
    writeActiveId(dup.id);
    refresh();
    return dup;
  }, [profile, refresh]);

  const deleteCurrentProfile = useCallback(() => {
    const id = readActiveId();
    if (!id) return;
    profileStore.remove(id);
    const remaining = profileStore.list();
    if (remaining.length === 0) {
      profileStore.save({
        name: 'Default',
        sectionIds: getDefaultProfileSectionIds(),
      });
    }
    const first = profileStore.list()[0];
    writeActiveId(first ? first.id : null);
    refresh();
  }, [refresh]);

  return {
    hydrated,
    profile,
    profiles,
    sections,
    materialized,
    selectProfile,
    createProfile,
    setSectionForTab,
    duplicateActiveProfile,
    deleteCurrentProfile,
    refresh,
  };
}

/**
 * List section files of one type. Returns built-ins first, then user files.
 * Re-reads on each call (cheap — localStorage); components should call inside
 * useMemo if they want stability.
 */
export function useSectionList(type: UeSimSectionType): UeSimSectionFile[] {
  const [, setTick] = useState(0);
  // Subscribe to storage events from other tabs so dropdowns stay fresh.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key === 'simtool_uesim_sections_v1') setTick(t => t + 1);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return sectionStore.list(type);
}

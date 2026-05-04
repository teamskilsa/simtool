// modules/ueSim/views/UeSimView.tsx
//
// Top-level view for the UESim section of the dashboard.
//
// Layout:
//   ProfileSelector (top bar)
//   ──────────────
//   Tabs: Cell · Subscriber · Traffic · User Plane · Channel · Settings
//   Each tab body is wrapped with a SectionHeaderStrip showing the
//   currently-active section file and the Save / Save As / Reset / Delete
//   controls.
//
// State strategy:
//   The "saved" data lives in the Section File store (localStorage). The
//   user's in-flight edits live in a per-tab `draft` ref (React state)
//   that's seeded from the saved file the first time a section is opened
//   and re-seeded when the user explicitly Resets or Saves. We compare
//   draft vs saved with a deep-equal helper to drive the "unsaved" badge.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';

import { useActiveProfile, useSectionList, type TabKey } from '../hooks/useActiveProfile';
import { ProfileSelector } from '../components/header/ProfileSelector';
import { SectionHeaderStrip } from '../components/header/SectionHeaderStrip';
import { UeCfgLoaderDialog } from '../components/loader/UeCfgLoaderDialog';
import { ApplyDialog, readLastApplied } from '../components/apply/ApplyDialog';

import { CellTab } from '../components/cell/CellTab';
import { SubscriberTab } from '../components/subscriber/SubscriberTab';
import { TrafficTab } from '../components/traffic/TrafficTab';
import { UserPlaneTab } from '../components/userPlane/UserPlaneTab';
import { ChannelTab } from '../components/channel/ChannelTab';
import { SettingsTab } from '../components/settings/SettingsTab';

import {
  cellSections, channelSections, settingsSections,
  subscriberSections, trafficSections, userPlaneSections,
} from '../services/sectionStore';
import type {
  CellSectionData, ChannelSectionData, MaterializedProfile, SettingsSectionData,
  SubscriberSectionData, TrafficSectionData, UeSimSectionFile, UserPlaneSectionData,
} from '../types';

// ── deep equality (small, deterministic — handles JSON-shaped objects) ──
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual((a as any)[k], (b as any)[k])) return false;
  }
  return true;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function UeSimView() {
  const {
    hydrated, profile, profiles, sections, materialized,
    selectProfile, createProfile, setSectionForTab,
    duplicateActiveProfile, deleteCurrentProfile, refresh,
  } = useActiveProfile();

  const [activeTab, setActiveTab] = useState<TabKey>('cell');
  const [loaderOpen, setLoaderOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  // Per-tab drafts.
  const [cellDraft, setCellDraft] = useState<CellSectionData | null>(null);
  const [subDraft, setSubDraft] = useState<SubscriberSectionData | null>(null);
  const [trafDraft, setTrafDraft] = useState<TrafficSectionData | null>(null);
  const [upDraft, setUpDraft] = useState<UserPlaneSectionData | null>(null);
  const [chanDraft, setChanDraft] = useState<ChannelSectionData | null>(null);
  const [setDraft, setSetDraft] = useState<SettingsSectionData | null>(null);

  // Track which section ID each draft was seeded from so we re-seed on swap.
  const seededRef = useRef<Partial<Record<TabKey, string>>>({});

  // ── seed drafts from active profile sections ────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    const seedIfNeeded = <K extends TabKey, T>(
      tab: K, sec: UeSimSectionFile<T> | undefined,
      setter: (v: T) => void,
    ) => {
      if (!sec) return;
      if (seededRef.current[tab] !== sec.id) {
        setter(clone(sec.data));
        seededRef.current[tab] = sec.id;
      }
    };
    seedIfNeeded('cell',       sections.cell,       setCellDraft);
    seedIfNeeded('subscriber', sections.subscriber, setSubDraft);
    seedIfNeeded('traffic',    sections.traffic,    setTrafDraft);
    seedIfNeeded('userPlane',  sections.userPlane,  setUpDraft);
    seedIfNeeded('channel',    sections.channel,    setChanDraft);
    seedIfNeeded('settings',   sections.settings,   setSetDraft);
  }, [hydrated, sections.cell, sections.subscriber, sections.traffic,
      sections.userPlane, sections.channel, sections.settings]);

  // ── live materialised profile (drafts override saved) ───────────────
  const materializedFromDrafts = useMemo<MaterializedProfile | null>(() => {
    if (!materialized) return null;
    return {
      cell:       cellDraft  ?? materialized.cell,
      subscriber: subDraft   ?? materialized.subscriber,
      traffic:    trafDraft  ?? materialized.traffic,
      userPlane:  upDraft    ?? materialized.userPlane,
      channel:    chanDraft  ?? materialized.channel,
      settings:   setDraft   ?? materialized.settings,
    };
  }, [materialized, cellDraft, subDraft, trafDraft, upDraft, chanDraft, setDraft]);

  // Dirty flags.
  const dirty: Record<TabKey, boolean> = {
    cell:       !!sections.cell       && !!cellDraft && !deepEqual(cellDraft, sections.cell.data),
    subscriber: !!sections.subscriber && !!subDraft  && !deepEqual(subDraft,  sections.subscriber.data),
    traffic:    !!sections.traffic    && !!trafDraft && !deepEqual(trafDraft, sections.traffic.data),
    userPlane:  !!sections.userPlane  && !!upDraft   && !deepEqual(upDraft,   sections.userPlane.data),
    channel:    !!sections.channel    && !!chanDraft && !deepEqual(chanDraft, sections.channel.data),
    settings:   !!sections.settings   && !!setDraft  && !deepEqual(setDraft,  sections.settings.data),
  };

  // ── per-tab section list (built-ins + user files) ───────────────────
  const cellList     = useSectionList('ueSim_cell');
  const subList      = useSectionList('ueSim_subscriber');
  const trafList     = useSectionList('ueSim_traffic');
  const upList       = useSectionList('ueSim_userPlane');
  const chanList     = useSectionList('ueSim_channel');
  const setList      = useSectionList('ueSim_settings');

  // ── header-strip wiring per tab ─────────────────────────────────────
  const onSwapSection = (tab: TabKey, sectionId: string) => {
    setSectionForTab(tab, sectionId);
    seededRef.current[tab] = undefined; // force re-seed on next effect
  };

  const onSaveTab = (tab: TabKey) => {
    if (!profile) return;
    const cur = sections[tab];
    if (!cur || cur.builtIn) return;
    switch (tab) {
      case 'cell':       cellDraft  && cellSections.update(cur.id, { data: clone(cellDraft) }); break;
      case 'subscriber': subDraft   && subscriberSections.update(cur.id, { data: clone(subDraft) }); break;
      case 'traffic':    trafDraft  && trafficSections.update(cur.id, { data: clone(trafDraft) }); break;
      case 'userPlane':  upDraft    && userPlaneSections.update(cur.id, { data: clone(upDraft) }); break;
      case 'channel':    chanDraft  && channelSections.update(cur.id, { data: clone(chanDraft) }); break;
      case 'settings':   setDraft   && settingsSections.update(cur.id, { data: clone(setDraft) }); break;
    }
    refresh();
  };

  const onSaveAsTab = (tab: TabKey, name: string, description?: string) => {
    let newId = '';
    switch (tab) {
      case 'cell':
        if (cellDraft) newId = cellSections.save(name, clone(cellDraft), description).id; break;
      case 'subscriber':
        if (subDraft) newId = subscriberSections.save(name, clone(subDraft), description).id; break;
      case 'traffic':
        if (trafDraft) newId = trafficSections.save(name, clone(trafDraft), description).id; break;
      case 'userPlane':
        if (upDraft) newId = userPlaneSections.save(name, clone(upDraft), description).id; break;
      case 'channel':
        if (chanDraft) newId = channelSections.save(name, clone(chanDraft), description).id; break;
      case 'settings':
        if (setDraft) newId = settingsSections.save(name, clone(setDraft), description).id; break;
    }
    if (newId) setSectionForTab(tab, newId);
    seededRef.current[tab] = newId; // we just wrote it; draft IS the section
    refresh();
  };

  const onResetTab = (tab: TabKey) => {
    const cur = sections[tab];
    if (!cur) return;
    switch (tab) {
      case 'cell':       setCellDraft(clone(cur.data as CellSectionData)); break;
      case 'subscriber': setSubDraft(clone(cur.data as SubscriberSectionData)); break;
      case 'traffic':    setTrafDraft(clone(cur.data as TrafficSectionData)); break;
      case 'userPlane':  setUpDraft(clone(cur.data as UserPlaneSectionData)); break;
      case 'channel':    setChanDraft(clone(cur.data as ChannelSectionData)); break;
      case 'settings':   setSetDraft(clone(cur.data as SettingsSectionData)); break;
    }
  };

  const onDeleteTab = (tab: TabKey) => {
    const cur = sections[tab];
    if (!cur || cur.builtIn) return;
    // Move profile to the type's first built-in.
    const fallback = (() => {
      switch (tab) {
        case 'cell':       return 'builtin-cell-default-nr';
        case 'subscriber': return 'builtin-subscriber-1ue';
        case 'traffic':    return 'builtin-traffic-default';
        case 'userPlane':  return 'builtin-userplane-tun';
        case 'channel':    return 'builtin-channel-off';
        case 'settings':   return 'builtin-settings-default';
      }
    })();
    setSectionForTab(tab, fallback);
    // Remove the section file itself.
    switch (tab) {
      case 'cell':       cellSections.remove(cur.id); break;
      case 'subscriber': subscriberSections.remove(cur.id); break;
      case 'traffic':    trafficSections.remove(cur.id); break;
      case 'userPlane':  userPlaneSections.remove(cur.id); break;
      case 'channel':    channelSections.remove(cur.id); break;
      case 'settings':   settingsSections.remove(cur.id); break;
    }
    seededRef.current[tab] = undefined;
    refresh();
  };

  if (!hydrated) {
    return (
      <div className="space-y-3">
        <div className="h-12 bg-muted/30 rounded animate-pulse" />
        <div className="h-10 bg-muted/30 rounded animate-pulse" />
        <div className="h-64 bg-muted/30 rounded animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-sm text-muted-foreground">
        No UE profile available. Try reloading the page.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProfileSelector
        profiles={profiles}
        activeId={profile.id}
        materialized={materializedFromDrafts}
        onSelect={selectProfile}
        onCreate={(name) => createProfile(name)}
        onDuplicate={(name) => duplicateActiveProfile(name)}
        onDelete={deleteCurrentProfile}
        onOpenLoader={() => setLoaderOpen(true)}
        onApply={() => setApplyOpen(true)}
      />

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabKey)}>
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="cell">Cell</TabsTrigger>
          <TabsTrigger value="subscriber">Subscriber</TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="userPlane">User Plane</TabsTrigger>
          <TabsTrigger value="channel">Channel</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="cell" className="space-y-3 mt-3">
          <SectionHeaderStrip
            label="Cell"
            sections={cellList}
            activeId={profile.sectionIds.cell}
            isDirty={dirty.cell}
            onSelect={id => onSwapSection('cell', id)}
            onSave={() => onSaveTab('cell')}
            onSaveAs={(n, d) => onSaveAsTab('cell', n, d)}
            onReset={() => onResetTab('cell')}
            onDelete={() => onDeleteTab('cell')}
          />
          {cellDraft && <CellTab data={cellDraft} onChange={setCellDraft} />}
        </TabsContent>

        <TabsContent value="subscriber" className="space-y-3 mt-3">
          <SectionHeaderStrip
            label="Subscriber"
            sections={subList}
            activeId={profile.sectionIds.subscriber}
            isDirty={dirty.subscriber}
            onSelect={id => onSwapSection('subscriber', id)}
            onSave={() => onSaveTab('subscriber')}
            onSaveAs={(n, d) => onSaveAsTab('subscriber', n, d)}
            onReset={() => onResetTab('subscriber')}
            onDelete={() => onDeleteTab('subscriber')}
          />
          {subDraft && <SubscriberTab data={subDraft} onChange={setSubDraft} />}
        </TabsContent>

        <TabsContent value="traffic" className="space-y-3 mt-3">
          <SectionHeaderStrip
            label="Traffic"
            sections={trafList}
            activeId={profile.sectionIds.traffic}
            isDirty={dirty.traffic}
            onSelect={id => onSwapSection('traffic', id)}
            onSave={() => onSaveTab('traffic')}
            onSaveAs={(n, d) => onSaveAsTab('traffic', n, d)}
            onReset={() => onResetTab('traffic')}
            onDelete={() => onDeleteTab('traffic')}
          />
          {trafDraft && subDraft && (
            <TrafficTab data={trafDraft} subscribers={subDraft} onChange={setTrafDraft} />
          )}
        </TabsContent>

        <TabsContent value="userPlane" className="space-y-3 mt-3">
          <SectionHeaderStrip
            label="User Plane"
            sections={upList}
            activeId={profile.sectionIds.userPlane}
            isDirty={dirty.userPlane}
            onSelect={id => onSwapSection('userPlane', id)}
            onSave={() => onSaveTab('userPlane')}
            onSaveAs={(n, d) => onSaveAsTab('userPlane', n, d)}
            onReset={() => onResetTab('userPlane')}
            onDelete={() => onDeleteTab('userPlane')}
          />
          {upDraft && <UserPlaneTab data={upDraft} onChange={setUpDraft} />}
        </TabsContent>

        <TabsContent value="channel" className="space-y-3 mt-3">
          <SectionHeaderStrip
            label="Channel"
            sections={chanList}
            activeId={profile.sectionIds.channel}
            isDirty={dirty.channel}
            onSelect={id => onSwapSection('channel', id)}
            onSave={() => onSaveTab('channel')}
            onSaveAs={(n, d) => onSaveAsTab('channel', n, d)}
            onReset={() => onResetTab('channel')}
            onDelete={() => onDeleteTab('channel')}
          />
          {chanDraft && cellDraft && subDraft && (
            <ChannelTab
              data={chanDraft}
              cellData={cellDraft}
              subscribers={subDraft}
              onChange={setChanDraft}
            />
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-3 mt-3">
          <SectionHeaderStrip
            label="Settings"
            sections={setList}
            activeId={profile.sectionIds.settings}
            isDirty={dirty.settings}
            onSelect={id => onSwapSection('settings', id)}
            onSave={() => onSaveTab('settings')}
            onSaveAs={(n, d) => onSaveAsTab('settings', n, d)}
            onReset={() => onResetTab('settings')}
            onDelete={() => onDeleteTab('settings')}
          />
          {setDraft && <SettingsTab data={setDraft} onChange={setSetDraft} />}
        </TabsContent>
      </Tabs>

      <UeCfgLoaderDialog
        open={loaderOpen}
        onClose={() => setLoaderOpen(false)}
        onImported={(id) => { selectProfile(id); }}
      />

      <ApplyDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        baseline={readLastApplied(profile.name)}
        current={materializedFromDrafts}
        profileName={profile.name}
      />
    </div>
  );
}

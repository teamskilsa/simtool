// components/ScenarioCreator/useModuleConfig.ts
//
// Form state for the scenario creator/editor.
//
// Two bugs this replaces:
//   1. `initialData` was threaded down from the Edit dialog and then never
//      read, so Edit always opened a blank form.
//   2. moduleConfigs only gained an entry when the user *touched* a row, so
//      a module left at its defaults contributed nothing on save. Combined
//      with the API's shallow-merge PUT, saving an edit wiped the scenario's
//      module list. Rows are now seeded from the topology up front.
import { useEffect, useMemo, useState } from 'react';
import { TOPOLOGY_OPTIONS } from './constants';

export interface ModuleConfigEntry {
  moduleId: string;
  enabled: boolean;
  configId: string;
  ipAddress: string;
  isCustomIp: boolean;
  systemId?: string;
}

export interface ScenarioFormState {
  name: string;
  topology: string;
  system?: { id: string; name: string; host: string; port: string };
  ipConfig: Record<string, string | undefined>;
  moduleConfigs: Record<string, ModuleConfigEntry>;
}

const modulesFor = (topology: string): string[] =>
  (TOPOLOGY_OPTIONS.find(t => t.id === topology)?.modules as readonly string[] | undefined)
    ? [...(TOPOLOGY_OPTIONS.find(t => t.id === topology)!.modules as readonly string[])]
    : [];

const blankEntry = (moduleId: string): ModuleConfigEntry => ({
  moduleId,
  enabled: true,
  configId: '',
  ipAddress: '',
  isCustomIp: false,
});

/**
 * Seed a row for every module in the topology, then overlay whatever the
 * scenario already had. Seeding matters: a module the user never clicks
 * still has to appear in the saved scenario, otherwise the executor has
 * nothing to deploy for it.
 */
function buildModuleConfigs(
  topology: string,
  saved: unknown,
  previous: Record<string, ModuleConfigEntry> = {},
): Record<string, ModuleConfigEntry> {
  const out: Record<string, ModuleConfigEntry> = {};
  for (const moduleId of modulesFor(topology)) {
    // Carry over the user's in-progress edits when the topology changes so
    // switching callbox -> two-core-callbox doesn't discard the enb pick.
    out[moduleId] = previous[moduleId]
      ? { ...blankEntry(moduleId), ...previous[moduleId], moduleId }
      : blankEntry(moduleId);
  }

  // Saved rows come back as an array (that's the on-disk shape); older
  // records may be an object keyed by moduleId.
  const rows: any[] = Array.isArray(saved)
    ? saved
    : saved && typeof saved === 'object'
      ? Object.entries(saved).map(([moduleId, v]) => ({ moduleId, ...(v as object) }))
      : [];

  for (const row of rows) {
    const moduleId = row?.moduleId ?? row?.module;
    if (!moduleId) continue;
    out[moduleId] = {
      ...blankEntry(moduleId),
      ...out[moduleId],
      ...row,
      moduleId,
      enabled: row.enabled ?? true,
      configId: row.configId ?? '',
      ipAddress: row.ipAddress ?? '',
      isCustomIp: row.isCustomIp ?? false,
    };
  }

  return out;
}

function hydrate(initialData?: any): ScenarioFormState {
  const topology = initialData?.topology ?? '';
  return {
    name: initialData?.name ?? '',
    topology,
    system: initialData?.system,
    ipConfig: initialData?.ipConfig ?? {},
    moduleConfigs: buildModuleConfigs(topology, initialData?.moduleConfigs),
  };
}

export function useModuleConfig(initialData?: any) {
  const [formState, setFormState] = useState<ScenarioFormState>(() => hydrate(initialData));

  // Re-hydrate when the dialog is pointed at a different scenario. Keyed on
  // id (not the object) so re-renders don't clobber in-progress typing.
  const initialId = initialData?.id;
  useEffect(() => {
    setFormState(hydrate(initialData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  const updateFormState = (updates: Partial<ScenarioFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  /** Changing topology reseeds the module rows for the new module set. */
  const setTopology = (topology: string) => {
    setFormState(prev => ({
      ...prev,
      topology,
      moduleConfigs: buildModuleConfigs(topology, null, prev.moduleConfigs),
    }));
  };

  const updateModuleConfig = (moduleId: string, updates: Partial<ModuleConfigEntry>) => {
    setFormState(prev => ({
      ...prev,
      moduleConfigs: {
        ...prev.moduleConfigs,
        [moduleId]: { ...blankEntry(moduleId), ...prev.moduleConfigs[moduleId], ...updates },
      },
    }));
  };

  /** Modules of the current topology, in execution order. */
  const modules = useMemo(() => modulesFor(formState.topology), [formState.topology]);

  return { formState, updateFormState, setTopology, updateModuleConfig, modules };
}

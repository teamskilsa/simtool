// ConfigList/actions/configActions.ts

import { ConfigItem } from '../../../types';
import { groupService } from '../../../services/groups.service';
import { configsService } from '../../../services/configs.service';

/**
 * Build a unique "copy" name from an existing config name. Strips a single
 * trailing extension, appends " (copy)" or " (copy N)" to avoid collisions.
 */
function buildCopyName(original: string, taken: Set<string>): string {
  const m = original.match(/^(.*?)(\.[a-z0-9]+)?$/i);
  const base = m?.[1] ?? original;
  const ext = m?.[2] ?? '';
  let candidate = `${base} (copy)${ext}`;
  let i = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} (copy ${i})${ext}`;
    i++;
  }
  return candidate;
}

export const configActions = {
  handleDelete: async (
    configId: string,
    onDelete: (id: string) => void,
    setSelectedConfigs: (configs: Set<string>) => void
  ) => {
    onDelete(configId);
    setSelectedConfigs(prev => {
      const next = new Set(prev);
      next.delete(configId);
      return next;
    });
  },

  handleBulkDelete: async (
    selectedConfigs: Set<string>,
    onDelete: (id: string) => void,
    setSelectedConfigs: (configs: Set<string>) => void
  ) => {
    for (const id of selectedConfigs) {
      await configActions.handleDelete(id, onDelete, setSelectedConfigs);
    }
  },

  /**
   * Duplicate a single config. POSTs a new ConfigItem with a fresh name
   * to /api/configs (via configsService.importConfig — same code path as
   * Save / Import) so groups, builder metadata, and content all carry over.
   */
  handleDuplicate: async (
    configId: string,
    configs: ConfigItem[],
    userId: string,
    loadConfigs: () => Promise<void>,
  ): Promise<ConfigItem | null> => {
    const source = configs.find(c => c.id === configId);
    if (!source || !source.content) return null;
    const taken = new Set(configs.map(c => c.name.toLowerCase()));
    const newName = buildCopyName(source.name, taken);
    const created = await configsService.importConfig({
      // Storage layer uses name as id; let id := name so the new file shows up
      // in the list immediately without colliding with the source.
      id: newName,
      name: newName,
      module: source.module,
      content: source.content,
      path: source.path?.replace(source.name, newName),
      size: source.content.length,
    } as ConfigItem, userId);
    await loadConfigs();
    return created;
  },

  /**
   * Duplicate every config in the selection set. Returns the count duplicated.
   */
  handleBulkDuplicate: async (
    selectedConfigs: Set<string>,
    configs: ConfigItem[],
    userId: string,
    loadConfigs: () => Promise<void>,
    setSelectedConfigs: (configs: Set<string>) => void,
  ): Promise<number> => {
    // Snapshot the names taken so collisions are detected across the batch
    let taken = new Set(configs.map(c => c.name.toLowerCase()));
    let count = 0;
    for (const id of selectedConfigs) {
      const source = configs.find(c => c.id === id);
      if (!source || !source.content) continue;
      const newName = buildCopyName(source.name, taken);
      taken.add(newName.toLowerCase());
      await configsService.importConfig({
        id: newName,
        name: newName,
        module: source.module,
        content: source.content,
        path: source.path?.replace(source.name, newName),
        size: source.content.length,
      } as ConfigItem, userId);
      count++;
    }
    await loadConfigs();
    setSelectedConfigs(new Set());
    return count;
  },

  handleGroupAssign: async (
    userId: string,
    groupId: string,
    configId: string,
    loadConfigs: () => Promise<void>,
    onSuccess: () => void,
    onError: (error: Error) => void
  ) => {
    try {
      await groupService.addConfigToGroup(userId, groupId, configId);
      await loadConfigs();
      onSuccess();
    } catch (error) {
      onError(error as Error);
    }
  }
};
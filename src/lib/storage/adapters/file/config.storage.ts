// src/lib/storage/adapters/file/config.storage.ts
//
// File-backed config storage. Configs are raw Amarisoft .cfg text stored at
// data/users/<owner>/configs/private/<module>/<name>; the file name is the id.
import path from 'path';
import fs from 'fs/promises';
import { IConfigStorage } from '../../storage.interface';
import { StoragePathResolver, type ModuleType } from '../../config';
import { StoredConfig, StorageResult, StorageQuery } from '../../storage.types';
import { FileSystemHelper } from '../utils';

const MODULES: ModuleType[] = ['enb', 'gnb', 'ims', 'mme', 'ue', 'ue_db'];

type NewConfig = Omit<StoredConfig, 'id' | 'createdAt' | 'updatedAt'>;

function fail<T>(code: string, message: string, details?: unknown): StorageResult<T> {
  return { success: false, error: { code, message, details } };
}

function isConfigFile(file: string): boolean {
  // Any plausible Amarisoft cfg wrapper; skips hidden files and .bak etc.
  const lower = file.toLowerCase();
  return !file.startsWith('.')
    && (lower.endsWith('.cfg') || lower.endsWith('.conf') || lower.endsWith('.json') || lower.endsWith('.txt'));
}

export class FileConfigStorage implements IConfigStorage {
  // A Mongo `Collection` branch used to live here too. It was unreachable:
  // StorageAdapter refuses NEXT_PUBLIC_STORAGE_TYPE=mongodb before it ever
  // constructs this class.
  constructor(private readonly pathResolver: StoragePathResolver) {}

  private moduleDir(ownerId: string, module: string): string {
    return path.join(this.pathResolver.getUsersPath(), ownerId, 'configs', 'private', module);
  }

  async create(data: NewConfig): Promise<StorageResult<StoredConfig>> {
    try {
      const moduleDir = this.moduleDir(data.sharing.ownerId, data.module);
      await FileSystemHelper.ensureDir(moduleDir);

      // Keep the original file name — deploy copies it to the box verbatim.
      await fs.writeFile(path.join(moduleDir, data.name), data.content, 'utf8');

      const now = new Date();
      return {
        success: true,
        data: {
          ...data,
          id: data.name,
          size: data.content.length,
          isServerConfig: data.isServerConfig ?? true,
          versions: data.versions ?? [],
          status: 'active',
          createdAt: now,
          updatedAt: now,
          modifiedAt: now,
          updatedBy: data.createdBy,
        },
      };
    } catch (error) {
      console.error('Create error:', error);
      return fail('CREATE_ERROR', 'Failed to create config', error);
    }
  }

  /**
   * Create many configs in one call. Declared on IConfigStorage and called
   * from storage.service.ts, but never implemented — those call sites threw
   * "bulkCreate is not a function". Sequential on purpose so a failure stops
   * at the config that caused it.
   */
  async bulkCreate(configs: NewConfig[]): Promise<StorageResult<StoredConfig[]>> {
    const created: StoredConfig[] = [];
    for (const cfg of configs) {
      const result = await this.create(cfg);
      if (!result.success || !result.data) {
        return fail('BULK_CREATE_FAILED', `bulkCreate failed on "${cfg.name}"`, result.error);
      }
      created.push(result.data);
    }
    return { success: true, data: created };
  }

  /**
   * Configs are raw .cfg text, not JSON. This used to locate the entry via
   * list() and then readJSON() the file, which threw on every real config —
   * get() could not succeed. list() already carries the content.
   */
  async get(id: string): Promise<StorageResult<StoredConfig>> {
    const listed = await this.list();
    if (!listed.success) {
      return fail('GET_ERROR', listed.error?.message ?? 'Failed to list configurations');
    }
    const config = (listed.data ?? []).find(c => c.id === id);
    return config
      ? { success: true, data: config }
      : fail('NOT_FOUND', `Configuration not found: ${id}`);
  }

  async list(query?: StorageQuery): Promise<StorageResult<StoredConfig[]>> {
    try {
      const userId = query?.userId || 'admin';
      let configs: StoredConfig[] = [];

      for (const module of MODULES) {
        const modulePath = this.moduleDir(userId, module);
        let files: string[];
        try {
          files = await fs.readdir(modulePath);
        } catch {
          continue; // module directory doesn't exist
        }

        for (const file of files) {
          if (!isConfigFile(file)) continue;
          const filePath = path.join(modulePath, file);
          try {
            const [content, stats] = await Promise.all([
              fs.readFile(filePath, 'utf8'),
              fs.stat(filePath),
            ]);
            const config: StoredConfig = {
              id: file,
              name: file,
              module,
              content,
              path: filePath,
              size: stats.size,
              isServerConfig: true,
              createdAt: stats.birthtime,
              updatedAt: stats.mtime,
              modifiedAt: stats.mtime,
              createdBy: { id: userId, username: 'System' },
              updatedBy: { id: userId, username: 'System' },
              metadata: {
                version: 1,
                tags: [],
                isTemplate: false,
                visibility: 'private',
                path: filePath,
                checksum: '',
                description: '',
              },
              versions: [],
              sharing: { ownerId: userId, sharedWith: [] },
              status: 'active',
            };
            // The query used to be ignored apart from userId, so
            // getConfigsByModule() returned every module's configs.
            if (this.matchesQuery(config, query)) configs.push(config);
          } catch (err) {
            console.error(`Error reading config ${file}:`, err);
          }
        }
      }

      if (query?.offset) configs = configs.slice(query.offset);
      if (query?.limit) configs = configs.slice(0, query.limit);
      return { success: true, data: configs };
    } catch (error) {
      console.error('List error:', error);
      return fail('LIST_ERROR', 'Failed to list configs', error);
    }
  }

  /**
   * Called by ConfigStorageService.saveConfig for every save of an existing
   * config, but never implemented — saving an edited config threw
   * "update is not a function". Content is written back to the same file.
   * The id is the file name, so renaming or moving modules is not done here.
   */
  async update(id: string, data: Partial<StoredConfig>): Promise<StorageResult<StoredConfig>> {
    try {
      const current = await this.get(id);
      if (!current.success || !current.data) {
        return fail('NOT_FOUND', `Configuration not found: ${id}`);
      }
      const existing = current.data;
      const content = data.content ?? existing.content;

      const filePath = path.join(
        this.moduleDir(existing.sharing?.ownerId || 'admin', existing.module),
        existing.name,
      );
      await fs.writeFile(filePath, content, 'utf8');

      const now = new Date();
      return {
        success: true,
        data: {
          ...existing,
          ...data,
          id: existing.id,
          name: existing.name,
          module: existing.module,
          path: existing.path,
          content,
          size: content.length,
          createdAt: existing.createdAt,
          updatedAt: now,
          modifiedAt: now,
        },
      };
    } catch (error) {
      console.error('Update error:', error);
      return fail('UPDATE_ERROR', 'Failed to update config', error);
    }
  }

  async delete(id: string): Promise<StorageResult<void>> {
    try {
      // Search every module directory for the file.
      for (const module of MODULES) {
        const modulePath = this.moduleDir('admin', module);
        let files: string[];
        try {
          files = await fs.readdir(modulePath);
        } catch {
          continue; // directory doesn't exist
        }
        if (files.includes(id)) {
          await fs.unlink(path.join(modulePath, id));
          return { success: true };
        }
      }
      return fail('NOT_FOUND', 'Configuration file not found');
    } catch (error) {
      console.error('Delete error:', error);
      return fail('DELETE_ERROR', 'Failed to delete config', error);
    }
  }

  private matchesQuery(config: StoredConfig, query?: StorageQuery): boolean {
    if (!query) return true;

    if (query.module && config.module !== query.module) return false;
    if (query.userId && config.sharing.ownerId !== query.userId) return false;
    if (query.status && config.status !== query.status) return false;
    if (query.name) {
      const matches = typeof query.name === 'string'
        ? config.name.toLowerCase().includes(query.name.toLowerCase())
        : query.name.test(config.name);
      if (!matches) return false;
    }
    if (query.createdAfter && new Date(config.createdAt) < query.createdAfter) return false;
    if (query.updatedAfter && new Date(config.updatedAt) < query.updatedAfter) return false;

    return true;
  }
}

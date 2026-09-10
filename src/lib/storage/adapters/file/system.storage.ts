// src/lib/storage/adapters/file/system.storage.ts

import path from 'path';
import { ISystemStorage } from '../../storage.interface';
import { StoragePathResolver } from '../../config';
import {
  SystemConfig,
  StorageQuery,
  StorageResult,
  IndexEntry,
} from '../../storage.types';
import { FileSystemHelper } from '../utils';

function fail<T>(code: string, error: unknown, fallback: string): StorageResult<T> {
  return {
    success: false,
    error: { code, message: error instanceof Error ? error.message : fallback },
  };
}

export class FileSystemStorage implements ISystemStorage {
  constructor(private readonly pathResolver: StoragePathResolver) {}

  async create(data: Omit<SystemConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<SystemConfig>> {
    try {
      const id = FileSystemHelper.generateId();
      const now = new Date();
      const system: SystemConfig = {
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
        metadata: {
          ...data.metadata,
          failedConnections: 0
        }
      };

      await FileSystemHelper.writeJSON(this.getSystemPath(system.id), system);
      await this.updateIndex(system);

      return { success: true, data: system };
    } catch (error) {
      return fail('CREATE_ERROR', error, 'Failed to create system');
    }
  }

  async get(id: string): Promise<StorageResult<SystemConfig>> {
    try {
      const system = await FileSystemHelper.readJSON<SystemConfig>(this.getSystemPath(id));
      return { success: true, data: system };
    } catch (error) {
      return fail('GET_ERROR', error, 'Failed to get system');
    }
  }

  async list(query?: StorageQuery): Promise<StorageResult<SystemConfig[]>> {
    try {
      const systemsDir = this.pathResolver.getSystemsPath();
      const files = await FileSystemHelper.listFiles(systemsDir);
      const systems: SystemConfig[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const system = await FileSystemHelper.readJSON<SystemConfig>(path.join(systemsDir, file));
          if (this.matchesQuery(system, query)) {
            systems.push(system);
          }
        }
      }

      return { success: true, data: systems };
    } catch (error) {
      return fail('LIST_ERROR', error, 'Failed to list systems');
    }
  }

  /**
   * updateConnection() below has always called this, and the interface
   * requires it, but it did not exist — recording a connection result threw.
   */
  async update(id: string, data: Partial<SystemConfig>): Promise<StorageResult<SystemConfig>> {
    try {
      const current = await this.get(id);
      if (!current.success || !current.data) {
        throw new Error(`System not found: ${id}`);
      }
      const updated: SystemConfig = {
        ...current.data,
        ...data,
        id: current.data.id,
        createdAt: current.data.createdAt,
        updatedAt: new Date(),
      };
      await FileSystemHelper.writeJSON(this.getSystemPath(id), updated);
      await this.updateIndex(updated);
      return { success: true, data: updated };
    } catch (error) {
      return fail('UPDATE_ERROR', error, 'Failed to update system');
    }
  }

  async delete(id: string): Promise<StorageResult<void>> {
    try {
      await FileSystemHelper.deleteFile(this.getSystemPath(id));
      await this.removeFromIndex(id);
      return { success: true };
    } catch (error) {
      return fail('DELETE_ERROR', error, 'Failed to delete system');
    }
  }

  async getActive(): Promise<StorageResult<SystemConfig[]>> {
    const listed = await this.list();
    if (!listed.success) return listed;
    return { success: true, data: (listed.data ?? []).filter(s => s.status === 'active') };
  }

  async updateStatus(id: string, status: SystemConfig['status']): Promise<StorageResult<SystemConfig>> {
    return this.update(id, { status });
  }

  async updateConnection(id: string, success: boolean): Promise<StorageResult<SystemConfig>> {
    try {
      const currentSystem = await this.get(id);
      if (!currentSystem.success || !currentSystem.data) {
        throw new Error(`System not found: ${id}`);
      }

      const system = currentSystem.data;
      system.metadata.lastConnection = new Date();
      if (!success) {
        system.metadata.failedConnections++;
      } else {
        system.metadata.failedConnections = 0;
      }

      return await this.update(id, system);
    } catch (error) {
      return fail('UPDATE_CONNECTION_ERROR', error, 'Failed to update connection');
    }
  }

  private getSystemPath(id: string): string {
    return path.join(this.pathResolver.getSystemsPath(), `${id}.json`);
  }

  private async readIndex(): Promise<IndexEntry[]> {
    const indexPath = this.pathResolver.getIndexPath('systems');
    if (!await FileSystemHelper.fileExists(indexPath)) return [];
    try {
      return await FileSystemHelper.readJSON<IndexEntry[]>(indexPath);
    } catch {
      return []; // a corrupt index is rebuilt by StorageAdapter.rebuildIndexes
    }
  }

  /** Upsert this system's entry, in the same shape rebuildSystemIndex writes.
   *  create() has always called this; it was never defined. */
  private async updateIndex(system: SystemConfig): Promise<void> {
    const entries = (await this.readIndex()).filter(e => e.id !== system.id);
    entries.push({
      id: system.id,
      type: 'system',
      path: this.getSystemPath(system.id),
      metadata: { name: system.name, status: system.status, lastUpdated: system.updatedAt },
      lastUpdated: new Date(system.updatedAt),
    });
    await FileSystemHelper.writeJSON(this.pathResolver.getIndexPath('systems'), entries);
  }

  private async removeFromIndex(id: string): Promise<void> {
    const entries = await this.readIndex();
    await FileSystemHelper.writeJSON(
      this.pathResolver.getIndexPath('systems'),
      entries.filter(e => e.id !== id),
    );
  }

  private matchesQuery(system: SystemConfig, query?: StorageQuery): boolean {
    if (!query) return true;
    if (query.name) {
      const matches = typeof query.name === 'string'
        ? system.name.toLowerCase().includes(query.name.toLowerCase())
        : query.name.test(system.name);
      if (!matches) return false;
    }
    if (query.createdAfter && new Date(system.createdAt) < query.createdAfter) return false;
    if (query.updatedAfter && new Date(system.updatedAt) < query.updatedAfter) return false;
    return true;
  }
}

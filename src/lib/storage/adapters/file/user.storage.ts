// src/lib/storage/adapters/file/user.storage.ts
//
// One preferences.json per user, at data/users/<userId>/preferences.json.

import path from 'path';
import { IUserPreferencesStorage } from '../../storage.interface';
import { StoragePathResolver } from '../../config';
import {
  UserPreferences,
  StorageQuery,
  StorageResult
} from '../../storage.types';
import { FileSystemHelper } from '../utils';

const DEFAULT_CUSTOMIZATION: UserPreferences['customization'] = {
  editorFontSize: 14,
  editorTheme: 'default',
  showLineNumbers: true,
};

function fail<T>(code: string, error: unknown, fallback: string): StorageResult<T> {
  return {
    success: false,
    error: { code, message: error instanceof Error ? error.message : fallback },
  };
}

export class FileUserStorage implements IUserPreferencesStorage {
  constructor(private readonly pathResolver: StoragePathResolver) {}

  async create(data: Omit<UserPreferences, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<UserPreferences>> {
    try {
      const now = new Date();
      const preferences: UserPreferences = {
        ...data,
        id: FileSystemHelper.generateId(),
        createdAt: now,
        updatedAt: now,
        // Defaults first, then the caller's values. The old literal listed
        // each default and then spread a fully-typed customization over the
        // top, so the defaults could never apply.
        customization: { ...DEFAULT_CUSTOMIZATION, ...data.customization },
      };

      await FileSystemHelper.writeJSON(this.getUserPreferencesPath(preferences.userId), preferences);
      return { success: true, data: preferences };
    } catch (error) {
      return fail('CREATE_ERROR', error, 'Failed to create preferences');
    }
  }

  async getByUserId(userId: string): Promise<StorageResult<UserPreferences>> {
    try {
      const preferences = await FileSystemHelper.readJSON<UserPreferences>(this.getUserPreferencesPath(userId));
      return { success: true, data: preferences };
    } catch (error) {
      return fail('GET_ERROR', error, 'Failed to get preferences');
    }
  }

  async updateByUserId(userId: string, data: Partial<UserPreferences>): Promise<StorageResult<UserPreferences>> {
    try {
      const current = await this.getByUserId(userId);
      if (!current.success || !current.data) {
        throw new Error(`Preferences not found for user: ${userId}`);
      }

      const updated: UserPreferences = {
        ...current.data,
        ...data,
        updatedAt: new Date()
      };

      await FileSystemHelper.writeJSON(this.getUserPreferencesPath(userId), updated);
      return { success: true, data: updated };
    } catch (error) {
      return fail('UPDATE_ERROR', error, 'Failed to update preferences');
    }
  }

  // ── Generic operations required by IStorageOperations ──────────────────
  // Preferences are addressed by user, so these resolve an id to its user
  // first. None of them existed, so the class did not satisfy its interface.

  async get(id: string): Promise<StorageResult<UserPreferences>> {
    const direct = await this.getByUserId(id);
    if (direct.success) return direct;
    const listed = await this.list();
    const match = (listed.data ?? []).find(p => p.id === id);
    return match ? { success: true, data: match } : fail('NOT_FOUND', null, `Preferences not found: ${id}`);
  }

  async update(id: string, data: Partial<UserPreferences>): Promise<StorageResult<UserPreferences>> {
    const found = await this.get(id);
    if (!found.success || !found.data) return found;
    return this.updateByUserId(found.data.userId, data);
  }

  async delete(id: string): Promise<StorageResult<void>> {
    try {
      const found = await this.get(id);
      if (!found.success || !found.data) return fail('NOT_FOUND', null, `Preferences not found: ${id}`);
      await FileSystemHelper.deleteFile(this.getUserPreferencesPath(found.data.userId));
      return { success: true };
    } catch (error) {
      return fail('DELETE_ERROR', error, 'Failed to delete preferences');
    }
  }

  async list(query?: StorageQuery): Promise<StorageResult<UserPreferences[]>> {
    try {
      const users = await FileSystemHelper.listFiles(this.pathResolver.getUsersPath());
      const all: UserPreferences[] = [];
      for (const userId of users) {
        if (query?.userId && query.userId !== userId) continue;
        const prefPath = this.getUserPreferencesPath(userId);
        if (!await FileSystemHelper.fileExists(prefPath)) continue;
        try {
          all.push(await FileSystemHelper.readJSON<UserPreferences>(prefPath));
        } catch {
          // unreadable preferences file — skip rather than fail the listing
        }
      }
      return { success: true, data: all };
    } catch (error) {
      return fail('LIST_ERROR', error, 'Failed to list preferences');
    }
  }

  private getUserPreferencesPath(userId: string): string {
    return path.join(this.pathResolver.getUserPath(userId), 'preferences.json');
  }
}

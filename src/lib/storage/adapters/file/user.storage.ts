// src/lib/storage/adapters/file/user.storage.ts

import { IUserPreferencesStorage } from '../../storage.interface';
import { StoragePathResolver } from '../../config';
import { 
  UserPreferences, 
  StorageQuery, 
  StorageResult 
} from '../../storage.types';
import { FileSystemHelper } from '../utils';

export class FileUserStorage implements IUserPreferencesStorage {
  private pathResolver: StoragePathResolver;
  
  constructor(pathResolver: StoragePathResolver) {
    this.pathResolver = pathResolver;
  }

  async create(data: Omit<UserPreferences, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<UserPreferences>> {
    try {
      const id = FileSystemHelper.generateId();
      const now = new Date();
      const preferences: UserPreferences = {
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
        customization: {
          editorFontSize: 14,
          editorTheme: 'default',
          showLineNumbers: true,
          ...data.customization
        }
      };

      const preferencesPath = this.getUserPreferencesPath(preferences.userId);
      await FileSystemHelper.writeJSON(preferencesPath, preferences);

      return { success: true, data: preferences };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create preferences'
        }
      };
    }
  }

  async getByUserId(userId: string): Promise<StorageResult<UserPreferences>> {
    try {
      const preferencesPath = this.getUserPreferencesPath(userId);
      const preferences = await FileSystemHelper.readJSON<UserPreferences>(preferencesPath);
      return { success: true, data: preferences };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'GET_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get preferences'
        }
      };
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

      const preferencesPath = this.getUserPreferencesPath(userId);
      await FileSystemHelper.writeJSON(preferencesPath, updated);

      return { success: true, data: updated };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update preferences'
        }
      };
    }
  }

  private getUserPreferencesPath(userId: string): string {
    return path.join(this.pathResolver.getUserPath(userId), 'preferences.json');
  }
}
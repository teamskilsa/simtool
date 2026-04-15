// src/modules/testConfig/services/storage.service.ts
import { ConfigItem, ModuleType } from '../types';
import { logger } from '../utils/logger';
import { getStorageAdapter } from '@/lib/storage';
import { StoredConfig } from '@/lib/storage/storage.types';

// Define storage directories/categories
const STORAGE_DIRECTORIES = {
  IMPORTED: 'imported',
  USER_CREATED: 'user-created',
  TEMPLATES: 'templates'
} as const;

type StorageDirectory = typeof STORAGE_DIRECTORIES[keyof typeof STORAGE_DIRECTORIES];

interface StorageMetadata {
  version: string;
  lastUpdated: string;
  userId: string;
  directories: Record<StorageDirectory, {
    count: number;
    lastUpdated: string;
  }>;
}

export class ConfigStorageService {
  private readonly storageAdapter = getStorageAdapter();

  async importConfigs(userId: string, configs: ConfigItem[]): Promise<void> {
      try {
          const configsToStore = configs.map(config => ({
              name: config.name,
              module: config.module,
              content: config.content,
              metadata: {
                  version: 1,
                  tags: ['imported'],
                  isTemplate: false,
                  visibility: 'private',
                  path: config.path || '',
                  checksum: '',
                  description: ''
              },
              sharing: {
                  ownerId: userId,
                  sharedWith: []
              },
              status: 'active',
              createdBy: {
                  id: userId,
                  username: 'system'
              },
              updatedBy: {
                  id: userId,
                  username: 'system'
              }
          }));

          const result = await this.storageAdapter.configs.bulkCreate(configsToStore);

          if (!result.success) {
              throw new Error(result.error?.message || 'Failed to import configurations');
          }

          logger.info(`Imported ${configs.length} configurations for user ${userId}`);
      } catch (error) {
          logger.error('Failed to import configs:', error);
          throw new Error('Failed to import configurations');
      }
  }
  // Convert ConfigItem to StoredConfig format
  private toStoredConfig(config: ConfigItem, userId: string): Omit<StoredConfig, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      name: config.name,
      module: config.module,
      content: config.content,
      metadata: {
        version: 1,
        tags: [],
        isTemplate: false,
        visibility: 'private',
        path: config.path || '',
        checksum: '', // Will be calculated by storage adapter
        description: ''
      },
      versions: [],
      sharing: {
        ownerId: userId,
        sharedWith: []
      },
      status: 'active',
      createdBy: {
        id: userId,
        username: config.createdBy || 'system'
      },
      updatedBy: {
        id: userId,
        username: config.createdBy || 'system'
      }
    };
  }

  // Convert StoredConfig back to ConfigItem format
  private toConfigItem(storedConfig: StoredConfig): ConfigItem {
    return {
      id: storedConfig.id,
      name: storedConfig.name,
      content: storedConfig.content,
      module: storedConfig.module,
      createdBy: storedConfig.createdBy.username,
      createdAt: storedConfig.createdAt,
      modifiedAt: storedConfig.updatedAt,
      path: storedConfig.metadata.path,
      isImported: storedConfig.metadata.tags?.includes('imported') || false
    };
  }

  async getConfigs(userId: string): Promise<ConfigItem[]> {
    try {
      const result = await this.storageAdapter.configs.list({
        userId: userId
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch configurations');
      }

      return result.data.map(config => this.toConfigItem(config));
    } catch (error) {
      logger.error('Failed to get configs:', error);
      return [];
    }
  }

  async importConfigs(userId: string, configs: ConfigItem[]): Promise<void> {
    try {
      const configsToStore = configs.map(config => ({
        ...this.toStoredConfig(config, userId),
        metadata: {
          ...this.toStoredConfig(config, userId).metadata,
          tags: ['imported']
        }
      }));

      const result = await this.storageAdapter.configs.bulkCreate(configsToStore);

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to import configurations');
      }

      logger.info(`Imported ${configs.length} configurations for user ${userId}`);
    } catch (error) {
      logger.error('Failed to import configs:', error);
      throw new Error('Failed to import configurations');
    }
  }

  async saveConfig(userId: string, config: ConfigItem): Promise<void> {
    try {
      const storedConfig = this.toStoredConfig(config, userId);
      
      if (config.id) {
        // Update existing config
        const result = await this.storageAdapter.configs.update(config.id, storedConfig);
        if (!result.success) {
          throw new Error(result.error?.message || 'Failed to update configuration');
        }
      } else {
        // Create new config
        const result = await this.storageAdapter.configs.create(storedConfig);
        if (!result.success) {
          throw new Error(result.error?.message || 'Failed to save configuration');
        }
      }

      logger.info(`Saved configuration ${config.name}`);
    } catch (error) {
      logger.error('Failed to save config:', error);
      throw new Error('Failed to save configuration');
    }
  }

  async deleteConfig(userId: string, configId: string): Promise<void> {
    try {
      const result = await this.storageAdapter.configs.delete(configId);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete configuration');
      }

      logger.info(`Deleted configuration ${configId}`);
    } catch (error) {
      logger.error('Failed to delete config:', error);
      throw new Error('Failed to delete configuration');
    }
  }

  async getConfigsByModule(userId: string, module: ModuleType): Promise<ConfigItem[]> {
    try {
      const result = await this.storageAdapter.configs.list({
        userId: userId,
        module: module
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch configurations');
      }

      return result.data.map(config => this.toConfigItem(config));
    } catch (error) {
      logger.error('Failed to get configs by module:', error);
      return [];
    }
  }

  async getStorageStats(userId: string): Promise<StorageMetadata['directories']> {
    try {
      const configs = await this.getConfigs(userId);
      
      const directories = {
        [STORAGE_DIRECTORIES.IMPORTED]: {
          count: configs.filter(c => c.isImported).length,
          lastUpdated: new Date().toISOString()
        },
        [STORAGE_DIRECTORIES.USER_CREATED]: {
          count: configs.filter(c => !c.isImported).length,
          lastUpdated: new Date().toISOString()
        },
        [STORAGE_DIRECTORIES.TEMPLATES]: {
          count: 0, // Implement template counting if needed
          lastUpdated: new Date().toISOString()
        }
      };

      return directories;
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      throw new Error('Failed to get storage statistics');
    }
  }
}

export const configStorageService = new ConfigStorageService();
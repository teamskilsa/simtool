import path from 'path';
import fs from 'fs/promises';
import { IConfigStorage } from '../../storage.interface';
import { StoragePathResolver } from '../../config';
import { StoredConfig, StorageResult } from '../../storage.types';
import { FileSystemHelper } from '../utils';
import { Collection } from 'mongodb';

export class FileConfigStorage implements IConfigStorage {
  private pathResolver?: StoragePathResolver;
  private collection?: Collection;

  constructor(pathResolverOrCollection: StoragePathResolver | Collection) {
    if (pathResolverOrCollection instanceof StoragePathResolver) {
      this.pathResolver = pathResolverOrCollection;
    } else {
      this.collection = pathResolverOrCollection;
    }
  }

  async create(data: Omit<StoredConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<StoredConfig>> {
    try {
      console.log('Storage - Creating config:', {
        name: data.name,
        module: data.module,
        contentLength: data.content?.length
      });
  
      if (this.pathResolver) {
        // Create base config directory
        const moduleDir = path.join(
          this.pathResolver.getUsersPath(),
          data.sharing.ownerId,
          'configs',
          'private',
          data.module
        );
  
        await FileSystemHelper.ensureDir(moduleDir);
  
        // Create config file with original name
        const configPath = path.join(moduleDir, data.name);
        await fs.writeFile(configPath, data.content, 'utf8');
  
        const now = new Date();
        const config: StoredConfig = {
          id: data.name,
          name: data.name,
          module: data.module,
          content: data.content,
          path: data.path,
          size: data.content.length,
          isServerConfig: true,
          createdAt: now,
          updatedAt: now,
          metadata: data.metadata,
          sharing: data.sharing,
          status: 'active',
          createdBy: data.createdBy,
          updatedBy: data.createdBy
        };
  
        console.log('Storage - Config created:', configPath);
        return { success: true, data: config };
      }
  
      throw new Error('Storage not initialized');
    } catch (error) {
      console.error('Create error:', error);
      return { 
        success: false, 
        error: { message: 'Failed to create config' }
      };
    }
  }


  async get(id: string): Promise<StorageResult<StoredConfig>> {
    try {
      if (this.collection) {
        const config = await this.collection.findOne({ id });
        if (!config) {
          return {
            success: false,
            error: { message: 'Configuration not found' }
          };
        }
        return { success: true, data: config as StoredConfig };
      }

      if (!this.pathResolver) {
        throw new Error('PathResolver not initialized');
      }

      const listResult = await this.list();
      if (!listResult.success) {
        throw new Error('Failed to list configurations');
      }

      const config = listResult.data.find(c => c.id === id);
      if (!config) {
        return {
          success: false,
          error: { message: 'Configuration not found' }
        };
      }

      const configPath = path.join(this.getConfigDir(config), config.name);
      const configData = await FileSystemHelper.readJSON<StoredConfig>(configPath);
      return { success: true, data: configData };
    } catch (error) {
      console.error('Get error:', error);
      return {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Failed to get configuration' }
      };
    }
  }

  async list(query?: StorageQuery): Promise<StorageResult<StoredConfig[]>> {
    try {
      if (!this.pathResolver) {
        throw new Error('PathResolver not initialized');
      }

      const configs: StoredConfig[] = [];
      const userId = query?.userId || 'admin';
      const baseConfigPath = path.join(
        this.pathResolver.getUsersPath(),
        userId,
        'configs',
        'private'
      );

      const modules = ['enb', 'gnb', 'ims', 'mme', 'ue'];

      for (const module of modules) {
        const modulePath = path.join(baseConfigPath, module);
        
        try {
          const files = await fs.readdir(modulePath);
          
          for (const file of files) {
            // Accept .cfg, .conf, .json, .txt — any plausible Amarisoft cfg
            // wrapper. Excludes hidden files and obvious non-configs (.bak etc).
            const lower = file.toLowerCase();
            const isConfig = lower.endsWith('.cfg')
                          || lower.endsWith('.conf')
                          || lower.endsWith('.json')
                          || lower.endsWith('.txt');
            if (!isConfig || file.startsWith('.')) continue;

            const filePath = path.join(modulePath, file);
            try {
              const content = await fs.readFile(filePath, 'utf8');
              const stats = await fs.stat(filePath);
              
              configs.push({
                id: file,
                name: file,
                module: module,
                content: content,
                path: filePath,
                size: stats.size,
                isServerConfig: true,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                createdBy: {
                  id: userId,
                  username: 'System'
                },
                updatedBy: {
                  id: userId,
                  username: 'System'
                },
                metadata: {
                  version: 1,
                  tags: [],
                  isTemplate: false,
                  visibility: 'private',
                  path: filePath,
                  checksum: '',
                  description: ''
                },
                sharing: {
                  ownerId: userId,
                  sharedWith: []
                },
                status: 'active'
              });
            } catch (err) {
              console.error(`Error reading config ${file}:`, err);
            }
          }
        } catch (err) {
          // Module directory doesn't exist, skip it
          continue;
        }
      }

      return { success: true, data: configs };
    } catch (error) {
      console.error('List error:', error);
      return { success: false, error: { message: 'Failed to list configs' }};
    }
  }


  async delete(id: string): Promise<StorageResult<void>> {
    try {
      if (!this.pathResolver) {
        throw new Error('PathResolver not initialized');
      }

      console.log('Attempting to delete config:', id);

      // First try to find the file by searching all module directories
      const modules = ['enb', 'gnb', 'ims', 'mme', 'ue'];
      let foundPath = null;

      for (const module of modules) {
        const modulePath = path.join(
          this.pathResolver.getUsersPath(),
          'admin', // Default user
          'configs',
          'private',
          module
        );

        try {
          // Check if directory exists
          await fs.access(modulePath);
          const files = await fs.readdir(modulePath);
          
          if (files.includes(id)) {
            foundPath = path.join(modulePath, id);
            break;
          }
        } catch (err) {
          // Directory doesn't exist, continue to next module
          continue;
        }
      }

      if (!foundPath) {
        console.log('File not found for deletion:', id);
        return { 
          success: false, 
          error: { message: 'Configuration file not found' }
        };
      }

      console.log('Deleting file at path:', foundPath);
      await fs.unlink(foundPath);

      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      return { 
        success: false, 
        error: { message: 'Failed to delete config' }
      };
    }
  }

  private getConfigDir(config: StoredConfig): string {
    if (!this.pathResolver) throw new Error('PathResolver not initialized');
    
    // If sharing info is missing, use defaults
    const ownerId = config.sharing?.ownerId || 'admin';
    const visibility = config.metadata?.visibility || 'private';
    
    return path.join(
      this.pathResolver.getUsersPath(),
      ownerId,
      'configs',
      visibility === 'private' ? 'private' : 'shared',
      config.module.toLowerCase()
    );
  }

  private createSafeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async getUniqueFilePath(originalPath: string): Promise<string> {
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const baseName = path.basename(originalPath, ext);
    let finalPath = originalPath;
    let counter = 1;

    while (await FileSystemHelper.fileExists(finalPath)) {
      finalPath = path.join(dir, `${baseName}-${counter}${ext}`);
      counter++;
    }

    return finalPath;
  }

  private isValidConfigFile(filename: string): boolean {
    const validExtensions = ['.cfg', '.conf', '.json'];
    const ext = path.extname(filename).toLowerCase();
    return validExtensions.includes(ext);
  }

  private matchesQuery(config: StoredConfig, query?: StorageQuery): boolean {
    if (!query) return true;
  
    if (query.module && config.module !== query.module) return false;
    if (query.userId && config.sharing.ownerId !== query.userId) return false;
    if (query.name && !config.name.toLowerCase().includes(query.name.toLowerCase())) return false;
    if (query.createdAfter && new Date(config.createdAt) < query.createdAfter) return false;
    if (query.updatedAfter && new Date(config.updatedAt) < query.updatedAfter) return false;
  
    return true;
  }

  // ... other interface methods implementation
}
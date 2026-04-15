// src/lib/storage/adapters/file/system.storage.ts

import { ISystemStorage } from '../../storage.interface';
import { StoragePathResolver } from '../../config';
import { 
  SystemConfig, 
  StorageQuery, 
  StorageResult 
} from '../../storage.types';
import { FileSystemHelper } from '../utils';

export class FileSystemStorage implements ISystemStorage {
  private pathResolver: StoragePathResolver;
  
  constructor(pathResolver: StoragePathResolver) {
    this.pathResolver = pathResolver;
  }

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

      const systemPath = this.getSystemPath(system.id);
      await FileSystemHelper.writeJSON(systemPath, system);
      await this.updateIndex(system);

      return { success: true, data: system };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create system'
        }
      };
    }
  }

  async get(id: string): Promise<StorageResult<SystemConfig>> {
    try {
      const systemPath = this.getSystemPath(id);
      const system = await FileSystemHelper.readJSON<SystemConfig>(systemPath);
      return { success: true, data: system };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'GET_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get system'
        }
      };
    }
  }

  async list(query?: StorageQuery): Promise<StorageResult<SystemConfig[]>> {
    try {
      const systemsDir = this.pathResolver.getSystemsPath();
      const files = await FileSystemHelper.listFiles(systemsDir);
      const systems: SystemConfig[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const system = await FileSystemHelper.readJSON<SystemConfig>(
            path.join(systemsDir, file)
          );
          if (this.matchesQuery(system, query)) {
            systems.push(system);
          }
        }
      }

      return { success: true, data: systems };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'LIST_ERROR',
          message: error instanceof Error ? error.message : 'Failed to list systems'
        }
      };
    }
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

      await this.update(id, system);
      return { success: true, data: system };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'UPDATE_CONNECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update connection'
        }
      };
    }
  }

  private getSystemPath(id: string): string {
    return path.join(this.pathResolver.getSystemsPath(), `${id}.json`);
  }
}
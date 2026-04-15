// src/lib/storage/adapters/storage.adapter.ts

import { IStorageAdapter } from '../storage.interface';
import { StoragePathResolver, StorageConfig } from '../config';
import { FileConfigStorage, FileSystemStorage, FileUserStorage, FileAutomationStorage } from './file';
import { MongoClient } from 'mongodb';
import { FileSystemHelper } from './utils';
import { StorageResult } from '../storage.types';

export class StorageAdapter implements IStorageAdapter {
  public readonly configs: FileConfigStorage;
  public readonly systems: FileSystemStorage;
  public readonly preferences: FileUserStorage;
  public readonly automation: FileAutomationStorage;
  private pathResolver: StoragePathResolver;
  private mongoClient?: MongoClient;

  constructor(config: StorageConfig) {
    if (config.type === 'mongodb' && config.mongoUrl) {
      this.mongoClient = new MongoClient(config.mongoUrl);
      const db = this.mongoClient.db('test-configs');
      
      // Initialize MongoDB collections
      this.configs = new FileConfigStorage(db.collection('configs'));
      this.systems = new FileSystemStorage(db.collection('systems'));
      this.preferences = new FileUserStorage(db.collection('preferences'));
      this.automation = new FileAutomationStorage(db.collection('automation'));
    } else {
      // Initialize File System storage
      this.pathResolver = new StoragePathResolver(config);
      this.configs = new FileConfigStorage(this.pathResolver);
      this.systems = new FileSystemStorage(this.pathResolver);
      this.preferences = new FileUserStorage(this.pathResolver);
      this.automation = new FileAutomationStorage(this.pathResolver);
    }
  }

  async initialize(): Promise<void> {
    if (this.pathResolver) {
      // Ensure all required directories exist for file system storage
      await this.ensureStorageDirectories();
      // Initialize indexes
      await this.rebuildIndexes();
    } else if (this.mongoClient) {
      // Verify MongoDB connection
      await this.mongoClient.connect();
    }
  }

  private async ensureStorageDirectories() {
    const dirs = [
      this.pathResolver.getUsersPath(),
      this.pathResolver.getSystemsPath(),
      this.pathResolver.getPublicPath(),
      this.pathResolver.getAutomationPath(),
      this.pathResolver.getIndexPath(''),
      this.pathResolver.getTempPath()
    ];

    for (const dir of dirs) {
      await FileSystemHelper.ensureDir(dir);
    }
  }

  async cleanup(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
    if (this.pathResolver) {
      await FileSystemHelper.deleteDir(this.pathResolver.getTempPath());
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.initialize();
      return true;
    } catch {
      return false;
    }
  }

  async rebuildIndexes(): Promise<void> {
    if (this.pathResolver) {
      await Promise.all([
        this.rebuildConfigIndex(),
        this.rebuildSystemIndex(),
        this.rebuildAutomationIndex()
      ]);
    }
  }
  
  async backup(backupPath: string): Promise<StorageResult<string>> {
    try {
      const backupId = FileSystemHelper.generateId();
      const backupDir = path.join(backupPath, backupId);
      
      // Create backup directory
      await FileSystemHelper.ensureDir(backupDir);
      
      // Copy all data
      await this.copyDirectory(this.pathResolver.getBasePath(), backupDir);
      
      // Create backup metadata
      const metadata = {
        id: backupId,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      await FileSystemHelper.writeJSON(
        path.join(backupDir, 'backup-metadata.json'),
        metadata
      );
      
      return FileSystemHelper.createStorageResult(true, backupDir);
    } catch (error) {
      return FileSystemHelper.createStorageResult(false, undefined, error as Error);
    }
  }

  async restore(backupPath: string): Promise<StorageResult<void>> {
    try {
      // Validate backup
      if (!await FileSystemHelper.fileExists(backupPath)) {
        throw new Error('Backup not found');
      }

      // Verify backup metadata
      const metadataPath = path.join(backupPath, 'backup-metadata.json');
      if (!await FileSystemHelper.fileExists(metadataPath)) {
        throw new Error('Invalid backup: missing metadata');
      }

      // Clear current data
      await this.cleanup();
      
      // Restore from backup
      await this.copyDirectory(backupPath, this.pathResolver.getBasePath());
      
      // Reinitialize
      await this.initialize();
      
      return FileSystemHelper.createStorageResult(true);
    } catch (error) {
      return FileSystemHelper.createStorageResult(false, undefined, error as Error);
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await FileSystemHelper.ensureDir(dest);
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private async rebuildConfigIndex(): Promise<void> {
    const indexEntries: IndexEntry[] = [];
    const usersPath = this.pathResolver.getUsersPath();
    
    // Index user configurations
    const users = await FileSystemHelper.listFiles(usersPath);
    for (const userId of users) {
      const userConfigPath = path.join(usersPath, userId, 'configs');
      
      // Index private configs
      const privateConfigs = await this.indexConfigDirectory(
        path.join(userConfigPath, 'private'),
        userId,
        'private'
      );
      indexEntries.push(...privateConfigs);
      
      // Index shared configs
      const sharedConfigs = await this.indexConfigDirectory(
        path.join(userConfigPath, 'shared'),
        userId,
        'shared'
      );
      indexEntries.push(...sharedConfigs);
    }
    
    // Index public configurations
    const publicConfigs = await this.indexConfigDirectory(
      this.pathResolver.getPublicPath(),
      'system',
      'public'
    );
    indexEntries.push(...publicConfigs);

    // Write index
    await FileSystemHelper.writeJSON(
      this.pathResolver.getIndexPath('configs'),
      indexEntries
    );
  }

  private async rebuildSystemIndex(): Promise<void> {
    const systemsPath = this.pathResolver.getSystemsPath();
    const systems = await FileSystemHelper.listFiles(systemsPath);
    const indexEntries: IndexEntry[] = [];

    for (const systemFile of systems) {
      if (systemFile.endsWith('.json')) {
        const systemPath = path.join(systemsPath, systemFile);
        const system = await FileSystemHelper.readJSON(systemPath);
        indexEntries.push({
          id: system.id,
          type: 'system',
          path: systemPath,
          metadata: {
            name: system.name,
            status: system.status,
            lastUpdated: system.updatedAt
          },
          lastUpdated: new Date(system.updatedAt)
        });
      }
    }

    await FileSystemHelper.writeJSON(
      this.pathResolver.getIndexPath('systems'),
      indexEntries
    );
  }

  private async rebuildAutomationIndex(): Promise<void> {
    const automationPath = this.pathResolver.getAutomationPath();
    const suites = await FileSystemHelper.listFiles(automationPath);
    const indexEntries: IndexEntry[] = [];

    for (const suiteFile of suites) {
      if (suiteFile.endsWith('.json')) {
        const suitePath = path.join(automationPath, suiteFile);
        const suite = await FileSystemHelper.readJSON(suitePath);
        indexEntries.push({
          id: suite.id,
          type: 'suite',
          path: suitePath,
          metadata: {
            name: suite.name,
            lastRun: suite.schedule?.lastRun,
            status: suite.status
          },
          lastUpdated: new Date(suite.updatedAt)
        });
      }
    }

    await FileSystemHelper.writeJSON(
      this.pathResolver.getIndexPath('automation'),
      indexEntries
    );
  }

  private async indexConfigDirectory(
    dirPath: string,
    userId: string,
    visibility: 'private' | 'shared' | 'public'
  ): Promise<IndexEntry[]> {
    const indexEntries: IndexEntry[] = [];
    const files = await FileSystemHelper.listFiles(dirPath);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const configPath = path.join(dirPath, file);
        const config = await FileSystemHelper.readJSON(configPath);
        indexEntries.push({
          id: config.id,
          type: 'config',
          path: configPath,
          metadata: {
            name: config.name,
            module: config.module,
            version: config.metadata.version,
            visibility,
            userId
          },
          lastUpdated: new Date(config.updatedAt)
        });
      }
    }

    return indexEntries;
  }
}
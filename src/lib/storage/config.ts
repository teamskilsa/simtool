// src/lib/storage/config.ts

/**
 * Storage types supported by the application
 */
export type StorageType = 'file' | 'mongodb';

/**
 * Module types for configuration organization
 */
export type ModuleType = 'enb' | 'gnb' | 'mme' | 'ims' | 'ue_db' | 'ue';

/**
 * Storage configuration interface
 */
export interface StorageConfig {
  type: StorageType;
  basePath: string;
  mongoUrl?: string;
  indexes: {
    enabled: boolean;
    path: string;
  };
}

/**
 * Storage paths for different data categories
 */
export interface StoragePaths {
  users: string;
  systems: string;
  public: string;
  automation: string;
  remoteApi: string;
  indexes: string;
  temp: string;
}

// Helper to handle path joining in both server and client environments
const joinPath = (...parts: string[]): string => {
  if (typeof window === 'undefined') {
    return require('path').join(...parts);
  }
  return parts.join('/').replace(/\/+/g, '/');
};

// Helper to get the default base path based on environment
const getDefaultBasePath = () => {
  if (typeof window === 'undefined') {
    // Server-side: use process.cwd()
    const path = require('path');
    return path.join(process.cwd(), 'data');
  }
  // Client-side: use relative path
  return '/data';
};

/**
 * Default storage configuration
 */
const defaultConfig: StorageConfig = {
  type: (process.env.NEXT_PUBLIC_STORAGE_TYPE as StorageType) || 'file',
  basePath: process.env.NEXT_PUBLIC_STORAGE_PATH || getDefaultBasePath(),
  mongoUrl: process.env.MONGODB_URI,
  indexes: {
    enabled: true,
    path: '_indexes'
  }
};

/**
 * Path resolver for storage locations
 */
export class StoragePathResolver {
  private config: StorageConfig;
  private paths: StoragePaths;

  constructor(config: StorageConfig = defaultConfig) {
    this.config = config;
    this.paths = this.initializePaths();
  }

  private initializePaths(): StoragePaths {
    return {
      users: joinPath(this.config.basePath, 'users'),
      systems: joinPath(this.config.basePath, 'systems'),
      public: joinPath(this.config.basePath, 'public'),
      automation: joinPath(this.config.basePath, 'automation'),
      remoteApi: joinPath(this.config.basePath, 'remote-api'),
      indexes: joinPath(this.config.basePath, this.config.indexes.path),
      temp: joinPath(this.config.basePath, 'temp')
    };
  }

  /**
   * Get base path
   */
  getBasePath(): string {
    return this.config.basePath;
  }

  /**
   * Get users path
   */
  getUsersPath(): string {
    return this.paths.users;
  }

  /**
   * Get systems path
   */
  getSystemsPath(): string {
    return this.paths.systems;
  }

  /**
   * Get public path
   */
  getPublicPath(): string {
    return this.paths.public;
  }

  /**
   * Get automation path
   */
  getAutomationPath(): string {
    return this.paths.automation;
  }

  /**
   * Get temp path
   */
  getTempPath(): string {
    return this.paths.temp;
  }

  /**
   * Get index path
   */
  getIndexPath(indexType: 'configs' | 'users' | 'systems'): string {
    return joinPath(this.paths.indexes, `${indexType}.json`);
  }

  /**
   * Get user-specific configuration path
   */
  getUserConfigPath(userId: string, isPrivate: boolean = true): string {
    const privacy = isPrivate ? 'private' : 'shared';
    return joinPath(this.paths.users, userId, 'configs', privacy);
  }

  /**
   * Get user-specific module configuration path
   */
  getUserModuleConfigPath(userId: string, module: ModuleType, isPrivate: boolean = true): string {
    return joinPath(this.getUserConfigPath(userId, isPrivate), module);
  }

  /**
   * Get system configuration path
   */
  getSystemConfigPath(systemId: string): string {
    return joinPath(this.paths.systems, systemId);
  }

  /**
   * Get public configuration path
   */
  getPublicConfigPath(module: ModuleType): string {
    return joinPath(this.paths.public, module);
  }

  /**
   * Get automation suite path
   */
  getAutomationSuitePath(suiteId: string): string {
    return joinPath(this.paths.automation, suiteId);
  }

  /**
   * Check if running on server side
   */
  isServer(): boolean {
    return typeof window === 'undefined';
  }
}

// Create singleton instances based on environment
let storageResolver: StoragePathResolver;
let storageConfig: StorageConfig;

// Initialize singletons
const initializeStorage = () => {
  if (!storageResolver) {
    storageConfig = defaultConfig;
    storageResolver = new StoragePathResolver(storageConfig);
  }
};

// Initialize on both client and server
initializeStorage();

// Export singleton instances
export { storageResolver, storageConfig };
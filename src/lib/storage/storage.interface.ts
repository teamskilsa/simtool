// src/lib/storage/storage.interface.ts

import { ModuleType } from './config';
import { 
  StoredConfig, 
  SystemConfig, 
  UserPreferences, 
  AutomationSuite,
  TestRunResult,
  StorageQuery,
  StorageResult,
  ConfigVersion 
} from './storage.types';

/**
 * Base storage operations interface
 */
export interface IStorageOperations<T> {
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<T>>;
  get(id: string): Promise<StorageResult<T>>;
  update(id: string, data: Partial<T>): Promise<StorageResult<T>>;
  delete(id: string): Promise<StorageResult<void>>;
  list(query?: StorageQuery): Promise<StorageResult<T[]>>;
}

/**
 * Configuration specific storage operations
 */
export interface IConfigStorage extends IStorageOperations<StoredConfig> {
  // Version management
  createVersion(configId: string, version: Omit<ConfigVersion, 'createdAt'>): Promise<StorageResult<ConfigVersion>>;
  getVersion(configId: string, version: number): Promise<StorageResult<ConfigVersion>>;
  listVersions(configId: string): Promise<StorageResult<ConfigVersion[]>>;
  
  // Module specific operations
  getByModule(module: ModuleType): Promise<StorageResult<StoredConfig[]>>;
  
  // Sharing operations
  share(configId: string, userId: string, permission: 'read' | 'write'): Promise<StorageResult<void>>;
  unshare(configId: string, userId: string): Promise<StorageResult<void>>;
  
  // Template operations
  createTemplate(configId: string, name: string): Promise<StorageResult<StoredConfig>>;
  getTemplates(module: ModuleType): Promise<StorageResult<StoredConfig[]>>;
  
  // Bulk operations
  bulkCreate(configs: Array<Omit<StoredConfig, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StorageResult<StoredConfig[]>>;
  bulkUpdate(configs: Array<{ id: string; data: Partial<StoredConfig> }>): Promise<StorageResult<StoredConfig[]>>;
}

/**
 * User preferences storage operations
 */
export interface IUserPreferencesStorage extends IStorageOperations<UserPreferences> {
  getByUserId(userId: string): Promise<StorageResult<UserPreferences>>;
  updateByUserId(userId: string, data: Partial<UserPreferences>): Promise<StorageResult<UserPreferences>>;
}

/**
 * System configuration storage operations
 */
export interface ISystemStorage extends IStorageOperations<SystemConfig> {
  getActive(): Promise<StorageResult<SystemConfig[]>>;
  updateStatus(id: string, status: SystemConfig['status']): Promise<StorageResult<SystemConfig>>;
  updateConnection(id: string, success: boolean): Promise<StorageResult<SystemConfig>>;
}

/**
 * Automation suite storage operations
 */
export interface IAutomationStorage extends IStorageOperations<AutomationSuite> {
  // Suite management
  getByConfig(configId: string): Promise<StorageResult<AutomationSuite[]>>;
  updateSchedule(id: string, cron: string, enabled: boolean): Promise<StorageResult<AutomationSuite>>;
  
  // Test runs
  createRun(suiteId: string, run: Omit<TestRunResult, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<TestRunResult>>;
  getRuns(suiteId: string, limit?: number): Promise<StorageResult<TestRunResult[]>>;
  getLastRun(suiteId: string): Promise<StorageResult<TestRunResult>>;
}

/**
 * Main storage adapter interface combining all operations
 */
export interface IStorageAdapter {
  configs: IConfigStorage;
  preferences: IUserPreferencesStorage;
  systems: ISystemStorage;
  automation: IAutomationStorage;
  
  // Storage management operations
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  validateConnection(): Promise<boolean>;
  
  // Index operations
  rebuildIndexes(): Promise<void>;
  
  // Utility operations
  backup(path: string): Promise<StorageResult<string>>;
  restore(path: string): Promise<StorageResult<void>>;
}
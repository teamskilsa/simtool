// src/lib/storage/storage.types.ts

import { ModuleType } from './config';

/**
 * Base entity interface for all stored items
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    username: string;
  };
  updatedBy: {
    id: string;
    username: string;
  };
}

/**
 * User preferences interface
 */
export interface UserPreferences {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'system';
  defaultModule?: ModuleType;
  lastAccessedConfigs: string[];
  customization: {
    editorFontSize: number;
    editorTheme: string;
    showLineNumbers: boolean;
  };
}

/**
 * Configuration metadata
 */
export interface ConfigMetadata {
  version: number;
  tags: string[];
  description?: string;
  isTemplate: boolean;
  visibility: 'private' | 'shared' | 'public';
  path: string;
  checksum: string;
}

/**
 * Configuration version interface
 */
export interface ConfigVersion {
  version: number;
  content: string;
  comment?: string;
  createdAt: Date;
  createdBy: {
    id: string;
    username: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Main configuration interface
 */
export interface StoredConfig extends BaseEntity {
  name: string;
  module: ModuleType;
  content: string;
  metadata: ConfigMetadata;
  versions: ConfigVersion[];
  sharing: {
    ownerId: string;
    sharedWith: Array<{
      id: string;
      permission: 'read' | 'write';
    }>;
  };
  status: 'draft' | 'active' | 'archived' | 'deleted';
}

/**
 * System configuration interface
 */
export interface SystemConfig extends BaseEntity {
  name: string;
  host: string;
  port: number;
  description?: string;
  status: 'active' | 'inactive';
  metadata: {
    lastConnection?: Date;
    failedConnections: number;
    modules: ModuleType[];
  };
}

/**
 * Test automation suite interface
 */
export interface AutomationSuite extends BaseEntity {
  name: string;
  description?: string;
  configs: Array<{
    configId: string;
    version: number;
  }>;
  schedule?: {
    enabled: boolean;
    cron: string;
    lastRun?: Date;
  };
  notification: {
    onSuccess: boolean;
    onFailure: boolean;
    emails: string[];
  };
}

/**
 * Test run result interface
 */
export interface TestRunResult extends BaseEntity {
  suiteId: string;
  status: 'success' | 'failure' | 'error';
  duration: number;
  results: Array<{
    configId: string;
    success: boolean;
    error?: string;
    duration: number;
    logs: string[];
  }>;
}

/**
 * Storage index entry interface
 */
export interface IndexEntry {
  id: string;
  type: 'config' | 'system' | 'suite';
  path: string;
  metadata: Record<string, unknown>;
  lastUpdated: Date;
}

/**
 * Storage search query interface
 */
export interface StorageQuery {
  module?: ModuleType;
  userId?: string;
  status?: StoredConfig['status'];
  tags?: string[];
  visibility?: ConfigMetadata['visibility'];
  createdAfter?: Date;
  updatedAfter?: Date;
  name?: string | RegExp;
  limit?: number;
  offset?: number;
  sort?: {
    field: keyof StoredConfig;
    order: 'asc' | 'desc';
  };
}

/**
 * Storage operation result
 */
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
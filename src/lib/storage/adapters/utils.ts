// src/lib/storage/adapters/utils.ts

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { StorageResult } from '../storage.types';

export class FileSystemHelper {
  static async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  static async writeJSON<T>(filePath: string, data: T): Promise<void> {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  static async readJSON<T>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  static async deleteDir(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  static async listFiles(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath);
    } catch {
      return [];
    }
  }

  static generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  static calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  static createStorageResult<T>(success: boolean, data?: T, error?: Error): StorageResult<T> {
    if (success && data) {
      return { success: true, data };
    }
    return {
      success: false,
      error: error ? {
        code: 'STORAGE_ERROR',
        message: error.message,
        details: error.stack
      } : undefined
    };
  }
}
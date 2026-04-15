// src/lib/storage/adapters/file/automation.storage.ts

import path from 'path';
import { IAutomationStorage } from '../../storage.interface';
import { StoragePathResolver } from '../../config';
import { 
  AutomationSuite, 
  TestRunResult,
  StorageQuery, 
  StorageResult 
} from '../../storage.types';
import { FileSystemHelper } from '@/lib/storage/adapters/utils';

export class FileAutomationStorage implements IAutomationStorage {
  private pathResolver: StoragePathResolver;
  
  constructor(pathResolver: StoragePathResolver) {
    this.pathResolver = pathResolver;
  }

  async create(data: Omit<AutomationSuite, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<AutomationSuite>> {
    try {
      const id = FileSystemHelper.generateId();
      const now = new Date();
      const suite: AutomationSuite = {
        ...data,
        id,
        createdAt: now,
        updatedAt: now
      };

      const suitePath = this.getSuitePath(id);
      await FileSystemHelper.writeJSON(suitePath, suite);
      await FileSystemHelper.ensureDir(this.getRunsPath(id));
      
      return { success: true, data: suite };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create automation suite'
        }
      };
    }
  }

  async get(id: string): Promise<StorageResult<AutomationSuite>> {
    try {
      const suitePath = this.getSuitePath(id);
      const suite = await FileSystemHelper.readJSON<AutomationSuite>(suitePath);
      return { success: true, data: suite };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'GET_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get automation suite'
        }
      };
    }
  }

  async list(query?: StorageQuery): Promise<StorageResult<AutomationSuite[]>> {
    try {
      const automationDir = this.pathResolver.getAutomationPath();
      const files = await FileSystemHelper.listFiles(automationDir);
      const suites: AutomationSuite[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const suite = await FileSystemHelper.readJSON<AutomationSuite>(
            path.join(automationDir, file)
          );
          if (this.matchesQuery(suite, query)) {
            suites.push(suite);
          }
        }
      }

      return { success: true, data: suites };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'LIST_ERROR',
          message: error instanceof Error ? error.message : 'Failed to list automation suites'
        }
      };
    }
  }

  async update(id: string, data: Partial<AutomationSuite>): Promise<StorageResult<AutomationSuite>> {
    try {
      const current = await this.get(id);
      if (!current.success || !current.data) {
        throw new Error(`Automation suite not found: ${id}`);
      }

      const updated: AutomationSuite = {
        ...current.data,
        ...data,
        updatedAt: new Date()
      };

      const suitePath = this.getSuitePath(id);
      await FileSystemHelper.writeJSON(suitePath, updated);

      return { success: true, data: updated };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update automation suite'
        }
      };
    }
  }

  async delete(id: string): Promise<StorageResult<void>> {
    try {
      const suitePath = this.getSuitePath(id);
      const runsPath = this.getRunsPath(id);
      
      await FileSystemHelper.deleteDir(runsPath);
      await FileSystemHelper.deleteFile(suitePath);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete automation suite'
        }
      };
    }
  }

  async createRun(
    suiteId: string, 
    run: Omit<TestRunResult, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StorageResult<TestRunResult>> {
    try {
      const id = FileSystemHelper.generateId();
      const now = new Date();
      const testRun: TestRunResult = {
        ...run,
        id,
        suiteId,
        createdAt: now,
        updatedAt: now
      };

      const runPath = this.getRunPath(suiteId, id);
      await FileSystemHelper.writeJSON(runPath, testRun);

      // Update suite's last run information
      await this.update(suiteId, {
        schedule: {
          lastRun: now
        }
      });

      return { success: true, data: testRun };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'CREATE_RUN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create test run'
        }
      };
    }
  }

  async getRuns(suiteId: string, limit?: number): Promise<StorageResult<TestRunResult[]>> {
    try {
      const runsPath = this.getRunsPath(suiteId);
      const files = await FileSystemHelper.listFiles(runsPath);
      const runs: TestRunResult[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const run = await FileSystemHelper.readJSON<TestRunResult>(
            path.join(runsPath, file)
          );
          runs.push(run);
        }
      }

      // Sort by creation date descending
      runs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { 
        success: true, 
        data: limit ? runs.slice(0, limit) : runs 
      };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'GET_RUNS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get test runs'
        }
      };
    }
  }

  async getLastRun(suiteId: string): Promise<StorageResult<TestRunResult>> {
    try {
      const runsResult = await this.getRuns(suiteId, 1);
      if (!runsResult.success || !runsResult.data.length) {
        throw new Error(`No runs found for suite: ${suiteId}`);
      }

      return { success: true, data: runsResult.data[0] };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: 'GET_LAST_RUN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get last test run'
        }
      };
    }
  }

  private getSuitePath(id: string): string {
    return path.join(this.pathResolver.getAutomationPath(), `${id}.json`);
  }

  private getRunsPath(suiteId: string): string {
    return path.join(this.pathResolver.getAutomationPath(), suiteId, 'runs');
  }

  private getRunPath(suiteId: string, runId: string): string {
    return path.join(this.getRunsPath(suiteId), `${runId}.json`);
  }

  private matchesQuery(suite: AutomationSuite, query?: StorageQuery): boolean {
    if (!query) return true;
    
    if (query.name && !suite.name.toLowerCase().includes(query.name.toLowerCase())) {
      return false;
    }
    
    if (query.createdAfter && suite.createdAt < query.createdAfter) {
      return false;
    }
    
    if (query.updatedAfter && suite.updatedAt < query.updatedAfter) {
      return false;
    }
    
    return true;
  }
}
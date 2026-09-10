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

function fail<T>(code: string, error: unknown, fallback: string): StorageResult<T> {
  return {
    success: false,
    error: { code, message: error instanceof Error ? error.message : fallback },
  };
}

export class FileAutomationStorage implements IAutomationStorage {
  constructor(private readonly pathResolver: StoragePathResolver) {}

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

      await FileSystemHelper.writeJSON(this.getSuitePath(id), suite);
      await FileSystemHelper.ensureDir(this.getRunsPath(id));

      return { success: true, data: suite };
    } catch (error) {
      return fail('CREATE_ERROR', error, 'Failed to create automation suite');
    }
  }

  async get(id: string): Promise<StorageResult<AutomationSuite>> {
    try {
      const suite = await FileSystemHelper.readJSON<AutomationSuite>(this.getSuitePath(id));
      return { success: true, data: suite };
    } catch (error) {
      return fail('GET_ERROR', error, 'Failed to get automation suite');
    }
  }

  async list(query?: StorageQuery): Promise<StorageResult<AutomationSuite[]>> {
    try {
      const automationDir = this.pathResolver.getAutomationPath();
      const files = await FileSystemHelper.listFiles(automationDir);
      const suites: AutomationSuite[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const suite = await FileSystemHelper.readJSON<AutomationSuite>(path.join(automationDir, file));
          if (this.matchesQuery(suite, query)) {
            suites.push(suite);
          }
        }
      }

      return { success: true, data: suites };
    } catch (error) {
      return fail('LIST_ERROR', error, 'Failed to list automation suites');
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

      await FileSystemHelper.writeJSON(this.getSuitePath(id), updated);
      return { success: true, data: updated };
    } catch (error) {
      return fail('UPDATE_ERROR', error, 'Failed to update automation suite');
    }
  }

  async delete(id: string): Promise<StorageResult<void>> {
    try {
      await FileSystemHelper.deleteDir(this.getRunsPath(id));
      await FileSystemHelper.deleteFile(this.getSuitePath(id));
      return { success: true };
    } catch (error) {
      return fail('DELETE_ERROR', error, 'Failed to delete automation suite');
    }
  }

  /** Suites that include a given config. Required by the interface; missing. */
  async getByConfig(configId: string): Promise<StorageResult<AutomationSuite[]>> {
    const listed = await this.list();
    if (!listed.success) return listed;
    return {
      success: true,
      data: (listed.data ?? []).filter(s => (s.configs ?? []).some(c => c.configId === configId)),
    };
  }

  /** Required by the interface; missing. */
  async updateSchedule(id: string, cron: string, enabled: boolean): Promise<StorageResult<AutomationSuite>> {
    const current = await this.get(id);
    if (!current.success || !current.data) return current;
    return this.update(id, { schedule: { ...current.data.schedule, cron, enabled } });
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

      await FileSystemHelper.writeJSON(this.getRunPath(suiteId, id), testRun);

      // Record lastRun on the suite's schedule. This used to overwrite the
      // whole schedule with { lastRun }, wiping its cron and enabled flag on
      // every run. A suite with no schedule has nothing to update.
      const suite = await this.get(suiteId);
      if (suite.data?.schedule) {
        await this.update(suiteId, { schedule: { ...suite.data.schedule, lastRun: now } });
      }

      return { success: true, data: testRun };
    } catch (error) {
      return fail('CREATE_RUN_ERROR', error, 'Failed to create test run');
    }
  }

  async getRuns(suiteId: string, limit?: number): Promise<StorageResult<TestRunResult[]>> {
    try {
      const runsPath = this.getRunsPath(suiteId);
      const files = await FileSystemHelper.listFiles(runsPath);
      const runs: TestRunResult[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          runs.push(await FileSystemHelper.readJSON<TestRunResult>(path.join(runsPath, file)));
        }
      }

      // Newest first. Dates come back from JSON as strings, so the old
      // `b.createdAt.getTime()` threw as soon as there were two runs.
      runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return { success: true, data: limit ? runs.slice(0, limit) : runs };
    } catch (error) {
      return fail('GET_RUNS_ERROR', error, 'Failed to get test runs');
    }
  }

  async getLastRun(suiteId: string): Promise<StorageResult<TestRunResult>> {
    try {
      const runsResult = await this.getRuns(suiteId, 1);
      const latest = runsResult.data?.[0];
      if (!runsResult.success || !latest) {
        throw new Error(`No runs found for suite: ${suiteId}`);
      }
      return { success: true, data: latest };
    } catch (error) {
      return fail('GET_LAST_RUN_ERROR', error, 'Failed to get last test run');
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

    if (query.name) {
      const matches = typeof query.name === 'string'
        ? suite.name.toLowerCase().includes(query.name.toLowerCase())
        : query.name.test(suite.name);
      if (!matches) return false;
    }
    if (query.createdAfter && new Date(suite.createdAt) < query.createdAfter) return false;
    if (query.updatedAfter && new Date(suite.updatedAt) < query.updatedAfter) return false;

    return true;
  }
}

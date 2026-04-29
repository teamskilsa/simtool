// src/modules/testExecution/services/config/config.service.ts
import { StoredConfig } from '@/lib/storage/storage.types';
import { ModuleType } from '@/lib/storage/config';

class ConfigurationService {
  private userId: string = 'admin'; // Default to admin user or get from auth context

  async getAllConfigs(): Promise<Record<ModuleType, StoredConfig[]>> {
    try {
      const response = await fetch(`/api/configs?userId=${this.userId}`);
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || `HTTP ${response.status} fetching configs`);
      }

      const allConfigs: StoredConfig[] = await response.json();

      const groupedConfigs: Record<ModuleType, StoredConfig[]> = {
        enb: [], gnb: [], mme: [], ims: [], ue_db: [],
      };
      for (const config of allConfigs) {
        if (config.module in groupedConfigs) {
          groupedConfigs[config.module as ModuleType].push(config);
        }
      }
      return groupedConfigs;
    } catch (error) {
      // Keep error logging — this is a real failure surface. Just don't
      // chatter on every successful fetch (StrictMode + ConfigProvider
      // double-mount + ConfigContext refresh would emit ~12 lines per
      // page load before).
      console.error('[configService] failed to fetch /api/configs:', error);
      throw error;
    }
  }

  async getModuleConfigs(moduleType: ModuleType): Promise<StoredConfig[]> {
    try {
      const allConfigs = await this.getAllConfigs();
      return allConfigs[moduleType] || [];
    } catch (error) {
      console.error(`Error fetching ${moduleType} configurations:`, error);
      throw error;
    }
  }
}

export const configService = new ConfigurationService();
// src/modules/testExecution/services/config/config.service.ts
import { StoredConfig } from '@/lib/storage/storage.types';
import { ModuleType } from '@/lib/storage/config';

class ConfigurationService {
  private userId: string = 'admin'; // Default to admin user or get from auth context

  async getAllConfigs(): Promise<Record<ModuleType, StoredConfig[]>> {
    try {
      console.log('Fetching configurations for user:', this.userId);
      
      const response = await fetch(`/api/configs?userId=${this.userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch configurations');
      }

      const allConfigs: StoredConfig[] = await response.json();
      
      // Group configs by module
      const groupedConfigs: Record<ModuleType, StoredConfig[]> = {
        enb: [],
        gnb: [],
        mme: [],
        ims: [],
        ue_db: []
      };

      allConfigs.forEach(config => {
        if (config.module in groupedConfigs) {
          groupedConfigs[config.module as ModuleType].push(config);
        }
      });

      console.log('Configurations grouped by module:', {
        totalConfigs: allConfigs.length,
        byModule: Object.entries(groupedConfigs).map(([module, configs]) => 
          `${module}: ${configs.length}`
        )
      });

      return groupedConfigs;
    } catch (error) {
      console.error('Error fetching configurations:', error);
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
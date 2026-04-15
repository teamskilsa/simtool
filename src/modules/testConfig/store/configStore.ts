// src/modules/testConfig/store/configStore.ts
import { ConfigItem, StoredConfig } from '../types';

export class ConfigStore {
    private readonly STORAGE_KEY = 'test-matrix-configs';

    getConfigs(userId: string): ConfigItem[] {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return [];
        
        const allConfigs: StoredConfig[] = JSON.parse(stored);
        return allConfigs
            .filter(config => config.userId === userId)
            .map(({ userId, ...config }) => config);
    }

    saveConfig(userId: string, config: ConfigItem): void {
        const allConfigs = this.getAllConfigs();
        const storedConfig: StoredConfig = { ...config, userId };
        
        const existingIndex = allConfigs.findIndex(
            c => c.userId === userId && c.id === config.id
        );

        if (existingIndex >= 0) {
            allConfigs[existingIndex] = storedConfig;
        } else {
            allConfigs.push(storedConfig);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allConfigs));
    }

    private getAllConfigs(): StoredConfig[] {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }
}

export const configStore = new ConfigStore();

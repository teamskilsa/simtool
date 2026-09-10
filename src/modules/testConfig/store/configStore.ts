// src/modules/testConfig/store/configStore.ts
import { ConfigItem } from '../types';

/** A config as persisted in localStorage: the item plus its owner. */
type StoredConfig = ConfigItem & { userId: string };

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

    /** Replace every config belonging to one user. ConfigProvider's
     *  deleteConfig called this, but it did not exist, so deleting threw. */
    saveConfigs(userId: string, configs: ConfigItem[]): void {
        const others = this.getAllConfigs().filter(c => c.userId !== userId);
        const mine: StoredConfig[] = configs.map(config => ({ ...config, userId }));
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...others, ...mine]));
    }

    private getAllConfigs(): StoredConfig[] {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }
}

export const configStore = new ConfigStore();

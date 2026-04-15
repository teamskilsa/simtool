// src/modules/testConfig/services/testConfig.service.ts
import { ConfigItem, ModuleType } from '../types';

class TestConfigService {
    private getBaseUrl(host: string, port: string): string {
        return `http://${host}:${port}`;
    }

    async fetchConfigList(
        module: ModuleType, 
        host: string, 
        port: string,
        customPath?: string
    ): Promise<Omit<ConfigItem, 'content'>[]> {
        try {
            const baseUrl = this.getBaseUrl(host, port);
            const url = `${baseUrl}/api/nodes/configs/${module}/list${customPath ? `?path=${encodeURIComponent(customPath)}` : ''}`;
            
            console.log('Fetching config list from:', url);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.map((config: any) => ({
                id: config.name,
                name: config.name,
                module: config.module,
                path: config.path,
                createdAt: new Date(config.createdAt),
                modifiedAt: new Date(config.modifiedAt),
                createdBy: 'System',
                isServerConfig: true,
                size: config.size
            }));
        } catch (error) {
            console.error('Failed to fetch config list:', error);
            throw error;
        }
    }

    async fetchConfigContent(
        module: ModuleType,
        filename: string,
        host: string,
        port: string,
        customPath?: string
    ): Promise<ConfigItem> {
        try {
            const baseUrl = this.getBaseUrl(host, port);
            const url = `${baseUrl}/api/nodes/configs/${module}/${filename}${customPath ? `?path=${encodeURIComponent(customPath)}` : ''}`;
            
            console.log('Fetching config content from:', url);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return {
                id: data.name,
                name: data.name,
                content: data.content,
                module: data.module,
                path: data.path,
                createdAt: new Date(data.createdAt),
                modifiedAt: new Date(data.modifiedAt),
                createdBy: 'System',
                isServerConfig: true,
                size: data.size
            };
        } catch (error) {
            console.error('Failed to fetch config content:', error);
            throw error;
        }
    }
}

export const testConfigService = new TestConfigService();
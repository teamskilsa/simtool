// src/modules/testConfig/services/testConfig.service.ts
// All agent calls are proxied through /api/systems/remote-configs (Next.js server-side)
// to avoid CORS issues when the browser fetches from a different host:port.
import { ConfigItem, ModuleType } from '../types';

class TestConfigService {
    /** Build a URL for the server-side proxy route */
    private proxyUrl(host: string, port: string, module: string, params: Record<string, string> = {}): string {
        const qs = new URLSearchParams({ host, port, module, ...params });
        return `/api/systems/remote-configs?${qs.toString()}`;
    }

    async fetchConfigList(
        module: ModuleType,
        host: string,
        port: string,
        customPath?: string
    ): Promise<Omit<ConfigItem, 'content'>[]> {
        const params: Record<string, string> = {};
        if (customPath) params.path = customPath;

        const url = this.proxyUrl(host, port, module, params);
        console.log('Fetching config list via proxy:', url);

        const response = await fetch(url);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Failed to fetch config list (${response.status})`);
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
            size: config.size,
        }));
    }

    async fetchConfigContent(
        module: ModuleType,
        filename: string,
        host: string,
        port: string,
        customPath?: string
    ): Promise<ConfigItem> {
        const params: Record<string, string> = { filename };
        if (customPath) params.path = customPath;

        const url = this.proxyUrl(host, port, module, params);
        console.log('Fetching config content via proxy:', url);

        const response = await fetch(url);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Failed to fetch config content (${response.status})`);
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
            size: data.size,
        };
    }
}

export const testConfigService = new TestConfigService();
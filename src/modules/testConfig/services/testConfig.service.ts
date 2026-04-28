// src/modules/testConfig/services/testConfig.service.ts
// Config files are read via SSH (POST /api/systems/remote-configs).
// This works even when the Amarisoft agent can't access /root/* due to
// permission issues — SSH uses the same credentials as the rest of the app.
import { ConfigItem, ModuleType } from '../types';
import type { ImportSystem } from '../context/SystemContext';

class TestConfigService {
    private sshBody(system: ImportSystem, extra: Record<string, any> = {}) {
        return {
            host: system.host,
            port: system.sshPort ?? 22,
            username: system.username,
            ...(system.authMode === 'privateKey' && system.privateKey
                ? { privateKey: system.privateKey }
                : { password: system.password ?? '' }),
            ...extra,
        };
    }

    async fetchConfigList(
        module: ModuleType,
        system: ImportSystem,
    ): Promise<Omit<ConfigItem, 'content'>[]> {
        const body = this.sshBody(system, { module });
        console.log('Fetching config list via SSH proxy, module:', module, 'host:', system.host);

        const response = await fetch('/api/systems/remote-configs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Failed to list configs (${response.status})`);

        return data.map((cfg: any) => ({
            id: cfg.name,
            name: cfg.name,
            module: cfg.module ?? module,
            path: cfg.path,
            createdAt: new Date(cfg.createdAt),
            modifiedAt: new Date(cfg.modifiedAt),
            createdBy: 'System',
            isServerConfig: true,
            size: cfg.size,
        }));
    }

    async fetchConfigContent(
        module: ModuleType,
        filename: string,
        system: ImportSystem,
    ): Promise<ConfigItem> {
        const body = this.sshBody(system, { module, filename });
        console.log('Fetching config content via SSH proxy:', filename);

        const response = await fetch('/api/systems/remote-configs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Failed to fetch ${filename} (${response.status})`);

        return {
            id: data.name,
            name: data.name,
            content: data.content,
            module: data.module ?? module,
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
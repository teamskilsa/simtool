import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileJson } from 'lucide-react';
import { ConfigItem, ModuleType } from '../../types';
import { testConfigService } from '../../services';

interface ServerConfigSelectorProps {
    system: {
        host: string;
        port: string;
    };
    module: ModuleType;
    customPath?: string;
    selectedConfig: ConfigItem | null;
    onConfigSelect: (config: ConfigItem) => void;
}

export const ServerConfigSelector: React.FC<ServerConfigSelectorProps> = ({
    system,
    module,
    customPath,
    selectedConfig,
    onConfigSelect
}) => {
    const [configs, setConfigs] = useState<ConfigItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchConfigs();
    }, [system, module, customPath]);

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const response = await testConfigService.fetchServerConfigs(
                module,
                system.host,
                system.port,
                customPath
            );
            
            // Ensure each config has required properties
            const processedConfigs = response.map((config: any) => ({
                id: config.id || `${config.name}-${Date.now()}`,
                name: config.name,
                content: config.content || '',
                module: config.module || module,
                createdBy: config.createdBy || 'System',
                createdAt: new Date(config.createdAt || Date.now()),
                modifiedAt: new Date(config.modifiedAt || Date.now()),
                isServerConfig: true,
                path: customPath || config.path
            }));
            
            setConfigs(processedConfigs);
        } catch (error) {
            console.error('Failed to fetch configs:', error);
            setConfigs([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">Select Configuration</label>
            <ScrollArea className="h-[200px] rounded-md border bg-background">
                <div className="p-4 space-y-2">
                    {configs.map((config) => (
                        <div
                            key={`${config.id}-${config.modifiedAt.getTime()}`}
                            onClick={() => onConfigSelect(config)}
                            className={`
                                p-3 rounded-lg cursor-pointer transition-colors
                                border
                                ${selectedConfig?.id === config.id 
                                    ? 'bg-primary/10 border-primary'
                                    : 'hover:bg-muted border-transparent'
                                }
                            `}
                        >
                            <div className="flex items-center gap-3">
                                <FileJson className="w-4 h-4 text-primary" />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{config.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {config.createdBy}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Modified: {config.modifiedAt.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    )}
                    {!loading && configs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <FileJson className="w-8 h-8 mb-2" />
                            <p>No configurations found</p>
                            <p className="text-xs">Check the system connection and path</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
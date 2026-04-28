'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileJson } from 'lucide-react';
import { ConfigItem, ModuleType } from '../../types';
import { testConfigService } from '../../services';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ImportSystem } from '../../context/SystemContext';
import { extractReferencedFiles } from '../ConfigBuilder';

interface ConfigSelectorProps {
    system: ImportSystem;
    module: ModuleType;
    selectedConfigs: ConfigItem[];
    customPath?: string;
    onConfigSelect: (configs: ConfigItem[]) => void;
}

export const ConfigSelector: React.FC<ConfigSelectorProps> = ({
    system,
    module,
    selectedConfigs,
    customPath,
    onConfigSelect,
}) => {
    const [configs, setConfigs] = useState<Omit<ConfigItem, 'content'>[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const fetchInProgress = useRef(false);

    // Filter configs based on search term
    const filteredConfigs = configs.filter(config => 
        config.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const fetchConfigList = async () => {
        if (fetchInProgress.current) return;

        try {
            fetchInProgress.current = true;
            setLoading(true);
            setFetchError(null);
            console.log('Fetching config list with:', { module, host: system.host });
            const list = await testConfigService.fetchConfigList(
                module,
                system,
            );
            console.log('Fetched config list:', list);
            setConfigs(list);
        } catch (error) {
            console.error('Failed to fetch config list:', error);
            const msg = error instanceof Error ? error.message : 'Failed to fetch configurations';
            setFetchError(msg);
            toast({
                title: `Could not list ${module} configs`,
                description: msg,
                variant: 'destructive',
            });
            setConfigs([]);
        } finally {
            setLoading(false);
            fetchInProgress.current = false;
        }
    };

    useEffect(() => {
        fetchConfigList();
    }, [system, module, customPath]);

    const handleConfigSelect = async (config: Omit<ConfigItem, 'content'>) => {
        try {
            setLoading(true);
            console.log('Fetching config content for:', config.name);
            
            // Check if already selected
            const isSelected = selectedConfigs.some(selected => selected.id === config.id);
            
            if (isSelected) {
                // Remove from selection
                const newSelection = selectedConfigs.filter(selected => selected.id !== config.id);
                onConfigSelect(newSelection);
            } else {
                // Add to selection
                const fullConfig = await testConfigService.fetchConfigContent(
                    module,
                    config.name,
                    system,
                );
                console.log('Fetched config content:', fullConfig);

                // Auto-fetch dependencies (drb.cfg, sib*.asn, includes) so the
                // user's selection is self-contained on import.
                const refs = extractReferencedFiles(fullConfig.content || '');
                const newlyFetched: ConfigItem[] = [];
                for (const ref of refs) {
                    const baseName = ref.filename.split('/').pop() || ref.filename;
                    const already = selectedConfigs.some(c => c.name === baseName)
                                  || newlyFetched.some(c => c.name === baseName)
                                  || baseName === fullConfig.name;
                    if (already) continue;
                    try {
                        const dep = await testConfigService.fetchConfigContent(module, baseName, system);
                        newlyFetched.push(dep);
                        console.log('Auto-fetched dependency:', baseName);
                    } catch (e) {
                        console.warn('Could not fetch dependency:', baseName, e);
                    }
                }

                if (newlyFetched.length > 0) {
                    toast({
                        title: 'Dependencies auto-fetched',
                        description: `Pulled ${newlyFetched.length} extra file${newlyFetched.length === 1 ? '' : 's'} (${newlyFetched.map(f => f.name).join(', ')})`,
                    });
                }
                onConfigSelect([...selectedConfigs, fullConfig, ...newlyFetched]);
            }
        } catch (error) {
            console.error('Failed to fetch config content:', error);
            toast({
                title: "Error",
                description: "Failed to fetch configuration content",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = async (checked: boolean) => {
        if (checked && filteredConfigs.length > 0) {
            try {
                setLoading(true);
                const allConfigs = [];
                
                for (const config of filteredConfigs) {
                    const fullConfig = await testConfigService.fetchConfigContent(
                        module,
                        config.name,
                        system,
                    );
                    allConfigs.push(fullConfig);
                }
                
                onConfigSelect(allConfigs);
            } catch (error) {
                console.error('Failed to fetch configs:', error);
                toast({
                    title: "Error",
                    description: "Failed to fetch all configurations",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        } else {
            onConfigSelect([]);
        }
    };

    const isAllSelected = filteredConfigs.length > 0 && 
        filteredConfigs.every(config => selectedConfigs.some(selected => selected.id === config.id));

    return (
        <div className="space-y-2">
            <div className="space-y-4">
                <Input
                    placeholder="Search configurations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                
                <div className="flex items-center gap-2 px-2">
                    <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        disabled={loading || filteredConfigs.length === 0}
                    />
                    <span className="text-sm text-muted-foreground">
                        Select All ({filteredConfigs.length} items)
                    </span>
                </div>
            </div>

            <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-4">
                    {loading && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    )}

                    {filteredConfigs.length === 0 ? (
                        fetchError ? (
                            <div className="text-center py-6 px-4">
                                <p className="text-sm font-medium text-destructive mb-1">
                                    Couldn't list <span className="font-mono">{module}</span> configs
                                </p>
                                <p className="text-xs text-muted-foreground">{fetchError}</p>
                                <p className="text-[11px] text-muted-foreground mt-3">
                                    Common causes: SSH credentials wrong on the system entry, the directory
                                    doesn't exist on the target, or the user can't read it (try sudo / verify
                                    the dir for this module).
                                </p>
                            </div>
                        ) : loading ? null : (
                            <div className="text-center text-sm text-muted-foreground py-6">
                                <p>No <span className="font-mono">{module}</span> configurations found.</p>
                                <p className="text-[11px] mt-2">
                                    Directory exists but contains no matching files. Different module?
                                </p>
                            </div>
                        )
                    ) : (
                        <div className="space-y-2">
                            {filteredConfigs.map((config) => (
                                <div
                                    key={config.id}
                                    className={cn(
                                        "flex items-start gap-3 p-3 rounded-lg border transition-colors duration-200",
                                        selectedConfigs.some(selected => selected.id === config.id)
                                            ? "bg-primary/5 border-primary/20"
                                            : "hover:bg-muted/50",
                                        "cursor-pointer"
                                    )}
                                    onClick={() => handleConfigSelect(config)}
                                >
                                    <Checkbox
                                        checked={selectedConfigs.some(selected => selected.id === config.id)}
                                        onCheckedChange={() => handleConfigSelect(config)}
                                        onClick={e => e.stopPropagation()}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <FileJson className="h-4 w-4 text-primary flex-shrink-0" />
                                            <div className="truncate">
                                                <div className="font-medium">{config.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Modified: {new Date(config.modifiedAt).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
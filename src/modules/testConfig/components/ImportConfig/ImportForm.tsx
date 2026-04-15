'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfigItem, ModuleType } from '../../types';
import { useSystem } from '../../context/SystemContext';
import { ConfigSelector } from './ConfigSelector';
import { Loader2, Server, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface ImportFormProps {
    onImport: (configs: ConfigItem[]) => Promise<void>;
    onCancel: () => void;
}

export const ImportForm: React.FC<ImportFormProps> = ({ onImport, onCancel }) => {
    const { systems, selectedSystem, setSelectedSystem } = useSystem();
    const [selectedModule, setSelectedModule] = useState<ModuleType | ''>('');
    const [selectedConfigs, setSelectedConfigs] = useState<ConfigItem[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const importInProgress = useRef(false);

    const handleConfigSelect = (configs: ConfigItem[]) => {
        setSelectedConfigs(configs);
    };

    const handleImport = async () => {
        console.log('Import button clicked');
        console.log('Selected configs:', selectedConfigs);
        
        if (selectedConfigs.length === 0 || importInProgress.current) {
            console.log('No configs selected or import in progress, returning');
            return;
        }
        
        try {
            importInProgress.current = true;
            setIsImporting(true);
            console.log('Calling onImport with configs:', selectedConfigs);
            await onImport(selectedConfigs);
            console.log('Import completed successfully');
        } catch (error) {
            console.error('Import failed:', error);
        } finally {
            importInProgress.current = false;
            setIsImporting(false);
        }
    };

    const handleSystemSelect = (systemId: string) => {
        const system = systems.find(s => s.id === systemId);
        setSelectedSystem(system || null);
        setSelectedModule('');
        setSelectedConfigs([]);
    };

    const handleModuleSelect = (value: ModuleType) => {
        setSelectedModule(value);
        setSelectedConfigs([]);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header Section */}
            <div className={cn(
                "px-6 py-4 border-b",
                "bg-gradient-to-r from-blue-600 to-indigo-600",
                "flex items-center justify-between"
            )}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                        <Server className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Import Configuration</h2>
                        <p className="text-sm text-blue-100">Select configurations to import from server</p>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-6 space-y-6 flex-1">
                <Card className="p-4 bg-muted/50">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Select System</label>
                            <Select value={selectedSystem?.id || ''} onValueChange={handleSystemSelect}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Choose a system..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {systems.map((system) => (
                                        <SelectItem key={system.id} value={system.id}>
                                            {system.name} ({system.host}:{system.port})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedSystem && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Select Module</label>
                                <Select value={selectedModule} onValueChange={handleModuleSelect}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Choose a module..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="enb">ENB</SelectItem>
                                        <SelectItem value="gnb">GNB</SelectItem>
                                        <SelectItem value="mme">MME</SelectItem>
                                        <SelectItem value="ims">IMS</SelectItem>
                                        <SelectItem value="ue_db">UE DB</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </Card>

                {selectedSystem && selectedModule && (
                    <ConfigSelector
                        system={selectedSystem}
                        module={selectedModule}
                        selectedConfigs={selectedConfigs}
                        onConfigSelect={handleConfigSelect}
                    />
                )}
            </div>

            {/* Footer Section */}
            <div className={cn(
                "px-6 py-4 border-t",
                "bg-gradient-to-r from-gray-50 to-gray-100",
                "dark:from-gray-900 dark:to-gray-900",
                "flex items-center justify-between"
            )}>
                <div className="flex items-center gap-2">
                    {selectedConfigs.length > 0 && (
                        <Badge variant="secondary" className={cn(
                            "rounded-md bg-blue-100 text-blue-700",
                            "dark:bg-blue-900 dark:text-blue-100"
                        )}>
                            {selectedConfigs.length} configuration{selectedConfigs.length !== 1 ? 's' : ''} selected
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="border-gray-300"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={selectedConfigs.length === 0 || isImporting}
                        className={cn(
                            "relative",
                            "bg-gradient-to-r from-blue-500 to-indigo-500",
                            "hover:from-blue-600 hover:to-indigo-600",
                            "text-white",
                            "border-0",
                            "shadow-lg shadow-blue-500/25",
                            "transition-all duration-300",
                            "hover:scale-105",
                            "active:scale-95",
                            "disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                        )}
                    >
                        {isImporting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Import {selectedConfigs.length > 0 ? `(${selectedConfigs.length})` : ''} Configuration{selectedConfigs.length !== 1 ? 's' : ''}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
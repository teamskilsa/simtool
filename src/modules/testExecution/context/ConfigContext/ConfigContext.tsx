// src/modules/testExecution/context/ConfigContext/ConfigContext.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { StoredConfig } from '@/lib/storage/storage.types';
import { ModuleType } from '@/lib/storage/config';
import { configService } from '@/modules/testExecution/services/config/config.service';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ConfigState {
  configs: Record<ModuleType, StoredConfig[]>;
  loading: boolean;
  error: Error | null;
  selectedConfigs: Record<string, string>; // moduleId -> configId mapping
}

interface ConfigContextType extends ConfigState {
  refreshConfigs: () => Promise<void>;
  selectConfig: (moduleId: string, configId: string) => void;
  clearSelectedConfigs: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [state, setState] = useState<ConfigState>({
    configs: {} as Record<ModuleType, StoredConfig[]>,
    loading: true,
    error: null,
    selectedConfigs: {}
  });

  const loadConfigs = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      console.log('Starting config load...');
      const allConfigs = await configService.getAllConfigs();
      
      console.log('Configs loaded successfully:', Object.keys(allConfigs));
      setState(prev => ({
        ...prev,
        configs: allConfigs,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Error loading configs:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Failed to load configurations')
      }));
      
      toast({
        title: "Error",
        description: "Failed to load configurations. Please try again later.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const selectConfig = (moduleId: string, configId: string) => {
    setState(prev => ({
      ...prev,
      selectedConfigs: {
        ...prev.selectedConfigs,
        [moduleId]: configId
      }
    }));
  };

  const clearSelectedConfigs = () => {
    setState(prev => ({
      ...prev,
      selectedConfigs: {}
    }));
  };

  const value = {
    ...state,
    refreshConfigs: loadConfigs,
    selectConfig,
    clearSelectedConfigs
  };

  if (state.loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfigs() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfigs must be used within a ConfigProvider');
  }
  return context;
}
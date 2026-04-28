// src/modules/testExecution/context/ConfigContext/ConfigContext.tsx

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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

  // Did we ever finish a load? Once true, refreshes never blank the tree —
  // they just update `loading` so consumers can show a subtle indicator if
  // they want, while the rest of the dashboard keeps its state.
  //
  // (This was a hard-to-find bug: this provider wraps the whole dashboard
  // layout, and the old code returned a spinner whenever `loading` flipped
  // back to true on refresh. ScenarioCreator calls refreshConfigs() in its
  // mount effect, so opening the Create Scenario dialog tore down the entire
  // dashboard — `activeSection` reset to 'dashboard' and the dialog never
  // got a chance to render.)
  const initialLoadDone = useRef(false);

  const loadConfigs = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const allConfigs = await configService.getAllConfigs();

      setState(prev => ({
        ...prev,
        configs: allConfigs,
        loading: false,
        error: null
      }));
      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error loading configs:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Failed to load configurations')
      }));
      // Mark initial load done even on error so the dashboard becomes
      // navigable instead of stuck on a spinner forever.
      initialLoadDone.current = true;

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

  // Block render only on the FIRST load — show a centered spinner so users
  // see something while configs come in. Subsequent refreshes leave children
  // mounted and just update context value when the new data arrives.
  if (state.loading && !initialLoadDone.current) {
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
// src/modules/testConfig/context/ConfigProvider.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ConfigContext } from './ConfigContext';
import { ConfigItem } from '../types';
import { configStore } from '../store';
import { testConfigService } from '../services';
import { useUser } from '@/modules/users/context/user-context';

import { configsService } from '../services/configs.service';
import { useToast } from '@/components/ui/use-toast';

interface ConfigProviderProps {
  children: React.ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const { user } = useUser();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Load user's stored configs on mount
  useEffect(() => {
    if (user?.id) {
      const storedConfigs = configStore.getConfigs(user.id);
      setConfigs(storedConfigs);
    }
  }, [user?.id]);

  const saveConfig = useCallback(async (config: ConfigItem) => {
    if (!user?.id) {
      throw new Error('User must be logged in to save configurations');
    }

    try {
      setLoading(true);
      
      // If it's a server config being saved locally, create a new local copy
      const newConfig: ConfigItem = config.isServerConfig 
        ? {
            ...config,
            id: `${config.id}_local_${Date.now()}`,
            isServerConfig: false,
            createdBy: user.username,
            createdAt: new Date(),
            modifiedAt: new Date()
          }
        : {
            ...config,
            modifiedAt: new Date()
          };

      // Save to local storage
      configStore.saveConfig(user.id, newConfig);

      // If it's not a local copy of server config, also save to server
      if (!config.isServerConfig) {
        await testConfigService.saveConfig(newConfig);
      }

      // Update configs state
      setConfigs(prevConfigs => {
        const index = prevConfigs.findIndex(c => c.id === config.id);
        if (index >= 0) {
          return [
            ...prevConfigs.slice(0, index),
            newConfig,
            ...prevConfigs.slice(index + 1)
          ];
        }
        return [...prevConfigs, newConfig];
      });

      console.log(`Configuration ${newConfig.name} saved successfully`);
      return newConfig;
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const deleteConfig = useCallback(async (configId: string) => {
    if (!user?.id) {
      throw new Error('User must be logged in to delete configurations');
    }

    try {
      setLoading(true);
      
      // Remove from local storage
      const updatedConfigs = configs.filter(c => c.id !== configId);
      configStore.saveConfigs(user.id, updatedConfigs);
      
      setConfigs(updatedConfigs);
      if (selectedConfig?.id === configId) {
        setSelectedConfig(null);
      }

      console.log(`Configuration ${configId} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete configuration:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [configs, selectedConfig, user?.id]);

  const loadConfigs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const loadedConfigs = await configsService.getConfigs(user.id);
      setConfigs(loadedConfigs);
    } catch (error) {
      console.error('Failed to load configs:', error);
      if (toast) {
        toast({
          title: "Error",
          description: "Failed to load configurations",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);
  
  const value = {
    configs,
    selectedConfig,
    setSelectedConfig,
    saveConfig,
    deleteConfig,
    loadConfigs  // Add this
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};
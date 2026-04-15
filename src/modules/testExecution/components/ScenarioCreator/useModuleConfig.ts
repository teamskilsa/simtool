// hooks/useModuleConfig.ts
import { useState, useEffect } from 'react';

export function useModuleConfig(initialModules: string[] = []) {
  const [formState, setFormState] = useState({
    name: '',
    topology: '',
    system: undefined,
    ipConfig: {},
    moduleConfigs: {}
  });

  // This effect will run when initialData changes
  useEffect(() => {
    if (initialModules.length > 0) {
      setFormState(prev => ({
        ...prev,
        moduleConfigs: initialModules.reduce((acc, moduleId) => ({
          ...acc,
          [moduleId]: {
            moduleId,
            enabled: true,
            configId: '',
            ipAddress: '',
            isCustomIp: false,
            ...prev.moduleConfigs[moduleId]
          }
        }), {})
      }));
    }
  }, [initialModules]);

  const updateFormState = (updates: Partial<typeof formState>) => {
    setFormState(prev => ({
      ...prev,
      ...updates
    }));
  };

  const updateModuleConfig = (moduleId: string, updates: any) => {
    setFormState(prev => ({
      ...prev,
      moduleConfigs: {
        ...prev.moduleConfigs,
        [moduleId]: {
          ...prev.moduleConfigs[moduleId],
          ...updates
        }
      }
    }));
  };

  return {
    formState,
    updateFormState,
    updateModuleConfig
  };
}
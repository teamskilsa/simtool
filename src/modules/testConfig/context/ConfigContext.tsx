// src/modules/testConfig/context/ConfigContext.tsx
import { createContext, useContext } from 'react';
import { ConfigItem } from '../types';

interface ConfigContextType {
    configs: ConfigItem[];
    selectedConfig: ConfigItem | null;
    setSelectedConfig: (config: ConfigItem | null) => void;
    saveConfig: (config: ConfigItem) => Promise<void>;
    deleteConfig: (configId: string) => Promise<void>;
    loadConfigs: () => Promise<void>;  // Add this
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const useConfigContext = () => {
    const context = useContext(ConfigContext);
    if (undefined === context) {
        throw new Error('useConfigContext must be used within a ConfigProvider');
    }
    return context;
};

// src/modules/testConfig/hooks/useConfig.ts
import { useConfigContext } from '../context';
import { ConfigItem } from '../types';

export const useConfig = () => {
    const context = useConfigContext();

    const handleSave = async (config: ConfigItem) => {
        await context.saveConfig(config);
    };

    const handleDelete = async (configId: string) => {
        await context.deleteConfig(configId);
    };

    return {
        configs: context.configs,
        selectedConfig: context.selectedConfig,
        setSelectedConfig: context.setSelectedConfig,
        saveConfig: handleSave,
        deleteConfig: handleDelete
    };
};

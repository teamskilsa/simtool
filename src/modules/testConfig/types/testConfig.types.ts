// src/modules/testConfig/types/testConfig.types.ts
export type ModuleType = 'enb' | 'gnb' | 'mme' | 'ims' | 'ue_db' | 'ue';

export interface ConfigItem {
    id: string;
    name: string;
    content?: string;  // Optional because list doesn't include content
    module: ModuleType;
    path?: string;
    createdBy: string;
    createdAt: Date;
    modifiedAt: Date;
    isServerConfig?: boolean;
    size?: number;
}
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
    /** Set when the config came in through an import (storage tag "imported"). */
    isImported?: boolean;
    /** Name of the config group this item belongs to, when grouped. The list,
     *  list item and editor header all read it; it was missing from the type. */
    group?: string;
}
// src/modules/testConfig/utils/constants.ts
export const MODULE_PATHS = {
    enb: '/root/enb/config',
    gnb: '/root/gnb/config',
    mme: '/root/mme/config',
    ims: '/root/ims/config',
    ue_db: '/root/mme/config'
} as const;

export const FILE_EXTENSIONS = ['.json', '.cfg', '.conf'];

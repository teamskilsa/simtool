// src/modules/testConfig/utils/validation.ts
export const isValidConfigName = (name: string): boolean => {
    const regex = /^[a-zA-Z0-9_-]+$/;
    return regex.test(name) && name.length <= 50;
};

export const isValidJson = (str: string): boolean => {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
};

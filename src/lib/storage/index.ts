// src/lib/storage/index.ts

export * from './storage.types';
export * from './storage.interface';
export * from './adapters';
export * from './config';

import { StorageAdapter } from './adapters/storage.adapter'; 
import { storageConfig } from './config';

let storageAdapter: StorageAdapter;

export function getStorageAdapter() {
    if (!storageAdapter) {
      storageAdapter = new StorageAdapter(storageConfig);
    }
    return storageAdapter;
}

export default getStorageAdapter();
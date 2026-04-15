// src/shared/users/systems/config.ts

import type { SystemsConfig } from './types';

export const systemsConfig: SystemsConfig = {
  groups: [
    {
      id: 'test-env',
      name: 'Test Environment',
      systems: [
        {
          id: 'enb-1',
          name: 'eNodeB Primary',
          type: 'ENB',
          description: 'Primary test eNodeB system',
          status: 'active',
          remoteAPI: {
            protocol: 'ws',
            ip: '192.168.86.245',
            port: 9001,
            ssl: false
          },
          software: {
            mainApplication: 'LTEENB',
            version: '2024.1'
          }
        }
      ]
    }
  ],
  defaultGroup: {
    id: 'default',
    name: 'Default Systems',
    systems: []
  }
};
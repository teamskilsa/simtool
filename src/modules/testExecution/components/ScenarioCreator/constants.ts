// First, let's create a constants file
// components/ScenarioCreator/constants.ts
export const TOPOLOGY_OPTIONS = [
    {
      id: 'callbox',
      name: 'Callbox Setup',
      description: 'enb/gnb + mme + ims + ue_db',
      modules: ['enb', 'mme', 'ims', 'ue_db'],
      optional: ['ims']
    },
    {
      id: 'ue-core',
      name: 'UE + Core Setup',
      description: 'UE + enb/gnb + core',
      modules: ['ue', 'enb', 'core'],
      optional: []
    },
    {
      id: 'core',
      name: 'Core Only',
      description: 'mme + ims + ue_db',
      modules: ['mme', 'ims', 'ue_db'],
      optional: ['ims']
    }
  ] as const;
  
  export type TopologyId = typeof TOPOLOGY_OPTIONS[number]['id'];

  export const MOCK_SYSTEMS = [
    { id: 'system1', name: 'System 1', host: '192.168.1.100', port: '9050' },
    { id: 'system2', name: 'System 2', host: '192.168.1.200', port: '9050' }
  ] as const;
  
  export const MODULE_TYPES = {
    ENB: 'enb',
    GNB: 'gnb',
    MME: 'mme',
    IMS: 'ims',
    UE_DB: 'ue_db'
  } as const;
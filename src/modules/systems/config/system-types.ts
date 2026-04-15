// modules/systems/config/system-types.ts

import { Radio, Smartphone, Activity, Server } from 'lucide-react';

export interface SystemTypeConfig {
  value: string;
  label: string;
  icon: any; // Using any for Lucide icons
  description: string;
}

export const SYSTEM_TYPES: SystemTypeConfig[] = [
  {
    value: 'Callbox',
    label: 'Callbox',
    icon: Radio,
    description: 'LTE/5G Base Station'
  },
  {
    value: 'UESim',
    label: 'UE Simulator',
    icon: Smartphone,
    description: 'User Equipment Simulator'
  },
  {
    value: 'MME',
    label: 'MME',
    icon: Server,
    description: 'Mobility Management Entity'
  },
  {
    value: 'SPGW',
    label: 'SPGW',
    icon: Activity,
    description: 'Serving/PDN Gateway'
  }
];

// Additional configurations if needed
export const SYSTEM_DEFAULT_PORTS = {
  'Callbox': '9001',
  'UESim': '9002',
  'MME': '9000',
  'SPGW': '9003'
};

export const SYSTEM_FEATURES = {
  'Callbox': ['RAN', '5G', 'LTE'],
  'UESim': ['Testing', 'Simulation'],
  'MME': ['Core Network', 'EPC'],
  'SPGW': ['Core Network', 'Data Plane']
};

// You can also add validation rules per type
export const SYSTEM_VALIDATION_RULES = {
  'Callbox': {
    maxUEs: 32,
    requiredVersion: true
  },
  'UESim': {
    maxUEs: 100,
    requiredVersion: true
  },
  'MME': {
    maxConnections: 1000,
    requiredVersion: false
  },
  'SPGW': {
    maxThroughput: '10Gbps',
    requiredVersion: false
  }
};

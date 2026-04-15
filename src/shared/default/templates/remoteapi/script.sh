#!/bin/bash

# Script to create RemoteAPI template structure
# Save this as create_remoteapi_structure.sh and run from your remoteapi directory

# Create directory structure
mkdir -p {enb,ue,mme}/{config,stats}
mkdir -p common
mkdir -p enb/config/{phy-mac,sib,cell,logging}

# Create common types file
cat > common/types.ts << 'EOL'
export type ComponentType = 'ENB' | 'UE' | 'MME' | 'IMS' | 'MBMS';

export interface CommandParam {
  type: 'number' | 'string' | 'boolean' | 'hex';
  description: string;
  required?: boolean;
  default?: any;
  validator?: (value: any) => boolean;
  min?: number;
  max?: number;
}

export interface CommandTemplate {
  id: string;
  category: string;
  subCategory?: string;
  label: string;
  command: string;
  description: string;
  requiresParams?: boolean;
  params?: Record<string, CommandParam>;
  notes?: string;
  example?: string;
}

export interface CellConfig {
  cell_id: number;
  [key: string]: any;
}
EOL

# Create ENB PHY/MAC config file
cat > enb/config/phy-mac/index.ts << 'EOL'
import type { CommandTemplate } from '../../../common/types';

export const phyMacCommands: CommandTemplate[] = [
  {
    id: 'set_pdsch_mcs',
    category: 'PHY/MAC',
    subCategory: 'PDSCH',
    label: 'Set PDSCH MCS',
    command: '{"message": "config_set", "cells": {"1": {"pdsch_mcs": 2}}}',
    description: 'Set PDSCH MCS value',
    requiresParams: true,
    params: {
      cell_id: {
        type: 'number',
        description: 'Cell ID',
        required: true,
        default: 1
      },
      mcs: {
        type: 'number',
        description: 'MCS value',
        required: true,
        default: 2,
        min: 0,
        max: 28
      }
    }
  },
  {
    id: 'set_force_dl_schedule',
    category: 'PHY/MAC',
    subCategory: 'PDSCH',
    label: 'Force DL Schedule',
    command: '{"message": "config_set", "cells": {"1": {"force_dl_schedule": true}}}',
    description: 'Force downlink scheduling',
    requiresParams: true,
    params: {
      cell_id: {
        type: 'number',
        description: 'Cell ID',
        required: true,
        default: 1
      }
    }
  },
  {
    id: 'set_pdsch_fixed_rb',
    category: 'PHY/MAC',
    subCategory: 'PDSCH',
    label: 'Set Fixed RB Allocation',
    command: '{"message": "config_set", "cells": {"1": {"pdsch_fixed_rb_alloc": true, "pdsch_fixed_rb_start": 0, "pdsch_fixed_l_crb": 20}}}',
    description: 'Configure fixed resource block allocation for PDSCH',
    requiresParams: true,
    params: {
      cell_id: {
        type: 'number',
        description: 'Cell ID',
        required: true,
        default: 1
      },
      start: {
        type: 'number',
        description: 'Starting RB',
        required: true,
        default: 0
      },
      length: {
        type: 'number',
        description: 'Number of RBs',
        required: true,
        default: 20
      }
    }
  }
];
EOL

# Create ENB SIB config file
cat > enb/config/sib/index.ts << 'EOL'
import type { CommandTemplate } from '../../../common/types';

export const sibCommands: CommandTemplate[] = [
  {
    id: 'set_sib1_pmax',
    category: 'SIB',
    subCategory: 'SIB1',
    label: 'Set SIB1 P-Max',
    command: '{"message": "sib_set", "cells": {"1": {"sib1": {"p_max": 20}}}}',
    description: 'Set P-Max value in SIB1',
    requiresParams: true,
    params: {
      cell_id: {
        type: 'number',
        description: 'Cell ID',
        required: true,
        default: 1
      },
      p_max: {
        type: 'number',
        description: 'P-Max value',
        required: true,
        default: 20
      }
    }
  },
  {
    id: 'set_sib3_hex',
    category: 'SIB',
    subCategory: 'SIB3',
    label: 'Set SIB3 Hex Value',
    command: '{"message": "sib_set", "cells": {"1": {"sib3": {"type": "hex", "payload": "000c16043f95aa0007ae"}}}}',
    description: 'Set SIB3 using hex payload',
    requiresParams: true,
    params: {
      cell_id: {
        type: 'number',
        description: 'Cell ID',
        required: true,
        default: 1
      },
      payload: {
        type: 'hex',
        description: 'Hex payload for SIB3',
        required: true,
        default: '000c16043f95aa0007ae'
      }
    }
  }
];
EOL

# Create cell config file
cat > enb/config/cell/index.ts << 'EOL'
import type { CommandTemplate } from '../../../common/types';

export const cellCommands: CommandTemplate[] = [
  {
    id: 'set_inactivity_timer',
    category: 'Cell',
    label: 'Set Inactivity Timer',
    command: '{"message": "config_set", "cells": {"1": {"inactivity_timer": 60000}}}',
    description: 'Set cell inactivity timer',
    requiresParams: true,
    params: {
      cell_id: {
        type: 'number',
        description: 'Cell ID',
        required: true,
        default: 1
      },
      timer: {
        type: 'number',
        description: 'Timer value in milliseconds',
        required: true,
        default: 60000
      }
    }
  }
];
EOL

# Create main index file for ENB configs
cat > enb/config/index.ts << 'EOL'
export * from './phy-mac';
export * from './sib';
export * from './cell';
EOL

# Create main index for the entire package
cat > index.ts << 'EOL'
import { phyMacCommands } from './enb/config/phy-mac';
import { sibCommands } from './enb/config/sib';
import { cellCommands } from './enb/config/cell';

export const enbCommands = {
  phyMac: phyMacCommands,
  sib: sibCommands,
  cell: cellCommands
};

export * from './common/types';
EOL

echo "RemoteAPI template structure created successfully!"
EOL

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

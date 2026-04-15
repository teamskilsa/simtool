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

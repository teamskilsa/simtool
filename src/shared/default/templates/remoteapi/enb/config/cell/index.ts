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

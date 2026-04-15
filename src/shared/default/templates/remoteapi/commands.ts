// src/shared/users/systems/templates/commands.ts

export interface CommandTemplate {
  id: string;
  category: string;
  label: string;
  command: string;
  description: string;
  requiresParams?: boolean;
  params?: {
    [key: string]: {
      type: 'number' | 'string' | 'boolean';
      description: string;
      required?: boolean;
      default?: any;
    };
  };
  notes?: string;
}

export const commandTemplates: CommandTemplate[] = [
  // Configuration Commands
  {
    id: 'config_get',
    category: 'Configuration',
    label: 'Get Configuration',
    command: '{"message": "config_get"}',
    description: 'Retrieve current system configuration'
  },
  {
    id: 'config_set_logs',
    category: 'Configuration',
    label: 'Set Log Configuration',
    command: '{"message": "config_set", "logs": {"layers": {"PHY": {"level": "debug", "max_size": 1, "payload": true}}, "bcch": false}}',
    description: 'Configure system logging',
    requiresParams: true,
    params: {
      level: {
        type: 'string',
        description: 'Log level (debug, info, warn, error)',
        default: 'debug'
      },
      bcch: {
        type: 'boolean',
        description: 'Enable/disable BCCH logging',
        default: false
      }
    }
  },

  // Statistics Commands
  {
    id: 'stats_basic',
    category: 'Statistics',
    label: 'Basic Statistics',
    command: '{"message": "stats"}',
    description: 'Get basic system statistics'
  },
  {
    id: 'stats_detailed',
    category: 'Statistics',
    label: 'Detailed Statistics',
    command: '{"message": "stats", "samples": true, "rf": true, "Initial_delay": 0.7}',
    description: 'Get detailed statistics including RF and samples'
  },

  // UE Management
  {
    id: 'ue_get',
    category: 'UE Management',
    label: 'Get UE List',
    command: '{"message": "ue_get"}',
    description: 'Get list of connected UEs'
  },
  {
    id: 'ue_get_stats',
    category: 'UE Management',
    label: 'Get UE Stats',
    command: '{"message": "ue_get", "stats": true}',
    description: 'Get UE list with statistics'
  },

  // Cell Management
  {
    id: 'cell_gain',
    category: 'Cell Management',
    label: 'Set Cell Gain',
    command: '{"message": "cell_gain", "cell_id": 1, "gain": -20}',
    description: 'Set cell gain value',
    requiresParams: true,
    params: {
      cell_id: {
        type: 'number',
        description: 'Cell ID',
        required: true
      },
      gain: {
        type: 'number',
        description: 'Gain value in dB',
        required: true
      }
    },
    notes: 'cell_id should match your test environment'
  },

  // RF Configuration
  {
    id: 'rf_get',
    category: 'RF',
    label: 'Get RF Config',
    command: '{"message": "rf"}',
    description: 'Get RF configuration'
  },
  {
    id: 'rf_tx_gain',
    category: 'RF',
    label: 'Set TX Gain',
    command: '{"message": "rf", "tx_gain": 70}',
    description: 'Set RF TX gain'
  },
  {
    id: 'rf_rx_gain',
    category: 'RF',
    label: 'Set RX Gain',
    command: '{"message": "rf", "rx_gain": 50}',
    description: 'Set RF RX gain'
  },

  // Connection Management
  {
    id: 's1_status',
    category: 'Connection',
    label: 'S1 Status',
    command: '{"message": "s1"}',
    description: 'Get S1 connection status'
  },
  {
    id: 's1_connect',
    category: 'Connection',
    label: 'S1 Connect',
    command: '{"message": "s1connect"}',
    description: 'Establish S1 connection'
  },
  {
    id: 'ng_status',
    category: 'Connection',
    label: 'NG Status',
    command: '{"message": "ng"}',
    description: 'Get NG connection status'
  },

  // RRC Commands
  {
    id: 'rrc_ue_info',
    category: 'RRC',
    label: 'UE Info Request',
    command: '{"message": "rrc_ue_info_req", "enb_ue_id": 24, "req_mask": 0}',
    description: 'Request UE information',
    requiresParams: true,
    params: {
      enb_ue_id: {
        type: 'number',
        description: 'eNB UE ID',
        required: true
      }
    }
  },

  // SIB Management
  {
    id: 'sib_set',
    category: 'SIB',
    label: 'Set SIB Parameters',
    command: '{"message": "sib_set", "cells": {"1": {"sib1": {"p_max": 20}}}}',
    description: 'Configure SIB parameters'
  }
];

// Categorized commands for easier access
export const commandCategories = Array.from(
  new Set(commandTemplates.map(t => t.category))
).sort();

// Get commands by category
export const getCommandsByCategory = (category: string) => 
  commandTemplates.filter(t => t.category === category);

// Get command by ID
export const getCommandById = (id: string) =>
  commandTemplates.find(t => t.id === id);

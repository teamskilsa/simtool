// src/modules/remoteAPI/components/command-selector.tsx

import { useState, useEffect } from 'react';
import { ThemeConfig } from '@/components/theme/types/theme.types';

interface CommandSelectorProps {
  componentType: 'ENB' | 'UE' | 'MME' | 'IMS' | 'MBMS';
  themeConfig: ThemeConfig;
  onCommandSelect: (command: string) => void;
}

// Define basic command categories
const COMMAND_CATEGORIES = {
  'ENB': [
    {
      name: 'Configuration',
      commands: [
        { label: 'Get Configuration', value: '{"message": "config_get"}' },
        { label: 'Basic Log Config', value: '{"message": "config_set", "logs": {"bcch": false}}' },
        { label: 'Detailed Log Config', value: '{"message": "config_set", "logs": {"layers": {"PHY": {"level": "debug", "max_size": 1, "payload": true}}, "bcch": false}}' }
      ]
    },
    {
      name: 'Statistics',
      commands: [
        { label: 'Basic Stats', value: '{"message": "stats"}' },
        { label: 'Stats with Samples', value: '{"message": "stats", "samples": true}' },
        { label: 'Full Stats', value: '{"message": "stats", "samples": true, "rf": true, "Initial_delay": 0.7}' }
      ]
    },
    {
      name: 'Cell Management',
      commands: [
        { label: 'Cell Gain', value: '{"message": "cell_gain", "cell_id": 1, "gain": -20}' },
        { label: 'Inactivity Timer', value: '{"message": "config_set", "cells": {"1": {"inactivity_timer": 60000}}}' }
      ]
    },
    {
      name: 'PHY/MAC',
      commands: [
        { label: 'Set PDSCH MCS', value: '{"message": "config_set", "cells": {"1": {"pdsch_mcs": 2}}}' },
        { label: 'Force DL Schedule', value: '{"message": "config_set", "cells": {"1": {"force_dl_schedule": true}}}' },
        { label: 'Fixed RB Allocation', value: '{"message": "config_set", "cells": {"1": {"pdsch_fixed_rb_alloc": true, "pdsch_fixed_rb_start": 0, "pdsch_fixed_l_crb": 20}}}' },
        { label: 'Set PUSCH MCS', value: '{"message": "config_set", "cells": {"1": {"pusch_mcs": 2}}}' },
        { label: 'Force Full BSR', value: '{"message": "config_set", "cells": {"1": {"force_full_bsr": true}}}' }
      ]
    },
    {
      name: 'SIB Management',
      commands: [
        { label: 'Set SIB1 P-Max', value: '{"message": "sib_set", "cells": {"1": {"sib1": {"p_max": 20}}}}' },
        { label: 'Set SIB3 Hex', value: '{"message": "sib_set", "cells": {"1": {"sib3": {"type": "hex", "payload": "000c16043f95aa0007ae"}}}}' }
      ]
    },
    {
      name: 'UE Management',
      commands: [
        { label: 'Get UE List', value: '{"message": "ue_get"}' },
        { label: 'UE List with Stats', value: '{"message": "ue_get", "stats": true}' },
        { label: 'ERAB List', value: '{"message": "erab_get"}' },
        { label: 'QoS Flow List', value: '{"message": "qos_flow_get"}' }
      ]
    },
    {
      name: 'RF Management',
      commands: [
        { label: 'Get RF Status', value: '{"message": "rf"}' },
        { label: 'Set TX Gain', value: '{"message": "rf", "tx_gain": 70}' },
        { label: 'Set RX Gain', value: '{"message": "rf", "rx_gain": 50}' }
      ]
    }
  ],
  'MME': [
    {
      name: 'Configuration',
      commands: [
        { label: 'Get Configuration', value: '{"message": "config_get"}' }
      ]
    }
  ],
  'UE': [
    {
      name: 'Configuration',
      commands: [
        { label: 'Get Configuration', value: '{"message": "config_get"}' }
      ]
    }
  ]
} as const;

export function CommandSelector({ componentType, themeConfig, onCommandSelect }: CommandSelectorProps) {
  const [category, setCategory] = useState('');
  const [command, setCommand] = useState('');

  const categories = COMMAND_CATEGORIES[componentType] || [];

  useEffect(() => {
    setCategory('');
    setCommand('');
  }, [componentType]);

  const handleCommandSelect = (value: string) => {
    setCommand(value);
    onCommandSelect(value);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Category Selection */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${themeConfig.surfaces.card.foreground}`}>
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`w-full rounded-lg px-3 py-2 
              ${themeConfig.components.select.trigger}
              text-gray-900 dark:text-gray-100
              bg-white dark:bg-gray-800
              border-gray-200 dark:border-gray-700`}
          >
            <option value="">Select Category</option>
            {categories.map((cat, index) => (
              <option key={index} value={cat.name} className="text-gray-900 dark:text-gray-100">
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Command Selection */}
        {category && (
          <div>
            <label className={`block text-sm font-medium mb-2 ${themeConfig.surfaces.card.foreground}`}>
              Command
            </label>
            <select
              value={command}
              onChange={(e) => handleCommandSelect(e.target.value)}
              className={`w-full rounded-lg px-3 py-2
                ${themeConfig.components.select.trigger}
                text-gray-900 dark:text-gray-100
                bg-white dark:bg-gray-800
                border-gray-200 dark:border-gray-700`}
            >
              <option value="">Select Command</option>
              {categories
                .find(cat => cat.name === category)
                ?.commands.map((cmd, index) => (
                  <option key={index} value={cmd.value} className="text-gray-900 dark:text-gray-100">
                    {cmd.label}
                  </option>
                ))
              }
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
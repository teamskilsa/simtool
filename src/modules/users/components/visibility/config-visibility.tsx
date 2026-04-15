// modules/users/components/visibility/config-visibility.tsx
'use client';

import { useState } from 'react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { Eye, Users, Globe, Lock, Info } from 'lucide-react';
import type { VisibilityLevel } from '../../types';
import { useUser } from '../../context/user-context';

interface ConfigVisibilityProps {
  configId: string;
  visibility: VisibilityLevel;
  onChange: (visibility: VisibilityLevel) => void;
}

export function ConfigVisibility({ configId, visibility, onChange }: ConfigVisibilityProps) {
  const { theme } = useTheme();
  const { user } = useUser();
  const themeConfig = themes[theme];

  const visibilityOptions = [
    {
      value: 'private' as const,
      label: 'Private',
      icon: Lock,
      description: 'Only you can view this configuration'
    },
    {
      value: 'team' as const,
      label: 'Team',
      icon: Users,
      description: 'Your team members can view this configuration'
    },
    {
      value: 'public' as const,
      label: 'Public',
      icon: Globe,
      description: 'All users can view this configuration'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Eye className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Visibility Settings</h3>
      </div>

      <div className={`
        rounded-lg border
        ${themeConfig.surfaces.card.border}
      `}>
        {visibilityOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              w-full flex items-center p-4
              ${visibility === option.value 
                ? `${themeConfig.surfaces.card.hover} bg-opacity-50`
                : 'hover:bg-opacity-30'
              }
              ${option.value !== visibilityOptions[visibilityOptions.length - 1].value && 
                `border-b ${themeConfig.surfaces.card.border}`
              }
            `}
          >
            <div className={`
              w-10 h-10 rounded-lg
              flex items-center justify-center
              ${visibility === option.value 
                ? themeConfig.components.button.variants.default
                : 'bg-gray-100'
              }
            `}>
              <option.icon className={`
                w-5 h-5
                ${visibility === option.value ? 'text-white' : 'text-gray-500'}
              `} />
            </div>

            <div className="ml-4 flex-1 text-left">
              <div className="font-medium">{option.label}</div>
              <div className="text-sm text-gray-500">
                {option.description}
              </div>
            </div>

            <div className={`
              w-5 h-5 rounded-full border-2
              ${visibility === option.value
                ? `${themeConfig.components.button.variants.default} border-none`
                : 'border-gray-300'
              }
              flex items-center justify-center
            `}>
              {visibility === option.value && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
          </button>
        ))}
      </div>

      {visibility !== 'private' && (
        <div className={`
          flex items-center space-x-2 p-3 rounded-lg
          bg-blue-50 text-blue-800
        `}>
          <Info className="w-5 h-5" />
          <span className="text-sm">
            {visibility === 'team' 
              ? 'Team members will be notified when you share this configuration'
              : 'This configuration will be visible to all users'}
          </span>
        </div>
      )}
    </div>
  );
}

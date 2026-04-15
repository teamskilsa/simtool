import { useState } from 'react';
import { VisibilityLevel, ConfigVisibility } from '../types';
import { useUser } from '../context/user-context';

export function useVisibility() {
  const { user } = useUser();
  const [visibilitySettings, setVisibilitySettings] = useState<Record<string, ConfigVisibility>>({});

  const setConfigVisibility = (configId: string, level: VisibilityLevel, teamId?: string) => {
    setVisibilitySettings(prev => ({
      ...prev,
      [configId]: {
        configId,
        level,
        teamId,
        allowedUsers: level === 'team' ? [user?.id || ''] : undefined,
      },
    }));
  };

  const canAccessConfig = (configId: string, userId: string): boolean => {
    const settings = visibilitySettings[configId];
    if (!settings) return false;

    switch (settings.level) {
      case 'public':
        return true;
      case 'team':
        return settings.allowedUsers?.includes(userId) || false;
      case 'private':
        return settings.allowedUsers?.[0] === userId;
      default:
        return false;
    }
  };

  return {
    visibilitySettings,
    setConfigVisibility,
    canAccessConfig,
  };
}

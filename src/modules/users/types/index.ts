export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  team?: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: string;
  sidebarOpen: boolean;
  defaultVisibility: 'private' | 'team' | 'public';
  notifications: {
    configChanges: boolean;
    teamUpdates: boolean;
  };
}

export type VisibilityLevel = 'private' | 'team' | 'public';

export interface ConfigVisibility {
  configId: string;
  level: VisibilityLevel;
  teamId?: string;
  allowedUsers?: string[];
}

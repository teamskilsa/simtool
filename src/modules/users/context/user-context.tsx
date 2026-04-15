// modules/users/context/user-context.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/components/theme/context/theme-context';
import type { User, UserPreferences } from '../types';

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  isAdmin: boolean;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'indigo',
  sidebarOpen: true,
  defaultVisibility: 'private',
  notifications: {
    configChanges: true,
    teamUpdates: true,
  },
};

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setTheme } = useTheme();

  // Load user and apply theme on mount
  useEffect(() => {
    const loadUser = () => {
      try {
        setLoading(true);
        const userData = localStorage.getItem('user_data');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          // Apply saved theme
          if (parsedUser.preferences?.theme) {
            setTheme(parsedUser.preferences.theme);
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [setTheme]);

  const updatePreferences = useCallback(async (preferences: Partial<UserPreferences>) => {
    if (!user) return;

    try {
      const updatedUser = {
        ...user,
        preferences: {
          ...user.preferences,
          ...preferences,
        },
        updatedAt: new Date().toISOString(),
      };

      // Update local state
      setUser(updatedUser);

      // Update stored user data
      localStorage.setItem('user_data', JSON.stringify(updatedUser));

      // Update theme if changed
      if (preferences.theme) {
        setTheme(preferences.theme);
        localStorage.setItem('selected_theme', preferences.theme);
      }

      // Update user in stored users list
      const storedUsers = JSON.parse(localStorage.getItem('stored_users') || '[]');
      const updatedUsers = storedUsers.map((u: User) => 
        u.id === user.id ? updatedUser : u
      );
      localStorage.setItem('stored_users', JSON.stringify(updatedUsers));

    } catch (error) {
      console.error('Error updating preferences:', error);
      throw new Error('Failed to update preferences');
    }
  }, [user, setTheme]);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        updatePreferences,
        isAdmin: user?.role === 'admin',
        loading,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
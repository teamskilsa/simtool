// modules/users/context/auth-persist.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from './user-context';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'auth_state';
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

const AuthPersistContext = createContext<AuthContextType | undefined>(undefined);

export function AuthPersistProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    refreshToken: null,
    expiresAt: null
  });
  
  const router = useRouter();
  const { login: userLogin, logout: userLogout } = useUser();

  useEffect(() => {
    // Load auth state from storage
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedAuth) {
      const parsedAuth: AuthState = JSON.parse(storedAuth);
      
      // Check if token is expired
      if (parsedAuth.expiresAt && parsedAuth.expiresAt > Date.now()) {
        setAuthState(parsedAuth);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    // Set up token refresh interval
    if (authState.token && authState.expiresAt) {
      const timeUntilRefresh = authState.expiresAt - Date.now() - TOKEN_REFRESH_THRESHOLD;
      
      if (timeUntilRefresh > 0) {
        const refreshTimeout = setTimeout(() => {
          refreshToken();
        }, timeUntilRefresh);

        return () => clearTimeout(refreshTimeout);
      }
    }
  }, [authState.token, authState.expiresAt]);

  const refreshToken = async () => {
    if (!authState.refreshToken) return;

    try {
      // Here you would typically make an API call to refresh the token
      // For demo purposes, we'll just extend the expiration
      const newAuthState: AuthState = {
        ...authState,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      };
      
      setAuthState(newAuthState);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
    } catch (error) {
      console.error('Error refreshing token:', error);
      await logout();
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    const success = await userLogin(username, password);
    
    if (success) {
      // In a real app, you'd get these from your backend
      const newAuthState: AuthState = {
        token: 'demo-token',
        refreshToken: 'demo-refresh-token',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      };
      
      setAuthState(newAuthState);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
    }
    
    return success;
  };

  const logout = async () => {
    setAuthState({
      token: null,
      refreshToken: null,
      expiresAt: null
    });
    localStorage.removeItem(AUTH_STORAGE_KEY);
    await userLogout();
    router.push('/login');
  };

  return (
    <AuthPersistContext.Provider
      value={{
        isAuthenticated: !!authState.token,
        token: authState.token,
        login,
        logout,
      }}
    >
      {children}
    </AuthPersistContext.Provider>
  );
}

export function useAuthPersist() {
  const context = useContext(AuthPersistContext);
  if (context === undefined) {
    throw new Error('useAuthPersist must be used within an AuthPersistProvider');
  }
  return context;
}

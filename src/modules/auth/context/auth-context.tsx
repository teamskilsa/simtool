// modules/auth/context/auth-context.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '../types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
  checkAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const checkAuth = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');
      
      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.clear();
        router.push('/');
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
      setIsAuthenticated(false);
      localStorage.clear();
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', 'demo-token');
      localStorage.setItem('user_data', JSON.stringify(userData));
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
    }
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user,
      login, 
      logout,
      isLoading,
      checkAuth 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
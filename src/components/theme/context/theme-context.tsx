// src/components/theme/context/theme-context.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { themes, type ThemeVariant } from '../themes';

interface ThemeContextType {
  theme: ThemeVariant;
  mode: 'light' | 'dark';
  setTheme: (theme: ThemeVariant) => void;
  setMode: (mode: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'indigo',   // Changed from 'light' to 'indigo'
  mode: 'light',
  setTheme: () => null,
  setMode: () => null,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeVariant>('indigo');  // Changed from 'light' to 'indigo'
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as ThemeVariant;
    const savedMode = localStorage.getItem('mode') as 'light' | 'dark';
    
    if (savedTheme && themes[savedTheme]) {
      setTheme(savedTheme);
    } else {
      // Set indigo as default if no saved theme
      setTheme('indigo');
      localStorage.setItem('theme', 'indigo');
    }

    if (savedMode) {
      setMode(savedMode);
    } else {
      // Check system preference
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(systemDark ? 'dark' : 'light');
    }
  }, []);

  const updateTheme = (newTheme: ThemeVariant) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const updateMode = (newMode: 'light' | 'dark') => {
    setMode(newMode);
    localStorage.setItem('mode', newMode);
  };

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        mode, 
        setTheme: updateTheme, 
        setMode: updateMode 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
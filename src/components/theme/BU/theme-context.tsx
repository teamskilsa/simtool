// modules/theme/context/theme-context.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { themes, type ThemeType, defaultTheme } from '../themes';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  setTheme: () => null,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeType>(defaultTheme);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as ThemeType;
    if (savedTheme && themes[savedTheme]) {
      setTheme(savedTheme);
    }
  }, []);

  const updateTheme = (newTheme: ThemeType) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: updateTheme }}>
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
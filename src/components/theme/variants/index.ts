// src/components/theme/variants/index.ts

// Import individual theme files
export { indigoTheme } from './indigo';
export { roseTheme } from './rose';
export { amberTheme } from './amber';
export { emeraldTheme } from './emerald';
export { skyTheme } from './sky';
export { tealTheme } from './teal';
export { simpleTheme } from './simple';

// Export themes object
export const themes = {
  indigo: indigoTheme,
  rose: roseTheme,
  amber: amberTheme,
  emerald: emeraldTheme,
  sky: skyTheme,
  teal: tealTheme,
  simple: simpleTheme
} as const;

// Re-export theme types
export type {
  ThemeConfig,
  ThemeMode,
  ThemeVariant,
  ThemeContextType,
  ColorScale,
  SemanticColors,
  StatusColors,
  Surfaces,
  ComponentStyles,
  Effects,
  DialogStyles
} from '../types/theme.types';

// Export theme utility functions
export const getThemeNames = () => Object.keys(themes) as ThemeVariant[];

export const getNextTheme = (currentTheme: ThemeVariant): ThemeVariant => {
  const themeNames = getThemeNames();
  const currentIndex = themeNames.indexOf(currentTheme);
  return themeNames[(currentIndex + 1) % themeNames.length];
};

export const getPreviousTheme = (currentTheme: ThemeVariant): ThemeVariant => {
  const themeNames = getThemeNames();
  const currentIndex = themeNames.indexOf(currentTheme);
  return themeNames[(currentIndex - 1 + themeNames.length) % themeNames.length];
};

// Validation utility (can be expanded)
export const isValidTheme = (theme: unknown): theme is ThemeVariant => {
  return typeof theme === 'string' && theme in themes;
};

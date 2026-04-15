// src/components/theme/themes.ts
import { lightTheme } from './variants/light';
import { tealTheme } from './variants/teal';
import { indigoTheme } from './variants/indigo';
import { roseTheme } from './variants/rose';
import { amberTheme } from './variants/amber';
import { emeraldTheme } from './variants/emerald';
import { skyTheme } from './variants/sky';

// Combined themes object
export const themes = {
  light: lightTheme,
  teal: tealTheme,
  indigo: indigoTheme,
  rose: roseTheme,
  amber: amberTheme,
  emerald: emeraldTheme,
  sky: skyTheme
} as const;

// Theme grouping for organization in theme selector
export const themeGroups = {
  primary: ['light', 'teal', 'sky', 'indigo'] as const,
  accent: ['rose', 'amber', 'emerald'] as const
} as const;

export type ThemeVariant = keyof typeof themes;
export type ThemeGroupType = keyof typeof themeGroups;

// Re-export types
export type {
  ThemeConfig,
  ThemeMode,
  ColorScale,
  SemanticColors,
  StatusColors,
  Surfaces,
  ComponentStyles,
  Effects
} from './types/theme.types';

// Re-export utilities
export { baseComponents } from './utils/base-components';
export { 
  palette, 
  statusColors, 
  commonColors, 
  glassOpacities 
} from './utils/palette';

export const defaultTheme: ThemeVariant = 'light';
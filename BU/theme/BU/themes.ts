import { simpleTheme } from './variants/simple';
import { tealTheme } from './variants/teal';
import { indigoTheme } from './variants/indigo';
import { roseTheme } from './variants/rose';
import { amberTheme } from './variants/amber';
import { emeraldTheme } from './variants/emerald';
import { skyTheme } from './variants/sky';

// Base layout styles that are consistent across themes
export const layoutStyles = {
  section: {
    wrapper: 'space-y-6',
    container: 'p-4 rounded-lg bg-opacity-50 backdrop-blur-sm',
    header: 'text-sm font-medium mb-4',
    content: 'space-y-4',
    grid: 'grid grid-cols-1 md:grid-cols-3 gap-6'
  },
  card: {
    wrapper: 'rounded-lg shadow-sm backdrop-blur-sm',
    header: 'px-6 py-4',
    content: 'p-6',
    hover: 'transition-all duration-200 hover:shadow-md',
    interactive: 'cursor-pointer transform transition-transform hover:scale-[1.02]'
  },
  form: {
    group: 'space-y-4',
    label: 'block text-sm font-medium',
    input: 'mt-1 block w-full rounded-md',
    error: 'text-sm text-red-600 mt-1',
    helper: 'text-xs mt-1 text-gray-500'
  },
  button: {
    base: 'rounded-lg font-medium transition-all duration-200',
    sizes: {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg'
    }
  },
  animation: {
    hover: 'transition-all duration-200',
    spin: 'animate-spin',
    pulse: 'animate-pulse',
    bounce: 'animate-bounce'
  },
  effects: {
    glass: 'backdrop-blur-sm bg-opacity-50',
    frosted: 'backdrop-blur-md bg-opacity-30',
    glow: 'shadow-lg shadow-current/30'
  }
};

// Combined themes object
export const themes = {
  simple: simpleTheme,
  teal: tealTheme,
  indigo: indigoTheme,
  rose: roseTheme,
  amber: amberTheme,
  emerald: emeraldTheme,
  sky: skyTheme
} as const;

// Theme grouping for organization in theme selector
export const themeGroups = {
  primary: ['simple', 'teal', 'sky', 'indigo'],
  accent: ['rose', 'amber', 'emerald']
} as const;

// Theme utility functions
export const themeUtils = {
  // Get contrasting text color based on background
  getContrastText: (bgColor: string) => {
    return bgColor.includes('white') || bgColor.includes('light') 
      ? 'text-gray-900' 
      : 'text-white';
  },
  
  // Get button size classes
  getSize: (size: 'sm' | 'md' | 'lg') => layoutStyles.button.sizes[size],
  
  // Get glass effect classes
  getGlassEffect: (intensity: 'light' | 'medium' | 'heavy') => {
    const effects = {
      light: 'backdrop-blur-sm bg-opacity-30',
      medium: 'backdrop-blur-md bg-opacity-50',
      heavy: 'backdrop-blur-lg bg-opacity-70'
    };
    return effects[intensity];
  },

  // Combine theme classes with custom classes
  combineClasses: (...classes: string[]) => {
    return classes.filter(Boolean).join(' ');
  }
};

// Type definitions
export type ThemeType = keyof typeof themes;
export type ThemeGroupType = keyof typeof themeGroups;

export interface ThemeConfig {
  name: string;
  gradient: string;
  accent: string;
  accentHover: string;
  accentFocus: string;
  blur: string;
  text: string;
  border: string;
  colors: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    primaryText: string;
    secondary: string;
    secondaryHover: string;
    card: string;
    cardHover: string;
    sidebar: string;
    header: string;
    hover: string;
    muted: string;
    mutedHover: string;
    divider: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    surface: string;
    surfaceHover: string;
  };
  badges: {
    default: string;
    new: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  status: {
    online: string;
    offline: string;
    busy: string;
    away: string;
  };
  components: {
    input: string;
    inputFocus: string;
    button: string;
    buttonHover: string;
    card: string;
    cardHover: string;
    dropdown: string;
    dropdownHover: string;
    tooltip: string;
    modal: string;
    toast: string;
  };
  dark?: {
    gradient: string;
    accent: string;
    accentHover: string;
    text: string;
    border: string;
    colors: {
      primary: string;
      primaryLight: string;
      primaryDark: string;
      primaryText: string;
      secondary: string;
      secondaryHover: string;
      card: string;
      cardHover: string;
      sidebar: string;
      header: string;
      hover: string;
      muted: string;
      mutedHover: string;
      divider: string;
      surface: string;
      surfaceHover: string;
    };
  };
}

// Default theme
export const defaultTheme: ThemeType = 'simple';
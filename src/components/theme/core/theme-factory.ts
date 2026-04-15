// src/components/theme/core/theme-factory.ts

import { palette, statusColors, commonColors, glassOpacities } from '../utils/palette';
import { baseComponents } from '../utils/base-components';
import type { ThemeConfig, ColorPalette } from '../types/theme.types';

export type ThemeColorScheme = {
  primary: keyof typeof palette;
  accent: keyof typeof palette;
  name: string;
};

const themeColorSchemes: Record<string, ThemeColorScheme> = {
  indigo: {
    name: 'Indigo',
    primary: 'indigo',
    accent: 'violet'
  },
  rose: {
    name: 'Rose',
    primary: 'rose',
    accent: 'pink'
  },
  amber: {
    name: 'Amber',
    primary: 'amber',
    accent: 'orange'
  },
  emerald: {
    name: 'Emerald',
    primary: 'emerald',
    accent: 'green'
  },
  sky: {
    name: 'Sky',
    primary: 'sky',
    accent: 'blue'
  },
  teal: {
    name: 'Teal',
    primary: 'teal',
    accent: 'cyan'
  }
} as const;

export type ThemeVariant = keyof typeof themeColorSchemes;

export function createThemeConfig(variant: ThemeVariant): ThemeConfig {
  const scheme = themeColorSchemes[variant];
  const { primary, accent, name } = scheme;

  return {
    name,
    colors: {
      primary: { ...palette[primary], foreground: commonColors.white },
      secondary: { ...palette.gray, foreground: commonColors.white },
      accent: { ...palette[accent], foreground: commonColors.white },
      destructive: { ...palette.red, foreground: commonColors.white },
      success: { ...palette.emerald, foreground: commonColors.white },
      warning: { ...palette.amber, foreground: commonColors.white },
      info: { ...palette.sky, foreground: commonColors.white },
      muted: palette.gray[500]
    },
    typography: {
      font: {
        sans: 'var(--font-inter)',
        mono: 'var(--font-mono)',
        heading: 'var(--font-heading)'
      },
      weight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700'
      },
      size: {
        xs: 'text-xs',
        sm: 'text-sm',
        base: 'text-base',
        lg: 'text-lg',
        xl: 'text-xl',
        '2xl': 'text-2xl',
        '3xl': 'text-3xl',
        '4xl': 'text-4xl'
      },
      spacing: {
        tight: 'tracking-tight',
        normal: 'tracking-normal',
        wide: 'tracking-wide'
      }
    },
    status: {
      ...statusColors,
      info: palette[primary][600]
    },
    surfaces: {
      page: {
        background: commonColors.background.light,
        foreground: palette[primary][900],
        border: palette[primary][200]
      },
      card: {
        background: `${commonColors.white}/0.8`,
        foreground: palette[primary][900],
        border: palette[primary][200],
        hover: palette[primary][50]
      },
      sidebar: {
        background: `${commonColors.white}/0.9`,
        foreground: palette[primary][900],
        border: palette[primary][200],
        hover: palette[primary][50]
      },
      header: {
        background: `${commonColors.white}/0.9`,
        foreground: palette[primary][900],
        border: palette[primary][200]
      },
      dropdown: {
        background: `${commonColors.white}/0.98`,
        foreground: palette[primary][900],
        border: palette[primary][200],
        hover: palette[primary][50]
      },
      modal: {
        background: commonColors.white,
        foreground: palette[primary][900],
        border: palette[primary][200],
        overlay: commonColors.overlay.light
      }
    },
    components: {
      button: {
        ...baseComponents.button,
        variants: {
          default: `bg-${primary}-600 text-white hover:bg-${primary}-700`,
          secondary: `bg-${primary}-100 text-${primary}-700 hover:bg-${primary}-200`,
          outline: `border border-${primary}-200 bg-transparent hover:bg-${primary}-50`,
          ghost: `hover:bg-${primary}-50 hover:text-${primary}-700`,
          link: `text-${primary}-600 underline-offset-4 hover:underline`,
          destructive: `bg-red-600 text-white hover:bg-red-700`
        }
      },
      input: {
        ...baseComponents.input,
        variants: {
          default: `bg-white/50 border-${primary}-200`,
          filled: `bg-${primary}-50 border-${primary}-200`,
          outline: `bg-transparent border-2 border-${primary}-200`,
          ghost: 'border-0 bg-transparent'
        },
        states: {
          focus: `ring-2 ring-${primary}-500`,
          error: 'border-red-500 focus:ring-red-500',
          disabled: 'opacity-50 cursor-not-allowed'
        }
      },
      select: {
        ...baseComponents.select,
        trigger: `flex h-10 w-full items-center justify-between rounded-md border border-${primary}-200 bg-white/50 px-3 py-2`,
        content: `relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-${primary}-200 bg-white shadow-md animate-in fade-in-80`,
        item: `relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-${primary}-50 focus:text-${primary}-900`,
        itemHighlighted: `bg-${primary}-50 text-${primary}-900`
      },
      badge: {
        base: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants: {
          default: `border-transparent bg-${primary}-600 text-white`,
          secondary: `border-transparent bg-${primary}-100 text-${primary}-700`,
          outline: `border-${primary}-200 text-${primary}-700`,
          destructive: 'border-transparent bg-red-600 text-white'
        }
      },
      card: {
        ...baseComponents.card,
        interactive: 'hover:shadow-md transition-shadow cursor-pointer'
      },
      navigation: {
        ...baseComponents.navigation,
        item: `flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-${primary}-50 transition-colors`,
        itemActive: `bg-${primary}-50 text-${primary}-700 font-medium`,
        subItem: `flex items-center gap-2 rounded-lg px-3 py-2 pl-10 hover:bg-${primary}-50 transition-colors`,
        subItemActive: `bg-${primary}-50 text-${primary}-700 font-medium`
      }
    },
    shadows: {
      sm: 'shadow-sm',
      base: 'shadow',
      md: 'shadow-md',
      lg: 'shadow-lg',
      xl: 'shadow-xl',
      inner: 'shadow-inner',
      none: 'shadow-none'
    },
    spacing: {
      px: '1px',
      0: '0',
      0.5: '0.125rem',
      1: '0.25rem',
      1.5: '0.375rem',
      2: '0.5rem',
      2.5: '0.625rem',
      3: '0.75rem',
      3.5: '0.875rem',
      4: '1rem',
      5: '1.25rem',
      6: '1.5rem',
      7: '1.75rem',
      8: '2rem',
      9: '2.25rem',
      10: '2.5rem',
      11: '2.75rem',
      12: '3rem',
      14: '3.5rem',
      16: '4rem',
      20: '5rem',
      24: '6rem',
      28: '7rem',
      32: '8rem',
      36: '9rem',
      40: '10rem',
      44: '11rem',
      48: '12rem',
      52: '13rem',
      56: '14rem',
      60: '15rem',
      64: '16rem',
      72: '18rem',
      80: '20rem',
      96: '24rem'
    },
    effects: {
      blur: {
        sm: 'backdrop-blur-sm',
        md: 'backdrop-blur-md',
        lg: 'backdrop-blur-lg'
      },
      glass: {
        light: `bg-${primary}-50/${glassOpacities.light.low} backdrop-blur-sm`,
        medium: `bg-${primary}-50/${glassOpacities.light.medium} backdrop-blur-md`,
        heavy: `bg-${primary}-50/${glassOpacities.light.high} backdrop-blur-lg`
      },
      animation: {
        fade: 'transition-opacity',
        slide: 'transition-transform',
        scale: 'transition-all',
        spin: 'animate-spin'
      },
      transition: {
        fast: 'transition-all duration-150',
        default: 'transition-all duration-200',
        slow: 'transition-all duration-300'
      }
    },
    gradients: {
      primary: `bg-gradient-to-br from-${primary}-400 via-${primary}-50 to-white`,
      secondary: 'bg-gradient-to-br from-gray-100 via-gray-50 to-white',
      accent: `bg-gradient-to-br from-${accent}-400/80 via-${accent}-50 to-white`,
      background: `bg-gradient-to-br from-${primary}-400/20 via-${primary}-50 to-white`
    },
    dialogs: {
      header: {
        background: `bg-${primary}-600`,
        text: 'text-white font-semibold'
      },
      content: {
        background: `bg-white dark:bg-slate-900`,
        border: `border border-${primary}-200 dark:border-slate-700`
      },
      input: {
        background: 'bg-white dark:bg-slate-900',
        border: `border border-${primary}-200 dark:border-slate-700`,
        text: 'text-slate-900 dark:text-slate-100',
        placeholder: 'placeholder:text-slate-400 dark:placeholder:text-slate-500',
        focus: `focus:ring-2 focus:ring-${primary}-500/20 focus:border-${primary}-500/30`,
        hover: `hover:bg-${primary}-50/50 dark:hover:bg-slate-800/50`
      },
      sizes: {
        sm: { width: '440px', maxWidth: '90vw' },
        md: { width: '540px', maxWidth: '90vw' },
        lg: { width: '640px', maxWidth: '90vw' }
      },
      effects: {
        blur: 'backdrop-blur-md',
        saturation: 'backdrop-saturate-150'
      }
    },
    darkMode: {
      colors: {
        primary: { ...palette[primary], foreground: commonColors.white },
        secondary: { ...palette.gray, foreground: commonColors.white },
        accent: { ...palette[accent], foreground: commonColors.white },
        destructive: { ...palette.red, foreground: commonColors.white },
        success: { ...palette.emerald, foreground: commonColors.white },
        warning: { ...palette.amber, foreground: commonColors.white },
        info: { ...palette.sky, foreground: commonColors.white },
        muted: palette.gray[400]
      },
      surfaces: {
        page: {
          background: commonColors.background.dark,
          foreground: palette[primary][100],
          border: palette[primary][800]
        },
        card: {
          background: 'rgb(17 17 17 / 0.8)',
          foreground: palette[primary][100],
          border: palette[primary][800],
          hover: `${palette[primary][900]}/50`
        },
        sidebar: {
          background: 'rgb(17 17 17 / 0.9)',
          foreground: palette[primary][100],
          border: palette[primary][800],
          hover: `${palette[primary][900]}/50`
        }
      },
      effects: {
        glass: {
          light: `bg-${primary}-900/${glassOpacities.dark.low} backdrop-blur-sm`,
          medium: `bg-${primary}-900/${glassOpacities.dark.medium} backdrop-blur-md`,
          heavy: `bg-${primary}-900/${glassOpacities.dark.high} backdrop-blur-lg`
        }
      }
    }
  };
}

// Create individual theme exports
export const indigoTheme = createThemeConfig('indigo');
export const roseTheme = createThemeConfig('rose');
export const amberTheme = createThemeConfig('amber');
export const emeraldTheme = createThemeConfig('emerald');
export const skyTheme = createThemeConfig('sky');
export const tealTheme = createThemeConfig('teal');

// Export configured themes object
export const themes = {
  indigo: indigoTheme,
  rose: roseTheme,
  amber: amberTheme,
  emerald: emeraldTheme,
  sky: skyTheme,
  teal: tealTheme
} as const;

// Utility functions
export const getThemeNames = () => Object.keys(themeColorSchemes);

export const addTheme = (id: string, scheme: ThemeColorScheme) => {
  themeColorSchemes[id] = scheme;
  themes[id] = createThemeConfig(id as ThemeVariant);
};

export const validateTheme = (theme: ThemeConfig): boolean => {
  // Add validation logic as needed
  return true;
};
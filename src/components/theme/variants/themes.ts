// src/components/theme/variants/themes.ts

import type { ThemeConfig } from '../types/theme.types';
import { baseTheme } from './base-theme';
import { palette, commonColors, glassOpacities } from '../utils/palette';

type ColorVariant = {
  primary: keyof typeof palette;
  accent: keyof typeof palette;
  name: string;
};

const variants: Record<string, ColorVariant> = {
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
};

function createTheme(variant: ColorVariant): ThemeConfig {
  const { primary, accent, name } = variant;

  return {
    ...baseTheme,
    name,
    colors: {
      primary: { ...palette[primary], foreground: commonColors.white },
      secondary: { ...palette.gray, foreground: commonColors.white },
      accent: { ...palette[accent], foreground: commonColors.white },
      destructive: { ...palette.red, foreground: commonColors.white },
      success: { ...palette.emerald, foreground: commonColors.white },
      warning: { ...palette.amber, foreground: commonColors.white },
      info: { ...palette.sky, foreground: commonColors.white }
    },
    surfaces: {
      ...baseTheme.surfaces,
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
      }
    },
    components: {
      ...baseTheme.components,
      button: {
        ...baseTheme.components.button,
        variants: {
          default: `bg-${primary}-600 text-white hover:bg-${primary}-700`,
          secondary: `bg-${primary}-100 text-${primary}-700 hover:bg-${primary}-200`,
          outline: `border border-${primary}-200 bg-transparent hover:bg-${primary}-50`,
          ghost: `hover:bg-${primary}-50 hover:text-${primary}-700`,
          link: `text-${primary}-600 underline-offset-4 hover:underline`,
          destructive: `bg-red-600 text-white hover:bg-red-700`
        }
      }
    },
    effects: {
      ...baseTheme.effects,
      glass: {
        light: `bg-${primary}-50/${glassOpacities.light.low} backdrop-blur-sm`,
        medium: `bg-${primary}-50/${glassOpacities.light.medium} backdrop-blur-md`,
        heavy: `bg-${primary}-50/${glassOpacities.light.high} backdrop-blur-lg`
      }
    },
    gradients: {
      primary: `bg-gradient-to-br from-${primary}-400 via-${primary}-50 to-white`,
      secondary: 'bg-gradient-to-br from-gray-100 via-gray-50 to-white',
      accent: `bg-gradient-to-br from-${accent}-400/80 via-${accent}-50 to-white`,
      background: `bg-gradient-to-br from-${primary}-400/20 via-${primary}-50 to-white`
    },
    darkMode: {
      colors: {
        primary: { ...palette[primary], foreground: commonColors.white },
        secondary: { ...palette.gray, foreground: commonColors.white },
        accent: { ...palette[accent], foreground: commonColors.white },
        destructive: { ...palette.red, foreground: commonColors.white },
        success: { ...palette.emerald, foreground: commonColors.white },
        warning: { ...palette.amber, foreground: commonColors.white },
        info: { ...palette.sky, foreground: commonColors.white }
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

// Create theme instances
export const indigoTheme = createTheme(variants.indigo);
export const roseTheme = createTheme(variants.rose);
export const amberTheme = createTheme(variants.amber);
export const emeraldTheme = createTheme(variants.emerald);
export const skyTheme = createTheme(variants.sky);
export const tealTheme = createTheme(variants.teal);

// Export themes object
export const themes = {
  indigo: indigoTheme,
  rose: roseTheme,
  amber: amberTheme,
  emerald: emeraldTheme,
  sky: skyTheme, 
  teal: tealTheme
} as const;

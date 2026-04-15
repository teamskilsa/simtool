// src/components/theme/themes.ts

import type { ThemeConfig } from './types/theme.types';
import { palette, commonColors, glassOpacities } from './utils/palette';
import { baseComponents } from './utils/base-components';

export type ThemeVariant = 'indigo' | 'rose' | 'amber' | 'emerald' | 'sky' | 'teal';
export type ThemeGroup = 'primary' | 'secondary' | 'accent';

export const themeGroups: Record<ThemeGroup, ThemeVariant[]> = {
  primary: ['indigo', 'sky', 'teal'],
  secondary: ['rose', 'amber'],
  accent: ['emerald']
};

export const themeMetadata = {
  indigo: {
    name: 'Indigo',
    description: 'Professional and modern',
    group: 'primary' as ThemeGroup
  },
  rose: {
    name: 'Rose',
    description: 'Warm and inviting',
    group: 'secondary' as ThemeGroup
  },
  amber: {
    name: 'Amber',
    description: 'Bold and energetic',
    group: 'secondary' as ThemeGroup
  },
  emerald: {
    name: 'Emerald',
    description: 'Fresh and natural',
    group: 'accent' as ThemeGroup
  },
  sky: {
    name: 'Sky',
    description: 'Clean and clear',
    group: 'primary' as ThemeGroup
  },
  teal: {
    name: 'Teal',
    description: 'Calm and balanced',
    group: 'primary' as ThemeGroup
  }
} as const;

type ColorVariant = {
  primary: keyof typeof palette;
  accent: keyof typeof palette;
  name: string;
};

const variants: Record<ThemeVariant, ColorVariant> = {
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

function createTheme(variant: ColorVariant): ThemeConfig {
  const { primary, accent, name } = variant;

  return {
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
    status: {
      online: 'rgb(34 197 94)',
      offline: 'rgb(107 114 128)',
      busy: 'rgb(239 68 68)',
      away: 'rgb(249 115 22)',
      error: 'rgb(239 68 68)',
      success: 'rgb(34 197 94)',
      warning: 'rgb(249 115 22)',
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
        ...baseComponents.badge,
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
      primary: `bg-gradient-to-br from-${primary}-400/20 to-${primary}-50/10`,
      secondary: 'bg-gradient-to-br from-gray-100 via-gray-50 to-white',
      accent: `bg-gradient-to-br from-${accent}-400/80 via-${accent}-50 to-white`,
      background: `bg-gradient-to-br from-${primary}-100 via-${primary}-50/30 to-transparent`,
      glass: `bg-white/80 backdrop-blur-md dark:bg-gray-900/80`,
      header: `bg-gradient-to-r from-${primary}-600 to-${primary}-700`,
      card: `bg-gradient-to-b from-white via-white to-${primary}-50/10`,
      sidebar: `bg-gradient-to-br from-white/90 to-${primary}-50/10`,
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
      },
      gradients: {
        primary: `bg-gradient-to-br from-${primary}-900/20 to-${primary}-800/10`,
        background: `bg-gradient-to-br from-${primary}-900/20 via-gray-900 to-black/40`,
        card: `bg-gradient-to-b from-gray-900/90 to-${primary}-900/10`,
        sidebar: `bg-gradient-to-br from-gray-900/90 to-${primary}-900/10`,
      }
    }
  };
}

// Create and export theme instances
export const themes = Object.fromEntries(
  Object.entries(variants).map(([key, variant]) => [
    key, 
    createTheme(variant)
  ])
) as Record<ThemeVariant, ThemeConfig>;

// Export individual themes for backward compatibility
export const indigoTheme = themes.indigo;
export const roseTheme = themes.rose;
export const amberTheme = themes.amber;
export const emeraldTheme = themes.emerald;
export const skyTheme = themes.sky;
export const tealTheme = themes.teal;

// Export utility functions
export const getThemeNames = () => Object.keys(variants) as ThemeVariant[];
export const getThemesByGroup = (group: ThemeGroup): ThemeVariant[] => {
  return themeGroups[group] || [];
};

export const getThemeGroup = (theme: ThemeVariant): ThemeGroup => {
  return themeMetadata[theme].group;
};

export const getThemeMetadata = (theme: ThemeVariant) => {
  return themeMetadata[theme];
};

// Also export the variant type for use in other files
export { type ColorVariant };
export { variants };
// src/components/theme/variants/emerald.ts
import { palette, statusColors, commonColors, glassOpacities } from '../utils/palette';
import { baseComponents } from '../utils/base-components';
import type { ThemeConfig } from '../types/theme.types';

export const emeraldTheme: ThemeConfig = {
  name: 'Emerald',
  colors: {
    primary: { ...palette.emerald, foreground: commonColors.white },
    secondary: { ...palette.gray, foreground: commonColors.white },
    accent: { ...palette.green, foreground: commonColors.white },
    destructive: { ...palette.red, foreground: commonColors.white },
    success: { ...palette.emerald, foreground: commonColors.white },
    warning: { ...palette.amber, foreground: commonColors.white },
    info: { ...palette.sky, foreground: commonColors.white }
  },
  status: {
    ...statusColors,
    info: palette.emerald[600]
  },
  surfaces: {
    page: {
      background: commonColors.background.light,
      foreground: palette.emerald[900],
      border: palette.emerald[200]
    },
    card: {
      background: `${commonColors.white}/0.8`,
      foreground: palette.emerald[900],
      border: palette.emerald[200],
      hover: palette.emerald[50]
    },
    sidebar: {
      background: `${commonColors.white}/0.9`,
      foreground: palette.emerald[900],
      border: palette.emerald[200],
      hover: palette.emerald[50]
    },
    header: {
      background: `${commonColors.white}/0.9`,
      foreground: palette.emerald[900],
      border: palette.emerald[200]
    },
    dropdown: {
      background: `${commonColors.white}/0.98`,
      foreground: palette.emerald[900],
      border: palette.emerald[200],
      hover: palette.emerald[50]
    },
    modal: {
      background: commonColors.white,
      foreground: palette.emerald[900],
      border: palette.emerald[200],
      overlay: commonColors.overlay.light
    }
  },
  components: {
    button: {
      ...baseComponents.button,
      variants: {
        default: `bg-emerald-600 text-white hover:bg-emerald-700`,
        secondary: `bg-emerald-100 text-emerald-700 hover:bg-emerald-200`,
        outline: `border border-emerald-200 bg-transparent hover:bg-emerald-50`,
        ghost: `hover:bg-emerald-50 hover:text-emerald-700`,
        link: `text-emerald-600 underline-offset-4 hover:underline`,
        destructive: `bg-red-600 text-white hover:bg-red-700`
      }
    },
    input: {
      ...baseComponents.input,
      variants: {
        default: `bg-white/50 border-emerald-200`,
        filled: `bg-emerald-50 border-emerald-200`,
        outline: `bg-transparent border-2 border-emerald-200`,
        ghost: 'border-0 bg-transparent'
      },
      states: {
        focus: 'ring-2 ring-emerald-500',
        error: 'border-red-500 focus:ring-red-500',
        disabled: 'opacity-50 cursor-not-allowed'
      }
    },
    select: {
      ...baseComponents.select,
      trigger: 'flex h-10 w-full items-center justify-between rounded-md border border-emerald-200 bg-white/50 px-3 py-2',
      content: 'relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-emerald-200 bg-white shadow-md animate-in fade-in-80',
      item: 'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-emerald-50 focus:text-emerald-900',
      itemHighlighted: 'bg-emerald-50 text-emerald-900'
    },
    badge: {
      base: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
      variants: {
        default: 'border-transparent bg-emerald-600 text-white',
        secondary: 'border-transparent bg-emerald-100 text-emerald-700',
        outline: 'border-emerald-200 text-emerald-700',
        destructive: 'border-transparent bg-red-600 text-white'
      }
    },
    card: {
      ...baseComponents.card,
      interactive: 'hover:shadow-md transition-shadow cursor-pointer'
    },
    navigation: {
      ...baseComponents.navigation,
      item: 'flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-emerald-50 transition-colors',
      itemActive: 'bg-emerald-50 text-emerald-700 font-medium',
      subItem: 'flex items-center gap-2 rounded-lg px-3 py-2 pl-10 hover:bg-emerald-50 transition-colors',
      subItemActive: 'bg-emerald-50 text-emerald-700 font-medium'
    }
  },
  effects: {
    blur: {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg'
    },
    glass: {
      light: `bg-emerald-50/${glassOpacities.light.low} backdrop-blur-sm`,
      medium: `bg-emerald-50/${glassOpacities.light.medium} backdrop-blur-md`,
      heavy: `bg-emerald-50/${glassOpacities.light.high} backdrop-blur-lg`
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
    primary: 'bg-gradient-to-br from-emerald-400 via-emerald-50 to-white',
    secondary: 'bg-gradient-to-br from-gray-100 via-gray-50 to-white',
    accent: 'bg-gradient-to-br from-green-400/80 via-green-50 to-white',
    background: 'bg-gradient-to-br from-emerald-400/20 via-emerald-50 to-white'
  },
  darkMode: {
    colors: {
      primary: { ...palette.emerald, foreground: commonColors.white },
      secondary: { ...palette.gray, foreground: commonColors.white },
      accent: { ...palette.green, foreground: commonColors.white },
      destructive: { ...palette.red, foreground: commonColors.white },
      success: { ...palette.emerald, foreground: commonColors.white },
      warning: { ...palette.amber, foreground: commonColors.white },
      info: { ...palette.sky, foreground: commonColors.white }
    },
    surfaces: {
      page: {
        background: commonColors.background.dark,
        foreground: palette.emerald[100],
        border: palette.emerald[800]
      },
      card: {
        background: 'rgb(17 17 17 / 0.8)',
        foreground: palette.emerald[100],
        border: palette.emerald[800],
        hover: `${palette.emerald[900]}/50`
      },
      sidebar: {
        background: 'rgb(17 17 17 / 0.9)',
        foreground: palette.emerald[100],
        border: palette.emerald[800],
        hover: `${palette.emerald[900]}/50`
      }
    },
    effects: {
      glass: {
        light: `bg-emerald-900/${glassOpacities.dark.low} backdrop-blur-sm`,
        medium: `bg-emerald-900/${glassOpacities.dark.medium} backdrop-blur-md`,
        heavy: `bg-emerald-900/${glassOpacities.dark.high} backdrop-blur-lg`
      }
    }
  }
};

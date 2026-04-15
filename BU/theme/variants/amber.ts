// src/components/theme/variants/amber.ts
import { palette, statusColors, commonColors, glassOpacities } from '../utils/palette';
import { baseComponents } from '../utils/base-components';
import type { ThemeConfig } from '../types/theme.types';

export const amberTheme: ThemeConfig = {
  name: 'Amber',
  colors: {
    primary: { ...palette.amber, foreground: commonColors.white },
    secondary: { ...palette.gray, foreground: commonColors.white },
    accent: { ...palette.orange, foreground: commonColors.white },
    destructive: { ...palette.red, foreground: commonColors.white },
    success: { ...palette.emerald, foreground: commonColors.white },
    warning: { ...palette.amber, foreground: commonColors.white },
    info: { ...palette.sky, foreground: commonColors.white }
  },
  status: {
    ...statusColors,
    info: palette.amber[600]
  },
  surfaces: {
    page: {
      background: commonColors.background.light,
      foreground: palette.amber[900],
      border: palette.amber[200]
    },
    card: {
      background: `${commonColors.white}/0.8`,
      foreground: palette.amber[900],
      border: palette.amber[200],
      hover: palette.amber[50]
    },
    sidebar: {
      background: `${commonColors.white}/0.9`,
      foreground: palette.amber[900],
      border: palette.amber[200],
      hover: palette.amber[50]
    },
    header: {
      background: `${commonColors.white}/0.9`,
      foreground: palette.amber[900],
      border: palette.amber[200]
    },
    dropdown: {
      background: `${commonColors.white}/0.98`,
      foreground: palette.amber[900],
      border: palette.amber[200],
      hover: palette.amber[50]
    },
    modal: {
      background: commonColors.white,
      foreground: palette.amber[900],
      border: palette.amber[200],
      overlay: commonColors.overlay.light
    }
  },
  components: {
    button: {
      ...baseComponents.button,
      variants: {
        default: `bg-amber-600 text-white hover:bg-amber-700`,
        secondary: `bg-amber-100 text-amber-700 hover:bg-amber-200`,
        outline: `border border-amber-200 bg-transparent hover:bg-amber-50`,
        ghost: `hover:bg-amber-50 hover:text-amber-700`,
        link: `text-amber-600 underline-offset-4 hover:underline`,
        destructive: `bg-red-600 text-white hover:bg-red-700`
      }
    },
    input: {
      ...baseComponents.input,
      variants: {
        default: `bg-white/50 border-amber-200`,
        filled: `bg-amber-50 border-amber-200`,
        outline: `bg-transparent border-2 border-amber-200`,
        ghost: 'border-0 bg-transparent'
      },
      states: {
        focus: 'ring-2 ring-amber-500',
        error: 'border-red-500 focus:ring-red-500',
        disabled: 'opacity-50 cursor-not-allowed'
      }
    },
    select: {
      ...baseComponents.select,
      trigger: 'flex h-10 w-full items-center justify-between rounded-md border border-amber-200 bg-white/50 px-3 py-2',
      content: 'relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-amber-200 bg-white shadow-md animate-in fade-in-80',
      item: 'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-amber-50 focus:text-amber-900',
      itemHighlighted: 'bg-amber-50 text-amber-900'
    },
    badge: {
      base: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
      variants: {
        default: 'border-transparent bg-amber-600 text-white',
        secondary: 'border-transparent bg-amber-100 text-amber-700',
        outline: 'border-amber-200 text-amber-700',
        destructive: 'border-transparent bg-red-600 text-white'
      }
    },
    card: {
      ...baseComponents.card,
      interactive: 'hover:shadow-md transition-shadow cursor-pointer'
    },
    navigation: {
      ...baseComponents.navigation,
      item: 'flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-amber-50 transition-colors',
      itemActive: 'bg-amber-50 text-amber-700 font-medium',
      subItem: 'flex items-center gap-2 rounded-lg px-3 py-2 pl-10 hover:bg-amber-50 transition-colors',
      subItemActive: 'bg-amber-50 text-amber-700 font-medium'
    }
  },
  effects: {
    blur: {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg'
    },
    glass: {
      light: `bg-amber-50/${glassOpacities.light.low} backdrop-blur-sm`,
      medium: `bg-amber-50/${glassOpacities.light.medium} backdrop-blur-md`,
      heavy: `bg-amber-50/${glassOpacities.light.high} backdrop-blur-lg`
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
    primary: 'bg-gradient-to-br from-amber-400 via-amber-50 to-white',
    secondary: 'bg-gradient-to-br from-gray-100 via-gray-50 to-white',
    accent: 'bg-gradient-to-br from-orange-400/80 via-orange-50 to-white',
    background: 'bg-gradient-to-br from-amber-400/20 via-amber-50 to-white'
  },
  darkMode: {
    colors: {
      primary: { ...palette.amber, foreground: commonColors.white },
      secondary: { ...palette.gray, foreground: commonColors.white },
      accent: { ...palette.orange, foreground: commonColors.white },
      destructive: { ...palette.red, foreground: commonColors.white },
      success: { ...palette.emerald, foreground: commonColors.white },
      warning: { ...palette.amber, foreground: commonColors.white },
      info: { ...palette.sky, foreground: commonColors.white }
    },
    surfaces: {
      page: {
        background: commonColors.background.dark,
        foreground: palette.amber[100],
        border: palette.amber[800]
      },
      card: {
        background: 'rgb(17 17 17 / 0.8)',
        foreground: palette.amber[100],
        border: palette.amber[800],
        hover: `${palette.amber[900]}/50`
      },
      sidebar: {
        background: 'rgb(17 17 17 / 0.9)',
        foreground: palette.amber[100],
        border: palette.amber[800],
        hover: `${palette.amber[900]}/50`
      }
    },
    effects: {
      glass: {
        light: `bg-amber-900/${glassOpacities.dark.low} backdrop-blur-sm`,
        medium: `bg-amber-900/${glassOpacities.dark.medium} backdrop-blur-md`,
        heavy: `bg-amber-900/${glassOpacities.dark.high} backdrop-blur-lg`
      }
    }
  }
};

// src/components/theme/variants/light.ts
import { palette, statusColors, commonColors, glassOpacities } from '../utils/palette';
import { baseComponents } from '../utils/base-components';
import type { ThemeConfig } from '../types/theme.types';

export const lightTheme: ThemeConfig = {
  name: 'Light',
  colors: {
    primary: { ...palette.sky, foreground: commonColors.white },
    secondary: { ...palette.gray, foreground: commonColors.white },
    accent: { ...palette.indigo, foreground: commonColors.white },
    destructive: { ...palette.red, foreground: commonColors.white },
    success: { ...palette.emerald, foreground: commonColors.white },
    warning: { ...palette.amber, foreground: commonColors.white },
    info: { ...palette.sky, foreground: commonColors.white }
  },
  status: {
    ...statusColors,
    info: palette.sky[600]
  },
  surfaces: {
    page: {
      background: commonColors.background.light,
      foreground: palette.gray[900],
      border: palette.gray[200]
    },
    card: {
      background: `${commonColors.white}/0.8`,
      foreground: palette.gray[900],
      border: palette.gray[200],
      hover: palette.gray[50]
    },
    sidebar: {
      background: `${commonColors.white}/0.9`,
      foreground: palette.gray[900],
      border: palette.gray[200],
      hover: palette.gray[50]
    },
    header: {
      background: `${commonColors.white}/0.9`,
      foreground: palette.gray[900],
      border: palette.gray[200]
    },
    dropdown: {
      background: `${commonColors.white}/0.98`,
      foreground: palette.gray[900],
      border: palette.gray[200],
      hover: palette.gray[50]
    },
    modal: {
      background: commonColors.white,
      foreground: palette.gray[900],
      border: palette.gray[200],
      overlay: commonColors.overlay.light
    }
  },
  components: {
    button: {
      ...baseComponents.button,
      variants: {
        default: `bg-sky-600 text-white hover:bg-sky-700`,
        secondary: `bg-gray-100 text-gray-700 hover:bg-gray-200`,
        outline: `border border-gray-200 bg-transparent hover:bg-gray-50`,
        ghost: `hover:bg-gray-50 hover:text-gray-700`,
        link: `text-sky-600 underline-offset-4 hover:underline`,
        destructive: `bg-red-600 text-white hover:bg-red-700`
      }
    },
    input: {
      ...baseComponents.input,
      variants: {
        default: `bg-white/50 border-gray-200`,
        filled: `bg-gray-50 border-gray-200`,
        outline: `bg-transparent border-2 border-gray-200`,
        ghost: 'border-0 bg-transparent'
      },
      states: {
        focus: 'ring-2 ring-sky-500',
        error: 'border-red-500 focus:ring-red-500',
        disabled: 'opacity-50 cursor-not-allowed'
      }
    },
    select: {
      ...baseComponents.select,
      trigger: 'flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white/50 px-3 py-2',
      content: 'relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-md animate-in fade-in-80',
      item: 'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-gray-50 focus:text-gray-900',
      itemHighlighted: 'bg-gray-50 text-gray-900'
    },
    badge: {
      base: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
      variants: {
        default: 'border-transparent bg-sky-600 text-white',
        secondary: 'border-transparent bg-gray-100 text-gray-700',
        outline: 'border-gray-200 text-gray-700',
        destructive: 'border-transparent bg-red-600 text-white'
      }
    },
    card: {
      ...baseComponents.card,
      interactive: 'hover:shadow-md transition-shadow cursor-pointer'
    },
    navigation: {
      ...baseComponents.navigation,
      item: 'flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors',
      itemActive: 'bg-sky-50 text-sky-700 font-medium',
      subItem: 'flex items-center gap-2 rounded-lg px-3 py-2 pl-10 hover:bg-gray-50 transition-colors',
      subItemActive: 'bg-sky-50 text-sky-700 font-medium'
    }
  },
  effects: {
    blur: {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg'
    },
    glass: {
      light: `bg-white/${glassOpacities.light.low} backdrop-blur-sm`,
      medium: `bg-white/${glassOpacities.light.medium} backdrop-blur-md`,
      heavy: `bg-white/${glassOpacities.light.high} backdrop-blur-lg`
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
    primary: 'bg-gradient-to-br from-sky-400 via-sky-50 to-white',
    secondary: 'bg-gradient-to-br from-gray-100 via-gray-50 to-white',
    accent: 'bg-gradient-to-br from-indigo-400/80 via-indigo-50 to-white',
    background: 'bg-gradient-to-br from-sky-400/20 via-sky-50 to-white'
  },
  darkMode: {
    colors: {
      primary: { ...palette.sky, foreground: commonColors.white },
      secondary: { ...palette.gray, foreground: commonColors.white },
      accent: { ...palette.indigo, foreground: commonColors.white },
      destructive: { ...palette.red, foreground: commonColors.white },
      success: { ...palette.emerald, foreground: commonColors.white },
      warning: { ...palette.amber, foreground: commonColors.white },
      info: { ...palette.sky, foreground: commonColors.white }
    },
    surfaces: {
      page: {
        background: commonColors.background.dark,
        foreground: commonColors.foreground.dark,
        border: palette.gray[800]
      },
      card: {
        background: 'rgb(17 17 17 / 0.8)',
        foreground: commonColors.foreground.dark,
        border: palette.gray[800],
        hover: `${palette.gray[800]}/50`
      },
      sidebar: {
        background: 'rgb(17 17 17 / 0.9)',
        foreground: commonColors.foreground.dark,
        border: palette.gray[800],
        hover: `${palette.gray[800]}/50`
      }
    },
    effects: {
      glass: {
        light: `bg-gray-900/${glassOpacities.dark.low} backdrop-blur-sm`,
        medium: `bg-gray-900/${glassOpacities.dark.medium} backdrop-blur-md`,
        heavy: `bg-gray-900/${glassOpacities.dark.high} backdrop-blur-lg`
      }
    }
  }
};

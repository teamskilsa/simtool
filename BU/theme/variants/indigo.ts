// src/components/theme/variants/indigo.ts
import { palette, statusColors, commonColors, glassOpacities } from '../utils/palette';
import { baseComponents } from '../utils/base-components';
import type { ThemeConfig } from '../types/theme.types';

export const indigoTheme: ThemeConfig = {
  name: 'Indigo',
  colors: {
    primary: { ...palette.indigo, foreground: commonColors.white },
    secondary: { ...palette.gray, foreground: commonColors.white },
    accent: { ...palette.violet, foreground: commonColors.white },
    destructive: { ...palette.red, foreground: commonColors.white },
    success: { ...palette.emerald, foreground: commonColors.white },
    warning: { ...palette.amber, foreground: commonColors.white },
    info: { ...palette.sky, foreground: commonColors.white }
  },
  status: {
    ...statusColors,
    info: palette.indigo[600]
  },
  surfaces: {
    page: {
      background: commonColors.background.light,
      foreground: palette.indigo[900],
      border: palette.indigo[200]
    },
    card: {
      background: `${commonColors.white}/0.8`,
      foreground: palette.indigo[900],
      border: palette.indigo[200],
      hover: palette.indigo[50]
    },
    sidebar: {
      background: `${commonColors.white}/0.9`,
      foreground: palette.indigo[900],
      border: palette.indigo[200],
      hover: palette.indigo[50]
    },
    header: {
      background: `${commonColors.white}/0.9`,
      foreground: palette.indigo[900],
      border: palette.indigo[200]
    },
    dropdown: {
      background: `${commonColors.white}/0.98`,
      foreground: palette.indigo[900],
      border: palette.indigo[200],
      hover: palette.indigo[50]
    },
    modal: {
      background: commonColors.white,
      foreground: palette.indigo[900],
      border: palette.indigo[200],
      overlay: commonColors.overlay.light
    }
  },
  components: {
    button: {
      ...baseComponents.button,
      variants: {
        default: `bg-indigo-600 text-white hover:bg-indigo-700`,
        secondary: `bg-indigo-100 text-indigo-700 hover:bg-indigo-200`,
        outline: `border border-indigo-200 bg-transparent hover:bg-indigo-50`,
        ghost: `hover:bg-indigo-50 hover:text-indigo-700`,
        link: `text-indigo-600 underline-offset-4 hover:underline`,
        destructive: `bg-red-600 text-white hover:bg-red-700`
      }
    },
    input: {
      ...baseComponents.input,
      variants: {
        default: `bg-white/50 border-indigo-200`,
        filled: `bg-indigo-50 border-indigo-200`,
        outline: `bg-transparent border-2 border-indigo-200`,
        ghost: 'border-0 bg-transparent'
      },
      states: {
        focus: 'ring-2 ring-indigo-500',
        error: 'border-red-500 focus:ring-red-500',
        disabled: 'opacity-50 cursor-not-allowed'
      }
    },
    select: {
      ...baseComponents.select,
      trigger: 'flex h-10 w-full items-center justify-between rounded-md border border-indigo-200 bg-white/50 px-3 py-2',
      content: 'relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-indigo-200 bg-white shadow-md animate-in fade-in-80',
      item: 'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-indigo-50 focus:text-indigo-900',
      itemHighlighted: 'bg-indigo-50 text-indigo-900'
    },
    badge: {
      base: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
      variants: {
        default: 'border-transparent bg-indigo-600 text-white',
        secondary: 'border-transparent bg-indigo-100 text-indigo-700',
        outline: 'border-indigo-200 text-indigo-700',
        destructive: 'border-transparent bg-red-600 text-white'
      }
    },
    card: {
      ...baseComponents.card,
      interactive: 'hover:shadow-md transition-shadow cursor-pointer'
    },
    navigation: {
      ...baseComponents.navigation,
      item: 'flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-indigo-50 transition-colors',
      itemActive: 'bg-indigo-50 text-indigo-700 font-medium',
      subItem: 'flex items-center gap-2 rounded-lg px-3 py-2 pl-10 hover:bg-indigo-50 transition-colors',
      subItemActive: 'bg-indigo-50 text-indigo-700 font-medium'
    }
  },
  effects: {
    blur: {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg'
    },
    glass: {
      light: `bg-indigo-50/${glassOpacities.light.low} backdrop-blur-sm`,
      medium: `bg-indigo-50/${glassOpacities.light.medium} backdrop-blur-md`,
      heavy: `bg-indigo-50/${glassOpacities.light.high} backdrop-blur-lg`
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
    primary: 'bg-gradient-to-br from-indigo-400 via-indigo-50 to-white',
    secondary: 'bg-gradient-to-br from-gray-100 via-gray-50 to-white',
    accent: 'bg-gradient-to-br from-violet-400/80 via-violet-50 to-white',
    background: 'bg-gradient-to-br from-indigo-400/20 via-indigo-50 to-white'
  },
  dialogs: {
    header: {
      background: 'bg-indigo-600',
      text: 'text-white font-semibold'
    },
    content: {
      background: `bg-white dark:bg-slate-900`,
      border: 'border border-indigo-200 dark:border-slate-700'
    },
    input: {
      background: 'bg-white dark:bg-slate-900',
      border: 'border border-indigo-200 dark:border-slate-700',
      text: 'text-slate-900 dark:text-slate-100',
      placeholder: 'placeholder:text-slate-400 dark:placeholder:text-slate-500',
      focus: 'focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30',
      hover: 'hover:bg-indigo-50/50 dark:hover:bg-slate-800/50'
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
      primary: { ...palette.indigo, foreground: commonColors.white },
      secondary: { ...palette.gray, foreground: commonColors.white },
      accent: { ...palette.violet, foreground: commonColors.white },
      destructive: { ...palette.red, foreground: commonColors.white },
      success: { ...palette.emerald, foreground: commonColors.white },
      warning: { ...palette.amber, foreground: commonColors.white },
      info: { ...palette.sky, foreground: commonColors.white }
    },
    surfaces: {
      page: {
        background: commonColors.background.dark,
        foreground: palette.indigo[100],
        border: palette.indigo[800]
      },
      card: {
        background: 'rgb(17 17 17 / 0.8)',
        foreground: palette.indigo[100],
        border: palette.indigo[800],
        hover: `${palette.indigo[900]}/50`
      },
      sidebar: {
        background: 'rgb(17 17 17 / 0.9)',
        foreground: palette.indigo[100],
        border: palette.indigo[800],
        hover: `${palette.indigo[900]}/50`
      }
    },
    effects: {
      glass: {
        light: `bg-indigo-900/${glassOpacities.dark.low} backdrop-blur-sm`,
        medium: `bg-indigo-900/${glassOpacities.dark.medium} backdrop-blur-md`,
        heavy: `bg-indigo-900/${glassOpacities.dark.high} backdrop-blur-lg`
      }
    }
  }
};
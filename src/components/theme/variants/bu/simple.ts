// src/components/theme/variants/simple.ts
import type { ThemeConfig } from '../types/theme.types';

export const simpleTheme: ThemeConfig = {
  name: 'Simple',
  colors: {
    primary: {
      50: 'rgb(239 246 255)',
      100: 'rgb(219 234 254)',
      200: 'rgb(191 219 254)',
      300: 'rgb(147 197 253)',
      400: 'rgb(96 165 250)',
      500: 'rgb(59 130 246)',
      600: 'rgb(37 99 235)',
      700: 'rgb(29 78 216)',
      800: 'rgb(30 64 175)',
      900: 'rgb(30 58 138)',
      foreground: '#ffffff'
    },
    secondary: {
      50: 'rgb(249 250 251)',
      100: 'rgb(243 244 246)',
      200: 'rgb(229 231 235)',
      300: 'rgb(209 213 219)',
      400: 'rgb(156 163 175)',
      500: 'rgb(107 114 128)',
      600: 'rgb(75 85 99)',
      700: 'rgb(55 65 81)',
      800: 'rgb(31 41 55)',
      900: 'rgb(17 24 39)',
      foreground: '#ffffff'
    },
    accent: {
      50: 'rgb(245 243 255)',
      100: 'rgb(237 233 254)',
      200: 'rgb(221 214 254)',
      300: 'rgb(196 181 253)',
      400: 'rgb(167 139 250)',
      500: 'rgb(139 92 246)',
      600: 'rgb(124 58 237)',
      700: 'rgb(109 40 217)',
      800: 'rgb(91 33 182)',
      900: 'rgb(76 29 149)',
      foreground: '#ffffff'
    },
    destructive: {
      50: 'rgb(254 242 242)',
      100: 'rgb(254 226 226)',
      200: 'rgb(254 202 202)',
      300: 'rgb(252 165 165)',
      400: 'rgb(248 113 113)',
      500: 'rgb(239 68 68)',
      600: 'rgb(220 38 38)',
      700: 'rgb(185 28 28)',
      800: 'rgb(153 27 27)',
      900: 'rgb(127 29 29)',
      foreground: '#ffffff'
    },
    success: {
      50: 'rgb(240 253 244)',
      100: 'rgb(220 252 231)',
      200: 'rgb(187 247 208)',
      300: 'rgb(134 239 172)',
      400: 'rgb(74 222 128)',
      500: 'rgb(34 197 94)',
      600: 'rgb(22 163 74)',
      700: 'rgb(21 128 61)',
      800: 'rgb(22 101 52)',
      900: 'rgb(20 83 45)',
      foreground: '#ffffff'
    },
    warning: {
      50: 'rgb(255 247 237)',
      100: 'rgb(255 237 213)',
      200: 'rgb(254 215 170)',
      300: 'rgb(253 186 116)',
      400: 'rgb(251 146 60)',
      500: 'rgb(249 115 22)',
      600: 'rgb(234 88 12)',
      700: 'rgb(194 65 12)',
      800: 'rgb(154 52 18)',
      900: 'rgb(124 45 18)',
      foreground: '#ffffff'
    },
    info: {
      50: 'rgb(240 249 255)',
      100: 'rgb(224 242 254)',
      200: 'rgb(186 230 253)',
      300: 'rgb(125 211 252)',
      400: 'rgb(56 189 248)',
      500: 'rgb(14 165 233)',
      600: 'rgb(2 132 199)',
      700: 'rgb(3 105 161)',
      800: 'rgb(7 89 133)',
      900: 'rgb(12 74 110)',
      foreground: '#ffffff'
    }
  },
  status: {
    online: 'rgb(34 197 94)',
    offline: 'rgb(107 114 128)',
    busy: 'rgb(239 68 68)',
    away: 'rgb(249 115 22)',
    error: 'rgb(239 68 68)',
    success: 'rgb(34 197 94)',
    warning: 'rgb(249 115 22)',
    info: 'rgb(14 165 233)'
  },
  surfaces: {
    page: {
      background: '#ffffff',
      foreground: '#171717',
      border: 'rgb(229 231 235)'
    },
    card: {
      background: 'rgb(255 255 255 / 0.8)',
      foreground: '#171717',
      border: 'rgb(229 231 235)',
      hover: 'rgb(249 250 251)'
    },
    sidebar: {
      background: 'rgb(255 255 255 / 0.9)',
      foreground: '#171717',
      border: 'rgb(229 231 235)',
      hover: 'rgb(243 244 246)'
    },
    header: {
      background: 'rgb(255 255 255 / 0.9)',
      foreground: '#171717',
      border: 'rgb(229 231 235)'
    },
    dropdown: {
      background: 'rgb(255 255 255 / 0.98)',
      foreground: '#171717',
      border: 'rgb(229 231 235)',
      hover: 'rgb(243 244 246)'
    },
    modal: {
      background: '#ffffff',
      foreground: '#171717',
      border: 'rgb(229 231 235)',
      overlay: 'rgb(0 0 0 / 0.5)'
    }
  },
  components: {
    button: {
      base: 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      variants: {
        default: 'bg-primary-600 text-primary-foreground hover:bg-primary-700',
        secondary: 'bg-secondary-200 text-secondary-700 hover:bg-secondary-300',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        destructive: 'bg-destructive-600 text-destructive-foreground hover:bg-destructive-700'
      },
      sizes: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10'
      },
      states: {
        active: 'ring-2',
        disabled: 'opacity-50 cursor-not-allowed',
        loading: 'opacity-80 cursor-wait'
      }
    },
    input: {
      base: 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      variants: {
        default: 'bg-white/50',
        filled: 'bg-secondary-100',
        outline: 'bg-transparent border-2',
        ghost: 'border-0 bg-transparent'
      },
      states: {
        focus: 'ring-2 ring-primary-500',
        error: 'border-destructive-600 focus:ring-destructive-500',
        disabled: 'opacity-50 cursor-not-allowed'
      }
    },
    select: {
      trigger: 'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      content: 'relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80',
      item: 'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm font-medium outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      itemHighlighted: 'bg-accent text-accent-foreground'
    },
    badge: {
      base: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
      variants: {
        default: 'border-transparent bg-primary-600 text-primary-foreground',
        secondary: 'border-transparent bg-secondary-200 text-secondary-700',
        outline: 'text-foreground',
        destructive: 'border-transparent bg-destructive-600 text-destructive-foreground'
      }
    },
    card: {
      base: 'rounded-lg border bg-card text-card-foreground shadow-sm',
      interactive: 'hover:shadow-md transition-shadow cursor-pointer',
      header: 'flex flex-col space-y-1.5 p-6',
      content: 'p-6 pt-0',
      footer: 'flex items-center p-6 pt-0'
    },
    navigation: {
      item: 'flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors',
      itemActive: 'bg-accent/50 font-medium',
      itemIcon: 'h-4 w-4',
      subItem: 'flex items-center gap-2 rounded-lg px-3 py-2 pl-10 hover:bg-accent/50 transition-colors',
      subItemActive: 'bg-accent/50 font-medium'
    }
  },
  effects: {
    blur: {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg'
    },
    glass: {
      light: 'bg-white/50 backdrop-blur-sm',
      medium: 'bg-white/70 backdrop-blur-md',
      heavy: 'bg-white/90 backdrop-blur-lg'
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
    primary: 'bg-gradient-to-br from-blue-400 via-blue-50 to-white',
    secondary: 'bg-gradient-to-br from-gray-100 via-gray-50 to-white',
    accent: 'bg-gradient-to-br from-violet-400 via-violet-50 to-white',
    background: 'bg-gradient-to-br from-gray-100 via-gray-50 to-white'
  },
  darkMode: {
    surfaces: {
      page: {
        background: '#0a0a0a',
        foreground: '#ededed',
        border: 'rgb(31 41 55)'
      },
      card: {
        background: 'rgb(17 17 17 / 0.8)',
        foreground: '#ededed',
        border: 'rgb(31 41 55)',
        hover: 'rgb(31 41 55)'
      },
      sidebar: {
        background: 'rgb(17 17 17 / 0.9)',
        foreground: '#ededed',
        border: 'rgb(31 41 55)',
        hover: 'rgb(31 41 55)'
      }
    },
    effects: {
      glass: {
        light: 'bg-black/50 backdrop-blur-sm',
        medium: 'bg-black/70 backdrop-blur-md',
        heavy: 'bg-black/90 backdrop-blur-lg'
      }
    }
  }
};
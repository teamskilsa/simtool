// src/components/theme/variants/base-theme.ts

import type { ThemeConfig } from '../types/theme.types';
import { baseComponents } from '../utils/base-components';

// Base theme contains all the non-color-specific configurations
export const baseTheme = {
  components: {
    ...baseComponents,
    card: {
      base: 'rounded-lg border shadow-sm',
      interactive: 'hover:shadow-md transition-shadow cursor-pointer',
      header: 'flex flex-col space-y-1.5 p-6',
      content: 'p-6 pt-0',
      footer: 'flex items-center p-6 pt-0'
    },
    navigation: {
      item: 'flex items-center gap-2 rounded-lg px-3 py-2',
      itemActive: 'font-medium',
      itemIcon: 'h-4 w-4',
      subItem: 'flex items-center gap-2 rounded-lg px-3 py-2 pl-10',
      subItemActive: 'font-medium'
    }
  },
  effects: {
    blur: {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg'
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
  shadows: {
    sm: 'shadow-sm',
    base: 'shadow',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    inner: 'shadow-inner',
    none: 'shadow-none'
  },
  dialogs: {
    sizes: {
      sm: { width: '440px', maxWidth: '90vw' },
      md: { width: '540px', maxWidth: '90vw' },
      lg: { width: '640px', maxWidth: '90vw' }
    },
    effects: {
      blur: 'backdrop-blur-md',
      saturation: 'backdrop-saturate-150'
    }
  }
} as const;

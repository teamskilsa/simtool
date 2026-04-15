import { ThemeConfig } from '@/components/theme/types/theme.types';
import { DialogSize, DialogPadding, DialogRadius } from './theme-extensions';

export const DEFAULT_DIALOG_CONFIG: ThemeConfig['dialogs'] = {
  glass: {
    background: {
      light: 'bg-white/60',
      dark: 'bg-slate-900/60'
    },
    border: {
      light: 'border-white/20',
      dark: 'border-slate-700/30'
    },
    input: {
      light: 'bg-white/80 border-slate-200',
      dark: 'bg-slate-800/80 border-slate-700'
    }
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
};

export const SPACING = {
  padding: {
    sm: 4,
    md: 6,
    lg: 8
  }
} as const;

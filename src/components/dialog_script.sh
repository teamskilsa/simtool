#!/bin/bash

# Create directories
mkdir -p dialogs/styles dialogs/templates dialogs/hooks

# First, extend theme types
cat > dialogs/styles/theme-extensions.ts << 'EOF'
import { ThemeConfig } from "@/components/theme/types/theme.types";

declare module "@/components/theme/types/theme.types" {
  interface ThemeConfig {
    dialogs: {
      glass: {
        background: {
          light: string;
          dark: string;
        };
        border: {
          light: string;
          dark: string;
        };
        input: {
          light: string;
          dark: string;
        };
      };
      sizes: {
        sm: { width: string; maxWidth: string };
        md: { width: string; maxWidth: string };
        lg: { width: string; maxWidth: string };
      };
      effects: {
        blur: string;
        saturation: string;
      };
    };
  }
}

export type DialogSize = 'sm' | 'md' | 'lg';
export type DialogPadding = 'sm' | 'md' | 'lg';
export type DialogRadius = 'sm' | 'md' | 'lg';
EOF

# Create config.ts that uses theme system
cat > dialogs/styles/config.ts << 'EOF'
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
EOF

# Create glass.ts that uses theme system
cat > dialogs/styles/glass.ts << 'EOF'
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';

export const useDialogStyles = () => {
  const { theme, mode } = useTheme();
  const themeConfig = themes[theme];

  const getBackgroundStyle = () => {
    return themeConfig.dialogs.glass.background[mode];
  };

  const getBorderStyle = () => {
    return themeConfig.dialogs.glass.border[mode];
  };

  const getInputStyle = () => {
    return `
      ${themeConfig.dialogs.glass.input[mode]}
      ${mode === 'light' ? 'hover:bg-white' : 'hover:bg-slate-800'}
      placeholder:text-slate-400
      transition-colors
    `;
  };

  const getEffects = () => {
    return `
      ${themeConfig.dialogs.effects.blur}
      ${themeConfig.dialogs.effects.saturation}
      ${themeConfig.effects.glass.medium}
    `;
  };

  return {
    getBackgroundStyle,
    getBorderStyle,
    getInputStyle,
    getEffects
  };
};
EOF

# Create index.ts for styles
cat > dialogs/styles/index.ts << 'EOF'
export * from './config';
export * from './glass';
export * from './theme-extensions';
EOF

# Create BaseDialog.tsx with theme integration
cat > dialogs/templates/BaseDialog.tsx << 'EOF'
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { DialogSize } from '../styles/theme-extensions';
import { useDialogStyles } from '../styles/glass';

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  size?: DialogSize;
  className?: string;
}

export function BaseDialog({
  open,
  onOpenChange,
  children,
  size = 'md',
  className
}: BaseDialogProps) {
  const { theme } = useTheme();
  const themeConfig = themes[theme];
  const styles = useDialogStyles();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`
        w-[${themeConfig.dialogs.sizes[size].width}]
        !max-w-[${themeConfig.dialogs.sizes[size].maxWidth}]
        ${styles.getBackgroundStyle()}
        ${styles.getBorderStyle()}
        ${styles.getEffects()}
        ${className || ''}
      `}>
        {children}
      </DialogContent>
    </Dialog>
  );
}
EOF

# Create FormDialog.tsx with theme integration
cat > dialogs/templates/FormDialog.tsx << 'EOF'
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTheme } from '@/components/theme/context/theme-context';
import { BaseDialog } from './BaseDialog';
import { DialogSize } from '../styles/theme-extensions';
import { useDialogStyles } from '../styles/glass';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  error?: string | null;
  size?: DialogSize;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
  onSubmit,
  loading,
  error,
  size
}: FormDialogProps) {
  const { mode } = useTheme();
  const styles = useDialogStyles();

  return (
    <BaseDialog
      open={open}
      onOpenChange={onOpenChange}
      size={size}
    >
      <DialogHeader>
        <DialogTitle className={`text-xl font-semibold ${
          mode === 'light' ? 'text-slate-900' : 'text-white'
        }`}>
          {title}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-5 mt-4">
        {children}

        {error && (
          <div className={`
            flex items-center gap-2 p-3 rounded-lg text-sm
            ${mode === 'light' 
              ? 'bg-red-50/90 text-red-600 border border-red-100' 
              : 'bg-red-900/20 text-red-400 border border-red-900/30'
            }
          `}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter className="gap-2 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={styles.getInputStyle()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </DialogFooter>
      </form>
    </BaseDialog>
  );
}
EOF

# Create index.ts for templates
cat > dialogs/templates/index.ts << 'EOF'
export * from './BaseDialog';
export * from './FormDialog';
EOF

# Create use-dialog.ts
cat > dialogs/hooks/use-dialog.ts << 'EOF'
import { useState, useCallback } from 'react';

interface UseDialogOptions {
  onOpen?: () => void;
  onClose?: () => void;
}

export function useDialog(options: UseDialogOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    options.onOpen?.();
  }, [options]);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
    options.onClose?.();
  }, [options]);

  const handleSubmit = useCallback(async <T>(
    handler: () => Promise<T>
  ): Promise<T | undefined> => {
    try {
      setLoading(true);
      setError(null);
      const result = await handler();
      close();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [close]);

  return {
    isOpen,
    loading,
    error,
    open,
    close,
    setError,
    handleSubmit
  };
}
EOF

echo "Theme-integrated dialog infrastructure has been created successfully!"

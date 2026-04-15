// src/components/ui/confirm-dialog.tsx
'use client'

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export const ConfirmDialog = React.forwardRef<HTMLDivElement, ConfirmDialogProps>(({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default'
}, ref) => {
  const { theme: themeVariant } = useTheme();
  const theme = themes[themeVariant];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        ref={ref}
        className={cn(
          theme.effects.glass.medium,
          theme.surfaces.modal.background,
          theme.surfaces.modal.border
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn(theme.surfaces.modal.foreground)}>
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className={theme.components.button.variants.outline}
          >
            {cancelText}
          </Button>
          <Button 
            variant={variant} 
            onClick={onConfirm}
            className={cn(
              theme.components.button.base,
              variant === 'destructive' 
                ? theme.components.button.variants.destructive
                : theme.components.button.variants.default,
            )}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';
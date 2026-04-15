// src/components/ui/button-separator.tsx
'use client'

import React from 'react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';

interface ButtonSeparatorProps {
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

export const ButtonSeparator = React.forwardRef<HTMLDivElement, ButtonSeparatorProps>(({ 
  orientation = 'vertical', 
  className 
}, ref) => {
  const { theme: themeVariant } = useTheme();
  const theme = themes[themeVariant];
  
  return (
    <Separator
      ref={ref}
      orientation={orientation}
      className={cn(
        orientation === 'vertical' ? 'h-8' : 'w-full',
        theme.effects.transition.default,
        `bg-${theme.colors.primary[200]}`,
        className
      )}
    />
  );
});

ButtonSeparator.displayName = 'ButtonSeparator';
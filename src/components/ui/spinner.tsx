// src/components/ui/spinner.tsx
'use client'

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(({
  size = 'md',
  className
}, ref) => {
  const { theme: themeVariant } = useTheme();
  const theme = themes[themeVariant];
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div ref={ref} className={cn(
      theme.effects.animation.spin,
      sizeClasses[size],
      `text-${theme.colors.primary[500]}`,
      className
    )}>
      <Loader2 className="w-full h-full" />
    </div>
  );
});

Spinner.displayName = 'Spinner';
// Light / dark toggle, styled after SimQA's ThemeToggle.
//
// The Simnovus palette is the brand, so there is no colour-variant picker any
// more — only the mode. The choice is persisted by the theme context.
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './context/theme-context';
import { cn } from '@/lib/utils';

export function ModeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  const dark = mode === 'dark';
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        setMode(next);
        try { window.localStorage.setItem('mode', next); } catch { /* private mode */ }
      }}
      title={label}
      aria-label={label}
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-input bg-muted',
        'text-muted-foreground transition-colors hover:border-brand-orange hover:text-brand-orange',
        className,
      )}
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}

// Themed form-group wrapper (TestMatrix-style). Header + padded content on a
// theme-aware card. Colors come from the design tokens so the box follows the
// active theme color and dark mode.
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { InfoHint } from './InfoHint';

interface BoxedSectionProps {
  title?: string;
  subtitle?: string;
  /** Explanatory copy shown behind an info icon instead of on screen. */
  hint?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;       // right-side control (e.g. "Add" button)
  noPadding?: boolean;
  /** Render children only — no box, header or padding. Used when the section
   *  is nested inside an AdvancedSection, which already supplies all three. */
  bare?: boolean;
  className?: string;
  children: ReactNode;
}

export function BoxedSection({ title, subtitle, icon, action, hint, noPadding, bare, className, children }: BoxedSectionProps) {
  if (bare) return <>{children}</>;
  return (
    <section
      className={cn(
        'rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden transition-colors',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/40">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <div className="text-primary shrink-0">{icon}</div>}
            <div className="min-w-0">
              {title && (
                <h3 className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                  {title}
                  {hint && <InfoHint>{hint}</InfoHint>}
                </h3>
              )}
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={noPadding ? '' : 'p-3'}>{children}</div>
    </section>
  );
}

// Themed form-group wrapper (TestMatrix-style). Header + padded content on a
// theme-aware card. Colors come from the design tokens so the box follows the
// active theme color and dark mode.
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BoxedSectionProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;       // right-side control (e.g. "Add" button)
  noPadding?: boolean;
  className?: string;
  children: ReactNode;
}

export function BoxedSection({ title, subtitle, icon, action, noPadding, className, children }: BoxedSectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden transition-colors',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/40">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <div className="text-primary shrink-0">{icon}</div>}
            <div className="min-w-0">
              {title && <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>}
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={noPadding ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

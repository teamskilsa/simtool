// The one page header.
//
// Views used to spend three bands before showing anything: a 40px icon tile
// beside a title, a subtitle on its own line, then the page's actions inside
// a bordered, glowing Card. That is ~150px of chrome to say "Test
// Configurations" and offer four buttons.
//
// One row: icon, title, subtitle, actions, a rule under it. ~40px. The
// subtitle drops out below `lg` — it is orientation, not information, and on
// a narrow window the title and actions matter more.
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** A lucide icon element, sized by the header (no tile, no wrapper). */
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  /** Buttons for the page. Use size="sm" so the row stays one line high. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ icon, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        // hero-grid: SimQA's faint blueprint lattice behind the title row.
        'hero-grid flex items-center justify-between gap-4 border-b border-border pb-2.5 mb-4',
        className,
      )}
    >
      <div className="flex items-baseline gap-2 min-w-0">
        {icon && (
          <span className="text-muted-foreground shrink-0 self-center [&>svg]:w-4 [&>svg]:h-4">
            {icon}
          </span>
        )}
        <h2 className="text-base font-semibold text-foreground truncate">{title}</h2>
        {subtitle && (
          <span className="hidden lg:inline text-xs text-muted-foreground truncate">
            {subtitle}
          </span>
        )}
      </div>

      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
}

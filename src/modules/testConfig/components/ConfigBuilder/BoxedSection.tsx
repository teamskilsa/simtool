// Themed form-group wrapper (TestMatrix-style). Header + padded content on a
// soft indigo-tinted background card.
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
        'rounded-lg border border-indigo-100 bg-indigo-50/30 transition-colors',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between px-5 py-3 border-b border-indigo-100 bg-white/70 rounded-t-lg">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <div className="text-indigo-600 shrink-0">{icon}</div>}
            <div className="min-w-0">
              {title && <h3 className="text-sm font-semibold text-gray-900 truncate">{title}</h3>}
              {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={noPadding ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

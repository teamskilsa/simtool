// Form-group wrapper.
//
// This used to render a bordered, shadowed card with a filled header strip.
// With ~50 of them, nested inside sub-tabs inside tabs, the builder was three
// levels of chrome deep before you reached a field — the "too many subboxes"
// problem. A group needs to be *legible*, not *contained*: a small uppercase
// heading over a hairline rule separates one group from the next just as well
// as a box, at a fraction of the vertical cost and with no nesting illusion.
//
// `boxed` brings the old card back for the rare case that genuinely holds a
// list rather than a field grid (see DependenciesSection).
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
  /** Render children only — no heading at all. Used when the parent already
   *  supplies one (e.g. a section nested in an AdvancedSection). */
  bare?: boolean;
  /** Opt back in to the bordered-card treatment. */
  boxed?: boolean;
  className?: string;
  children: ReactNode;
}

/** The one heading style in the builder: small, uppercase, muted, on a rule.
 *  Any group anywhere — Cell, Layers, MME, LTE — looks like this. */
export function GroupHeading({
  title, subtitle, hint, icon, action,
}: Pick<BoxedSectionProps, 'title' | 'subtitle' | 'hint' | 'icon' | 'action'>) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
          {title}
        </h3>
        {hint && <InfoHint>{hint}</InfoHint>}
        {/* Subtitles were a second line under every card title, which is a lot
            of prose for "RACH timers and windows". Behind the same info icon. */}
        {!hint && subtitle && <InfoHint>{subtitle}</InfoHint>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function BoxedSection({
  title, subtitle, icon, action, hint, noPadding, bare, boxed, className, children,
}: BoxedSectionProps) {
  if (bare) return <>{children}</>;

  if (boxed) {
    return (
      <section className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
        {(title || action) && (
          <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
            <div className="flex items-center gap-1.5 min-w-0">
              {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                {title}
              </h3>
              {hint && <InfoHint>{hint}</InfoHint>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </header>
        )}
        <div className={noPadding ? '' : 'p-3'}>{children}</div>
      </section>
    );
  }

  return (
    <section className={cn('space-y-2.5', className)}>
      {(title || action) && (
        <GroupHeading
          title={title} subtitle={subtitle} hint={hint} icon={icon} action={action}
        />
      )}
      {children}
    </section>
  );
}


/** The one field grid in the builder — container-responsive, defined once as
 *  the `.cfg-field-grid` component class in globals.css (auto-fill + 220px min
 *  track, so it packs only as many usable columns as actually fit and drops to
 *  fewer when the cfg-preview panel squeezes the form). Every group uses it —
 *  the NR sections via this const, the LTE/Core/IoT section grids via the class
 *  directly — so a field lands in the same place whichever RAT/tab you are on. */
export const FIELD_GRID = 'cfg-field-grid';

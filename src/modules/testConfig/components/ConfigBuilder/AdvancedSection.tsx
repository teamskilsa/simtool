// Collapsible variant of BoxedSection for settings that are configured once
// and then rarely touched (antennas, RF driver, TDD pattern, channel sim).
//
// The Cell tab used to render ~27 fields in one flat stack, all with equal
// visual weight, so nothing signalled which three mattered on every config
// and which were set-once defaults. These collapse by default but always
// show a summary of their current values in the header — the point is to
// make them quiet, not to hide them. A section that differs from its
// default is marked so it never hides a surprise.
'use client';

import { ReactNode, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface AdvancedSectionProps {
  title: string;
  /** One-line readout of the current values, shown while collapsed. */
  summary: string;
  icon?: ReactNode;
  /** Flags the section as holding non-default values. */
  modified?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function AdvancedSection({
  title,
  summary,
  icon,
  modified = false,
  defaultOpen = false,
  children,
}: AdvancedSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden transition-colors"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
            'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open && 'border-b border-border/60 bg-muted/40',
          )}
        >
          <ChevronRight
            className={cn(
              'w-4 h-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
          />
          {icon && <div className="text-primary shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              {modified && (
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                  edited
                </Badge>
              )}
            </div>
            {/* Collapsed: the summary IS the content, so it must carry the
                real values rather than a generic description. */}
            {!open && (
              <p className="text-xs text-muted-foreground truncate">{summary}</p>
            )}
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

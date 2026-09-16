// The numbered step strip across the top of the wizard:
//   (1) Cell »   (2) Subscriber »   (3) User Plane »  …
// Every step is clickable — this is a tabbed form, not a locked sequence —
// but the numbers keep the Simnovator reading order so a user coming from
// that tool knows where they are.
'use client';

import { ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STEPS, type StepKey } from '../types';

interface Props {
  active: StepKey;
  onSelect: (k: StepKey) => void;
  /** Steps with validation problems get a red dot. */
  problems?: Partial<Record<StepKey, number>>;
}

export function StepBar({ active, onSelect, problems }: Props) {
  return (
    <nav
      aria-label="Test case steps"
      className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 overflow-x-auto"
    >
      {STEPS.map((s, i) => {
        const isActive = s.key === active;
        const bad = problems?.[s.key] ?? 0;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            aria-current={isActive ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 text-sm whitespace-nowrap px-1 py-1 rounded transition-colors',
              isActive ? 'text-primary font-medium' : 'text-foreground/80 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold',
                isActive ? 'border-primary text-primary' : 'border-border text-muted-foreground',
              )}
            >
              {i + 1}
            </span>
            <span>{s.label}</span>
            {bad > 0 && (
              <span
                title={`${bad} issue${bad === 1 ? '' : 's'}`}
                className="inline-block h-1.5 w-1.5 rounded-full bg-destructive"
              />
            )}
            <ChevronsRight className={cn('w-3.5 h-3.5', isActive ? 'text-primary' : 'text-muted-foreground/60')} />
          </button>
        );
      })}
    </nav>
  );
}

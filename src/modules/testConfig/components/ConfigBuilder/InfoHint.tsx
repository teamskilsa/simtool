// Explanatory text belongs on demand, not permanently on screen.
//
// Every section used to carry a subtitle and most fields a paragraph of
// helper prose, which crowded out the controls themselves. That copy now
// lives behind a small info icon — same information, none of the space.
'use client';

import { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function InfoHint({ children }: { children: ReactNode }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={0}
          aria-label="More information"
          onClick={e => e.preventDefault()}
          className="inline-flex items-center text-muted-foreground/70 hover:text-foreground transition-colors align-middle"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-xs text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

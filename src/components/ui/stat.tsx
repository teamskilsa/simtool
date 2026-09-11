// Kicker + Stat — the two SimQA primitives that carry most of its look.
//
//   Kicker: the uppercase mono micro-label used above every metric, table
//           column group and card section.
//   Stat:   a metric tile — kicker, big tabular figure, optional unit and hint —
//           on a card with the orange hairline.
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';

export function Kicker({ className, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'block font-mono text-[10px] font-semibold uppercase tracking-label text-muted-foreground',
        className,
      )}
      {...rest}
    />
  );
}

type Tone = 'default' | 'good' | 'warn' | 'bad';

const TONE: Record<Tone, string> = {
  default: 'text-foreground',
  good: 'text-brand-teal-600 dark:text-brand-teal-400',
  warn: 'text-brand-amber-700 dark:text-brand-amber-400',
  bad: 'text-destructive',
};

interface StatProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: Tone;
  className?: string;
}

export function Stat({ label, value, unit, hint, tone = 'default', className }: StatProps) {
  return (
    <Card accent className={cn('px-4 py-3', className)}>
      <Kicker>{label}</Kicker>
      <div className={cn('num mt-1 flex items-baseline gap-1 text-xl font-bold leading-tight', TONE[tone])}>
        <span className="truncate">{value}</span>
        {unit ? <span className="text-xs font-medium text-muted-foreground">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

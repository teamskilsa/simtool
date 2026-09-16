// The "Cell 0  (+)" / "UE Group 0  (+)" row: one filled chip per entry,
// the active one in brand orange, a circled plus to add, and a small ×
// to remove (only when more than one exists, and only if the caller
// allows removal — some steps must always keep one entry).
'use client';

import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  count: number;
  active: number;
  onSelect: (idx: number) => void;
  onAdd?: () => void;
  onRemove?: (idx: number) => void;
  /** Extra text after the label, per chip (e.g. band or UE count). */
  detail?: (idx: number) => string | undefined;
  /** Cap for `onAdd`; the plus disappears once reached. */
  max?: number;
}

export function GroupChips({ label, count, active, onSelect, onAdd, onRemove, detail, max }: Props) {
  const canAdd = !!onAdd && (max === undefined || count < max);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {Array.from({ length: count }, (_, i) => {
        const isActive = i === active;
        const extra = detail?.(i);
        return (
          <div
            key={i}
            className={cn(
              'flex items-center rounded-md text-xs font-medium',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background border border-border/70 text-foreground/80 hover:text-primary',
            )}
          >
            <button type="button" onClick={() => onSelect(i)} className="px-3 py-1.5 whitespace-nowrap">
              {label} {i}
              {extra && (
                <span className={cn('ml-1.5 text-[10px]', isActive ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                  {extra}
                </span>
              )}
            </button>
            {onRemove && count > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                title={`Remove ${label} ${i}`}
                className={cn(
                  'p-1 mr-1 rounded hover:bg-red-500 hover:text-white',
                  isActive ? 'text-primary-foreground/70' : 'text-muted-foreground',
                )}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
      {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          title={`Add ${label}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

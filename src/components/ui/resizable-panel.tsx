'use client';

// Resizable two-pane horizontal split with draggable divider.
// Adapted from the TestMatrix_v1 ResizablePanel pattern.
import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ResizablePanelProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplit?: number;      // percent 0-100
  minSplit?: number;
  maxSplit?: number;
  leftClassName?: string;
  rightClassName?: string;
  className?: string;
}

export function ResizablePanel({
  left,
  right,
  defaultSplit = 55,
  minSplit = 25,
  maxSplit = 80,
  leftClassName,
  rightClassName,
  className,
}: ResizablePanelProps) {
  const [split, setSplit] = useState(defaultSplit);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(maxSplit, Math.max(minSplit, pct)));
    };
    const onUp = () => setDragging(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, minSplit, maxSplit]);

  return (
    <div
      ref={containerRef}
      className={cn('flex relative gap-0 min-h-[600px] w-full', className)}
    >
      <div
        className={cn('overflow-auto', leftClassName)}
        style={{ width: `calc(${split}% - 0.5rem)` }}
      >
        {left}
      </div>

      {/* Divider */}
      <div
        onMouseDown={onMouseDown}
        className={cn(
          'w-4 flex items-center justify-center cursor-col-resize group select-none z-10',
          dragging ? 'bg-indigo-100' : 'hover:bg-indigo-50 transition-colors'
        )}
      >
        <div
          className={cn(
            'w-1 h-10 rounded-full transition-colors',
            dragging ? 'bg-indigo-500' : 'bg-gray-300 group-hover:bg-indigo-400'
          )}
        />
      </div>

      <div
        className={cn('overflow-auto', rightClassName)}
        style={{ width: `calc(${100 - split}% - 0.5rem)` }}
      >
        {right}
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';

export const styles = {
  container: 'flex flex-col h-full max-h-screen overflow-hidden',
  glassEffect: cn(
    'bg-background/80 backdrop-blur-sm',
    'border border-border/50',
    'shadow-lg shadow-black/5'
  ),
  header: 'flex items-center justify-between p-4 border-b',
  content: 'flex flex-1 min-h-0',
  treeView: 'w-1/3 border-r p-4 overflow-auto',
  details: 'flex-1 p-4 overflow-auto',
  table: {
    container: 'relative overflow-hidden rounded-md border',
    header: 'bg-muted/50 sticky top-0',
    row: 'hover:bg-muted/50 transition-colors',
    cell: 'p-2'
  }
} as const;
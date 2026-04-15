// src/components/theme/utils/base-components.ts
export const baseComponents = {
  button: {
    base: 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    sizes: {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 rounded-md px-3',
      lg: 'h-11 rounded-md px-8',
      icon: 'h-10 w-10'
    },
    states: {
      active: 'ring-2',
      disabled: 'opacity-50 cursor-not-allowed',
      loading: 'opacity-80 cursor-wait'
    }
  },
  input: {
    base: 'flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
  },
  select: {
    trigger: 'flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    content: 'relative z-50 min-w-[8rem] overflow-hidden rounded-md border shadow-md animate-in fade-in-80',
    item: 'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none'
  },
  card: {
    base: 'rounded-lg border shadow-sm',
    header: 'flex flex-col space-y-1.5 p-6',
    content: 'p-6 pt-0',
    footer: 'flex items-center p-6 pt-0'
  },
  navigation: {
    base: 'flex items-center gap-2 rounded-lg px-3 py-2 transition-colors',
    icon: 'h-4 w-4'
  }
} as const;

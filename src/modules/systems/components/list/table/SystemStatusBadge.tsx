// modules/systems/components/list/table/SystemStatusBadge.tsx
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface StatusBadgeProps {
  connection?: {
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
  };
}

const STATUS_CONFIG = {
  connected: {
    label: 'Connected',
    icon: Wifi,
    className:
      'bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/25',
    dotClass: 'bg-green-500',
  },
  connecting: {
    label: 'Connecting',
    icon: Loader2,
    className:
      'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25',
    dotClass: 'bg-amber-500 animate-pulse',
  },
  error: {
    label: 'Error',
    icon: WifiOff,
    className:
      'bg-red-500/10 text-red-700 border-red-500/20 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25',
    dotClass: 'bg-red-500',
  },
  disconnected: {
    label: 'Disconnected',
    icon: WifiOff,
    className:
      'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/25',
    dotClass: 'bg-slate-400',
  },
} as const;

export function SystemStatusBadge({ connection }: StatusBadgeProps) {
  const status = connection?.status ?? 'disconnected';
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  const IconComponent = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

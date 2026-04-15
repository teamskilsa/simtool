import { Circle } from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import type { SystemStatus } from '../../types';

interface StatusBadgeProps {
  status: SystemStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { theme } = useTheme();
  const themeConfig = themes[theme];

  const getStatusStyles = (status: SystemStatus) => {
    switch (status) {
      case 'running':
        return `${themeConfig.colors.success[100]} ${themeConfig.colors.success[700]}`;
      case 'warning':
        return `${themeConfig.colors.warning[100]} ${themeConfig.colors.warning[700]}`;
      case 'stopped':
        return `${themeConfig.colors.destructive[100]} ${themeConfig.colors.destructive[700]}`;
    }
  };

  return (
    <div className={`
      px-2.5 py-1 rounded-full text-xs font-medium 
      inline-flex items-center gap-1.5
      ${getStatusStyles(status)}
    `}>
      <Circle className="w-2 h-2 fill-current" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
}

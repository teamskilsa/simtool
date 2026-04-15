// File: src/modules/statLogs/components/common/StatsSidebar.tsx
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/ui/sidebar';
import { BarChart2, Activity, List } from 'lucide-react';

interface StatsSidebarProps {
  className?: string;
  title?: string;
}

export const StatsSidebar = ({ className, title = "Monitoring" }: StatsSidebarProps) => {
  const pathname = usePathname();

  const links = [
    { 
      href: '/stats', 
      label: 'ENB Stats', 
      icon: BarChart2,
      active: pathname === '/stats'
    },
    { 
      href: '/stats/metrics', 
      label: 'Metrics', 
      icon: Activity,
      active: pathname === '/stats/metrics'
    },
    { 
      href: '/stats/logs', 
      label: 'Logs', 
      icon: List,
      active: pathname === '/stats/logs'
    },
  ];

  return (
    <Sidebar 
      className={className}
      links={links}
      title={title}
    />
  );
};
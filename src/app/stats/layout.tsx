'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/ui/navbar';
import { Sidebar } from '@/components/ui/sidebar';
import { BarChart2, Activity, List } from 'lucide-react';

export default function StatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const sidebarLinks = [
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
    <div className="min-h-screen bg-background">
      <Navbar className="border-b" />
      <div className="flex h-[calc(100vh-3.5rem)]">
        <Sidebar 
          className="w-64 border-r hidden md:block"
          links={sidebarLinks}
          title="Monitoring"
        />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
// modules/dashboard/components/dashboard-layout.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/modules/auth/context/auth-context';
import { useUser } from '@/modules/users/context/user-context';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { useState, useEffect } from 'react';
import { DashboardSidebar } from './dashboard-sidebar';
import { DashboardContent } from './dashboard-content';

export const DashboardLayout = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { user: currentUser, updatePreferences } = useUser();
  const { theme, mode } = useTheme();
  const themeConfig = themes[theme];

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');

  useEffect(() => {
    if (currentUser?.preferences.sidebarOpen !== undefined) {
      setIsSidebarOpen(currentUser.preferences.sidebarOpen);
    }
  }, [currentUser?.preferences.sidebarOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ section: string }>;
      if (custom.detail?.section) setActiveSection(custom.detail.section);
    };
    window.addEventListener('simtool:navigate', handler);
    return () => window.removeEventListener('simtool:navigate', handler);
  }, []);

  const handleSidebarToggle = (open: boolean) => {
    setIsSidebarOpen(open);
    if (currentUser) updatePreferences({ sidebarOpen: open });
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* Subtle dot-grid background overlay */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle, ${mode === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)'} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Content. The top header bar is gone — the sidebar carries the
          brand, search, theme and account controls it used to hold. */}
      <div className="relative z-10">
        <div className="flex">
          <DashboardSidebar
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={handleSidebarToggle}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            themeConfig={themeConfig}
            handleLogout={handleLogout}
          />

          <DashboardContent
            activeSection={activeSection}
            themeConfig={themeConfig}
          />
        </div>
      </div>
    </div>
  );
};

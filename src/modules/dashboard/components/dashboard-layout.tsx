// modules/dashboard/components/dashboard-layout.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/modules/auth/context/auth-context';
import { useUser } from '@/modules/users/context/user-context';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { useState, useEffect } from 'react';
import { DashboardHeader } from './dashboard-header';
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

  // Sync sidebar state with user preferences
  useEffect(() => {
    if (currentUser?.preferences.sidebarOpen !== undefined) {
      setIsSidebarOpen(currentUser.preferences.sidebarOpen);
    }
  }, [currentUser?.preferences.sidebarOpen]);

  // Cross-component navigation — e.g. "Edit in Builder" button in Test
  // Configurations dispatches this event to jump to Create Config.
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ section: string }>;
      if (custom.detail?.section) {
        setActiveSection(custom.detail.section);
      }
    };
    window.addEventListener('simtool:navigate', handler);
    return () => window.removeEventListener('simtool:navigate', handler);
  }, []);

  // Update user preferences when sidebar state changes
  const handleSidebarToggle = (open: boolean) => {
    setIsSidebarOpen(open);
    if (currentUser) {
      updatePreferences({ sidebarOpen: open });
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="relative min-h-screen">
      {/* Background with gradient and grid */}
      <div className={`fixed inset-0 ${themeConfig.gradients.background}`}>
        {/* Grid overlay */}
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(to right, ${mode === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'} 1px, transparent 1px),
              linear-gradient(to bottom, ${mode === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'} 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
            opacity: 0.4
          }}
        />
        
        {/* Glass effect overlay */}
        <div className={`absolute inset-0 ${themeConfig.effects.glass.light}`} />
      </div>

      {/* Content */}
      <div className="relative z-10">
      <DashboardHeader 
          user={user}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={handleSidebarToggle}
          handleLogout={handleLogout}
          themeConfig={themeConfig}
          setActiveSection={setActiveSection}  // Add this line
        />
        
        <div className="flex">
          <DashboardSidebar 
            isSidebarOpen={isSidebarOpen}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            themeConfig={themeConfig}
          />
          
          <DashboardContent 
            activeSection={activeSection}
            themeConfig={themeConfig}
          />
        </div>
      </div>

      {/* Theme-colored bottom gradient */}
      <div 
        className={`
          fixed bottom-0 left-0 right-0 h-32 
          pointer-events-none 
          bg-gradient-to-t 
          ${mode === 'light' 
            ? `from-${theme}-100/50 to-transparent` 
            : `from-${theme}-900/50 to-transparent`
          }
        `} 
      />
    </div>
  );
};
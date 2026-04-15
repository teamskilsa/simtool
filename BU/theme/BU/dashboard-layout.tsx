// modules/dashboard/components/dashboard-layout.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/modules/auth/context/auth-context';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { useState } from 'react';
import { DashboardHeader } from './dashboard-header';
import { DashboardSidebar } from './dashboard-sidebar';
import { DashboardContent } from './dashboard-content';
import type { NavigationItem } from '../types';

export const DashboardLayout = () => {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme } = useTheme();
  const themeConfig = themes[theme];
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleLogout = async () => {
    logout();
    router.push('/');
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <DashboardHeader 
        user={user}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        themeConfig={themeConfig}
      />
      
      <div className="flex">
        <DashboardSidebar 
          isSidebarOpen={isSidebarOpen}
          isDarkMode={isDarkMode}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          themeConfig={themeConfig}
        />
        
        <DashboardContent 
          isDarkMode={isDarkMode}
          activeSection={activeSection}
          themeConfig={themeConfig}
        />
      </div>
    </div>
  );
};
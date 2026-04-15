// modules/dashboard/components/dashboard-header.tsx
'use client';

import { Menu, Search, Shield } from 'lucide-react';
import { ThemeSelector } from '@/components/theme/theme-selector';
import type { User } from '@/modules/auth/types';
import type { ThemeConfig } from '../types';

interface DashboardHeaderProps {
  user: User | null;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  handleLogout: () => void;
  themeConfig: ThemeConfig;
}

export const DashboardHeader = ({
  user,
  isSidebarOpen,
  setIsSidebarOpen,
  handleLogout,
  themeConfig
}: DashboardHeaderProps) => {
  return (
    <header className={`sticky top-0 z-50 border-b ${themeConfig.colors.header} ${themeConfig.border}`}>
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-lg ${themeConfig.colors.hover} transition-colors`}
          >
            <Menu className={`w-6 h-6 ${themeConfig.colors.muted}`} />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-lg ${themeConfig.accent} flex items-center justify-center`}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className={`text-xl font-semibold ${themeConfig.colors.primaryText}`}>
              Network Testing Portal
              <span className={`text-xs font-normal ml-2 px-2 py-0.5 rounded-full ${themeConfig.accent} bg-opacity-10 ${themeConfig.text}`}>
                Beta
              </span>
            </div>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <input 
              type="text"
              placeholder="Search tests, configurations..."
              className={`
                w-80 pl-10 pr-4 py-2 rounded-xl border
                ${themeConfig.blur}
                ${themeConfig.border}
                focus:outline-none focus:ring-2 
                focus:${themeConfig.accent.replace('bg-', 'ring-')} 
                focus:ring-opacity-50
                placeholder:${themeConfig.colors.muted}
              `}
            />
            <Search className={`w-5 h-5 ${themeConfig.colors.muted} absolute left-3 top-2.5`} />
          </div>

          {/* Theme Selector */}
          <div className="px-2">
            <ThemeSelector />
          </div>

          {/* User Profile/Logout */}
          <button 
            onClick={handleLogout}
            className={`flex items-center space-x-3 pl-3 pr-4 py-1.5 rounded-lg ${themeConfig.colors.hover}`}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white font-medium">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden md:block">
              <div className={`text-sm font-medium ${themeConfig.colors.primaryText}`}>
                {user?.username || 'User'}
              </div>
              <div className={`text-xs ${themeConfig.colors.muted}`}>Logout</div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
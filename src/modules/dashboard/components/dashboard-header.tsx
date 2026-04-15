// modules/dashboard/components/dashboard-header.tsx
'use client';

import { useState } from 'react';
import { 
  Menu, 
  Search, 
  Shield, 
  Settings, 
  Bell, 
  ChevronDown,
  User,
  Users,
  LogOut
} from 'lucide-react';
import { ThemeSelector } from '@/components/theme/theme-selector';
import type { User as UserType } from '@/modules/auth/types';
import type { ThemeConfig } from '@/components/theme/types/theme.types';
import { useUser } from '@/modules/users/context/user-context';

interface DashboardHeaderProps {
  user: UserType | null;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  handleLogout: () => void;
  themeConfig: ThemeConfig;
  setActiveSection: (section: string) => void;
}

export const DashboardHeader = ({
  user,
  isSidebarOpen,
  setIsSidebarOpen,
  handleLogout,
  themeConfig,
  setActiveSection
}: DashboardHeaderProps) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user: currentUser } = useUser();

  return (
    <header className={`
      sticky top-0 z-50 
      border-b
      shadow-sm
      backdrop-blur-md
      ${themeConfig.components.button.variants.default.replace('hover:bg-amber-700', '')}
      bg-opacity-90
    `}>
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="text-xl font-semibold text-white">
              Network Testing Portal
              <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full bg-white/20">
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
                w-80 pl-10 pr-4 py-2 rounded-xl
                bg-white/10
                border-white/20
                text-white
                placeholder:text-white/60
                focus:bg-white/20
                focus:border-white/30
                transition-colors
              `}
            />
            <Search className="w-5 h-5 text-white/70 absolute left-3 top-2.5" />
          </div>

          {/* Notifications */}
          <button className="p-2 rounded-lg hover:bg-white/10 transition-colors relative">
            <Bell className="w-5 h-5 text-white" />
            {currentUser?.preferences.notifications.configChanges && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>

          {/* Theme Selector */}
          <div className="px-2">
            <ThemeSelector />
          </div>

          {/* User Profile/Logout */}
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 pl-3 pr-4 py-1.5 rounded-lg hover:bg-white/10"
            >
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <span className="text-white font-medium">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-white">
                  {user?.username || 'User'}
                </div>
                <div className="text-xs text-white/70">{user?.role}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-white/70" />
            </button>

            {showUserMenu && (
              <div className={`
                absolute right-0 mt-2 w-56
                rounded-lg shadow-lg
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                divide-y divide-gray-100 dark:divide-gray-700
                z-50
              `}>
                <div className="p-2">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user?.username}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.role.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      setActiveSection('profile');
                      setShowUserMenu(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile Settings
                  </button>
                  <button
                    onClick={() => {
                      setActiveSection('preferences');
                      setShowUserMenu(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Preferences
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setActiveSection('users');
                        setShowUserMenu(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      User Management
                    </button>
                  )}
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      handleLogout();
                      setShowUserMenu(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md flex items-center"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
// modules/dashboard/components/dashboard-sidebar.tsx
'use client';

import type { ThemeConfig } from '@/components/theme/types/theme.types';
import { useUser } from '@/modules/users/context/user-context';
import { 
  LayoutDashboard, 
  TestTube, 
  Play, 
  FileText, 
  Server, 
  Plus, 
  List, 
  FolderTree, 
  Terminal,
  ChevronRight,
  Settings,
  Activity,
  Users,
  Signal,
  WifiOff,
  Code,
  Bell,
  Shield,
  User
} from 'lucide-react';

interface DashboardSidebarProps {
  isSidebarOpen: boolean;
  activeSection: string;
  setActiveSection: (section: string) => void;
  themeConfig: ThemeConfig;
}

export const DashboardSidebar = ({
  isSidebarOpen,
  activeSection,
  setActiveSection,
  themeConfig
}: DashboardSidebarProps) => {
  const { user } = useUser();
  
  const NAVIGATION_ITEMS = [
    {
      id: 'dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
      badge: '3'
    },
    {
      id: 'test-management',
      icon: TestTube,
      label: 'Test Management',
      subItems: [
        { id: 'create-test', label: 'Create Test', icon: Plus },
        { id: 'test-configs', label: 'Test Configurations', icon: List },
        { id: 'test-sections', label: 'Section Files', icon: FolderTree },
        { id: 'test-execution', label: 'Test Execution', icon: Play } 
      ]
    },
    {
      id: 'automation',
      icon: Play,
      label: 'Automation',
      badge: 'New',
      subItems: [
        { id: 'create-script', label: 'Create Script', icon: Terminal },
        { id: 'test-suites', label: 'Test Suites', icon: FileText },
        { id: 'monitoring', label: 'Monitoring', icon: Activity }
      ]
    },
    {
      id: 'systems',
      icon: Server,
      label: 'Test Systems',
      badge: '2'
    },
    {
      id: 'remote-api',
      icon: Signal,
      label: 'Remote API'
    },
    // Only show user management for admin
    ...(user?.role === 'admin' ? [{
      id: 'user-management',
      icon: Users,
      label: 'User Management',
      subItems: [
        { id: 'users', label: 'Users', icon: Users },
        { id: 'roles', label: 'Roles & Permissions', icon: Shield }
      ]
    }] : []),
    // User profile section for all users
    {
      id: 'user-profile',
      icon: User,
      label: 'Profile',
      subItems: [
        { id: 'profile', label: 'Settings', icon: Settings },
        { id: 'preferences', label: 'Preferences', icon: Bell }
      ]
    }
  ];

  // Helper function to check if a section is active (including sub-items)
  const isSectionActive = (itemId: string) => {
    return activeSection === itemId || activeSection.startsWith(`${itemId}-`);
  };

  // Helper function to check if a sub-item is active
  const isSubItemActive = (subItemId: string) => {
    return activeSection === subItemId;
  };

  return (
    <div className={`
      ${isSidebarOpen ? 'w-64' : 'w-20'} 
      transition-all duration-300 
      ${themeConfig.components.button.variants.default.replace('hover:bg-amber-700', '')}
      bg-opacity-90
      backdrop-blur-md
      border-r border-white/20
      h-[calc(100vh-64px)] sticky top-16
    `}>
      <nav className="p-4 space-y-2">
        {NAVIGATION_ITEMS.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => setActiveSection(item.id)}
              className={`
                flex items-center w-full px-3 py-2 rounded-xl 
                transition-all group relative
                ${isSectionActive(item.id)
                  ? 'bg-white/20' 
                  : 'hover:bg-white/10'
                }
              `}
            >
              {/* Rest of the button content remains the same */}
              <div className={`
                w-8 h-8 rounded-lg 
                ${isSectionActive(item.id)
                  ? 'bg-white/30' 
                  : 'bg-white/10'
                }
                flex items-center justify-center
              `}>
                <item.icon className={`
                  w-4 h-4 text-white
                  ${isSectionActive(item.id)
                    ? 'opacity-100'
                    : 'opacity-70'
                  }
                `} />
              </div>
              
              {isSidebarOpen && (
                <>
                  <span className={`
                    ml-3 text-sm font-medium
                    text-white
                    ${isSectionActive(item.id)
                      ? 'opacity-100'
                      : 'opacity-70'
                    }
                  `}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className={`
                      ml-auto px-2 py-0.5 text-xs rounded-full
                      ${item.badge === 'New' 
                        ? 'bg-white/20 text-white'
                        : 'bg-white/10 text-white/70'
                      }
                    `}>
                      {item.badge}
                    </span>
                  )}
                  {item.subItems && (
                    <ChevronRight className={`
                      w-4 h-4 ml-auto transition-transform
                      text-white/50
                      ${isSectionActive(item.id) ? 'rotate-90' : ''}
                    `} />
                  )}
                </>
              )}
            </button>
            
            {item.subItems && isSidebarOpen && isSectionActive(item.id) && (
              <div className="mt-2 ml-4 space-y-1">
                {item.subItems.map((subItem) => (
                  <button
                    key={subItem.id}
                    onClick={() => setActiveSection(subItem.id)}
                    className={`
                      flex items-center w-full px-3 py-2 text-sm 
                      rounded-lg transition-colors
                      ${isSubItemActive(subItem.id)
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                      }
                    `}
                  >
                    <subItem.icon className={`
                      w-4 h-4 mr-3 
                      ${isSubItemActive(subItem.id)
                        ? 'text-white'
                        : 'text-white/70'
                      }
                    `} />
                    <span>
                      {subItem.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
};
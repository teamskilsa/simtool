// modules/dashboard/components/dashboard-sidebar.tsx
'use client';

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
} from 'lucide-react';
import type { ThemeConfig } from '../types';

interface DashboardSidebarProps {
  isSidebarOpen: boolean;
  activeSection: string;
  setActiveSection: (section: string) => void;
  themeConfig: ThemeConfig;
}

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
      { id: 'test-sections', label: 'Section Files', icon: FolderTree }
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
    id: 'users',
    icon: Users,
    label: 'Users'
  }
];

export const DashboardSidebar = ({
  isSidebarOpen,
  activeSection,
  setActiveSection,
  themeConfig
}: DashboardSidebarProps) => {
  return (
    <div className={`
      ${isSidebarOpen ? 'w-64' : 'w-20'} 
      transition-all duration-300 
      ${themeConfig.colors.sidebar}
      ${themeConfig.border}
      border-r h-[calc(100vh-64px)] sticky top-16
    `}>
      <nav className="p-4 space-y-2">
        {NAVIGATION_ITEMS.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => setActiveSection(item.id)}
              className={`
                flex items-center w-full px-3 py-2 rounded-xl 
                transition-all group relative
                ${activeSection === item.id 
                  ? `${themeConfig.accent} bg-opacity-10 ${themeConfig.text}` 
                  : themeConfig.colors.hover
                }
              `}
            >
              {/* Icon Container */}
              <div className={`
                w-8 h-8 rounded-lg 
                ${activeSection === item.id 
                  ? `${themeConfig.accent} bg-opacity-10` 
                  : themeConfig.colors.secondary
                }
                flex items-center justify-center
              `}>
                <item.icon className={`
                  w-4 h-4 
                  ${activeSection === item.id 
                    ? themeConfig.text 
                    : themeConfig.colors.muted
                  }
                `} />
              </div>
              
              {isSidebarOpen && (
                <>
                  <span className="ml-3 text-sm font-medium">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className={`
                      ml-auto px-2 py-0.5 text-xs rounded-full
                      ${item.badge === 'New' 
                        ? themeConfig.badges.new 
                        : themeConfig.badges.default
                      }
                    `}>
                      {item.badge}
                    </span>
                  )}
                  {item.subItems && (
                    <ChevronRight className={`
                      w-4 h-4 ml-auto transition-transform
                      ${activeSection === item.id ? 'rotate-90' : ''}
                      ${themeConfig.colors.muted}
                    `} />
                  )}
                </>
              )}
            </button>
            
            {item.subItems && isSidebarOpen && activeSection === item.id && (
              <div className="mt-2 ml-4 space-y-1">
                {item.subItems.map((subItem) => (
                  <button
                    key={subItem.id}
                    className={`
                      flex items-center w-full px-3 py-2 text-sm 
                      rounded-lg transition-colors
                      ${themeConfig.colors.hover}
                    `}
                  >
                    <subItem.icon className={`w-4 h-4 mr-3 ${themeConfig.colors.muted}`} />
                    <span className={themeConfig.colors.muted}>
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
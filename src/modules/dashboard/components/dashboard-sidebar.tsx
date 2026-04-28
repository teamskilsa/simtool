// modules/dashboard/components/dashboard-sidebar.tsx
'use client';

import type { ThemeConfig } from '@/components/theme/types/theme.types';
import { useTheme } from '@/components/theme/context/theme-context';
import { THEME_CHROME_BG } from '@/components/theme/utils/theme-chrome';
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
  Code,
  Bell,
  User,
  Package,
} from 'lucide-react';

interface DashboardSidebarProps {
  isSidebarOpen: boolean;
  activeSection: string;
  setActiveSection: (section: string) => void;
  themeConfig: ThemeConfig;
}

const NAVIGATION_ITEMS = [
  { id: 'dashboard',       icon: LayoutDashboard, label: 'Dashboard',       badge: '3' },
  {
    id: 'test-management', icon: TestTube, label: 'Test Management',
    subItems: [
      { id: 'create-test',    label: 'Create Test',          icon: Plus },
      { id: 'test-configs',   label: 'Test Configurations',  icon: List },
      { id: 'test-sections',  label: 'Section Files',        icon: FolderTree },
      { id: 'test-execution', label: 'Test Execution',       icon: Play },
    ],
  },
  {
    id: 'automation', icon: Play, label: 'Automation', badge: 'New',
    subItems: [
      { id: 'create-script', label: 'Create Script', icon: Terminal },
      { id: 'test-suites',   label: 'Test Suites',   icon: FileText },
      { id: 'monitoring',    label: 'Monitoring',    icon: Activity },
    ],
  },
  { id: 'systems',       icon: Server,  label: 'Test Systems', badge: '2' },
  { id: 'sw-management', icon: Package, label: 'SW Management' },
  { id: 'remote-api',    icon: Signal,  label: 'Remote API' },
];

const ADMIN_ITEMS = [
  // User Management is a single-view section now — there's no separate
  // Roles screen; roles ('admin' | 'user') are picked inside the user
  // create/edit dialogs. Keeping it as a leaf entry so clicks land
  // directly on the user list instead of a non-existent group page.
  { id: 'users', icon: Users, label: 'User Management' },
];

const PROFILE_ITEMS = [
  {
    id: 'user-profile', icon: User, label: 'Profile',
    subItems: [
      { id: 'profile',     label: 'Settings',    icon: Settings },
      { id: 'preferences', label: 'Preferences', icon: Bell     },
    ],
  },
];

export const DashboardSidebar = ({
  isSidebarOpen,
  activeSection,
  setActiveSection,
  themeConfig,
}: DashboardSidebarProps) => {
  const { user } = useUser();
  const { theme } = useTheme();

  const chromeBg = THEME_CHROME_BG[theme] ?? 'bg-indigo-600';

  const allItems = [
    ...NAVIGATION_ITEMS,
    ...(user?.role === 'admin' ? ADMIN_ITEMS : []),
    ...PROFILE_ITEMS,
  ];

  // A group is "active" (expanded + highlighted) when any of its sub-items
  // is the current section. Sub-item IDs don't share a prefix with the
  // group ID in this app (e.g. 'test-execution' vs 'test-management'), so
  // we look the group up directly and walk its sub-items.
  const groupContainsActive = (id: string): boolean => {
    if (activeSection === id || activeSection.startsWith(`${id}-`)) return true;
    const item = allItems.find(i => i.id === id);
    return !!item?.subItems?.some(s => s.id === activeSection);
  };
  const isSectionActive = groupContainsActive;
  const isSubItemActive = (id: string) => activeSection === id;

  return (
    <div
      className={`
        ${isSidebarOpen ? 'w-64' : 'w-20'}
        transition-all duration-300
        ${chromeBg}
        bg-opacity-90
        backdrop-blur-md
        border-r border-white/10
        h-[calc(100vh-64px)] sticky top-16
        overflow-y-auto overflow-x-hidden
      `}
    >
      <nav className="p-4 space-y-1">
        {allItems.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => {
                // For groups with sub-items, jumping to the parent ID lands
                // on a placeholder ("Content for <id> section will be
                // displayed here"). Always default to the first sub-item so
                // a click on the group label gets the user to a real view.
                if (item.subItems && item.subItems.length > 0) {
                  setActiveSection(item.subItems[0].id);
                } else {
                  setActiveSection(item.id);
                }
              }}
              className={`
                flex items-center w-full px-3 py-2 rounded-xl
                transition-all group relative
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40
                ${isSectionActive(item.id) ? 'bg-white/20' : 'hover:bg-white/10'}
              `}
            >
              <div
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isSectionActive(item.id) ? 'bg-white/30' : 'bg-white/10'}
                `}
              >
                <item.icon
                  className={`w-4 h-4 text-white ${isSectionActive(item.id) ? 'opacity-100' : 'opacity-70'}`}
                />
              </div>

              {isSidebarOpen && (
                <>
                  <span
                    className={`
                      ml-3 text-sm font-medium text-white truncate
                      ${isSectionActive(item.id) ? 'opacity-100' : 'opacity-70'}
                    `}
                  >
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className={`
                        ml-auto px-2 py-0.5 text-xs rounded-full flex-shrink-0
                        ${item.badge === 'New'
                          ? 'bg-white/25 text-white font-medium'
                          : 'bg-white/10 text-white/70'}
                      `}
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.subItems && (
                    <ChevronRight
                      className={`
                        w-4 h-4 ml-auto text-white/50 transition-transform flex-shrink-0
                        ${isSectionActive(item.id) ? 'rotate-90' : ''}
                      `}
                    />
                  )}
                </>
              )}
            </button>

            {item.subItems && isSidebarOpen && isSectionActive(item.id) && (
              <div className="mt-1 ml-4 space-y-0.5">
                {item.subItems.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSection(sub.id)}
                    className={`
                      flex items-center w-full px-3 py-2 text-sm rounded-lg transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40
                      ${isSubItemActive(sub.id)
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'}
                    `}
                  >
                    <sub.icon
                      className={`w-4 h-4 mr-3 ${isSubItemActive(sub.id) ? 'text-white' : 'text-white/70'}`}
                    />
                    {sub.label}
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

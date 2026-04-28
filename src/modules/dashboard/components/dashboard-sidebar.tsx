// modules/dashboard/components/dashboard-sidebar.tsx
//
// Sidebar IA follows the user workflow: Build → Run → Observe → Infra → Admin.
// Top-level entries are deliberately phase-aligned so a user reading
// top-down sees what to do next:
//
//   1. Test Management  — build configs / sections (the artifacts)
//   2. Test Execution   — run them (Quick Run for single, Scenarios for multi)
//   3. Stats            — watch live KPIs from a running system
//   ─── infra ───
//   4. Test Systems / Remote API / SW Management
//   ─── admin ───
//   5. User Management / Profile
//
// Test Execution and Stats are top-level because they're the "Run" and
// "Observe" phases of the workflow — burying them under Test Management
// (a build-phase group) or Automation (which had alias entries) hid the
// path from new callbox users.
'use client';

import type { ThemeConfig } from '@/components/theme/types/theme.types';
import { useTheme } from '@/components/theme/context/theme-context';
import { THEME_CHROME_BG } from '@/components/theme/utils/theme-chrome';
import { useUser } from '@/modules/users/context/user-context';
import {
  LayoutDashboard,
  TestTube,
  Play,
  Server,
  Plus,
  List,
  FolderTree,
  ChevronRight,
  Settings,
  LineChart,
  Users,
  Signal,
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

interface NavSubItem {
  id: string;
  label: string;
  icon: any;
}
interface NavLink {
  kind?: 'link';
  id: string;
  icon: any;
  label: string;
  badge?: string;
  subItems?: NavSubItem[];
}
interface NavDivider { kind: 'divider' }
type NavEntry = NavLink | NavDivider;

const isLink = (e: NavEntry): e is NavLink => (e as NavDivider).kind !== 'divider';

// ── Build → Run → Observe ──────────────────────────────────────────────────
const NAVIGATION_ITEMS: NavEntry[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: '3' },

  // Build phase — preparing config artifacts.
  {
    id: 'test-management', icon: TestTube, label: 'Test Management',
    subItems: [
      { id: 'create-test',   label: 'Create Test',         icon: Plus },
      { id: 'test-configs',  label: 'Test Configurations', icon: List },
      { id: 'test-sections', label: 'Section Files',       icon: FolderTree },
    ],
  },

  // Run phase — actually executing. Top-level, with Quick Run / Scenarios
  // tabs inside the view itself.
  { id: 'test-execution', icon: Play, label: 'Test Execution' },

  // Observe phase — live KPIs from the box you just ran configs against.
  { id: 'stats', icon: LineChart, label: 'Stats' },

  { kind: 'divider' },

  // Infrastructure / target-host management.
  { id: 'systems',       icon: Server,  label: 'Test Systems', badge: '2' },
  { id: 'sw-management', icon: Package, label: 'SW Management' },
  { id: 'remote-api',    icon: Signal,  label: 'Remote API' },
];

// ── Admin ──────────────────────────────────────────────────────────────────
// User Management is a single-view section now — there's no separate
// Roles screen; roles ('admin' | 'user') are picked inside the user
// create/edit dialogs. Keeping it as a leaf entry so clicks land
// directly on the user list instead of a non-existent group page.
const ADMIN_ITEMS: NavEntry[] = [
  { kind: 'divider' },
  { id: 'users', icon: Users, label: 'User Management' },
];

const PROFILE_ITEMS: NavEntry[] = [
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
}: DashboardSidebarProps) => {
  const { user } = useUser();
  const { theme } = useTheme();

  const chromeBg = THEME_CHROME_BG[theme] ?? 'bg-indigo-600';

  const allItems: NavEntry[] = [
    ...NAVIGATION_ITEMS,
    ...(user?.role === 'admin' ? ADMIN_ITEMS : []),
    ...PROFILE_ITEMS,
  ];

  // A group is "active" (expanded + highlighted) when any of its sub-items
  // is the current section. Sub-item IDs don't share a prefix with the
  // group ID in this app (e.g. 'create-test' vs 'test-management'), so we
  // look the group up directly and walk its sub-items.
  const groupContainsActive = (id: string): boolean => {
    if (activeSection === id || activeSection.startsWith(`${id}-`)) return true;
    const item = allItems.filter(isLink).find(i => i.id === id);
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
        {allItems.map((entry, idx) => {
          if (!isLink(entry)) {
            // Visual rhythm between phase clusters.
            return <div key={`div-${idx}`} className="my-3 border-t border-white/15" />;
          }
          const item = entry;
          return (
            <div key={item.id}>
              <button
                onClick={() => {
                  // Groups with sub-items: jump to the first sub-item so
                  // the click lands on a real view (not a placeholder).
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
          );
        })}
      </nav>
    </div>
  );
};

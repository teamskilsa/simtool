// modules/dashboard/components/dashboard-sidebar.tsx
//
// Sidebar in the Simnovus design language shared with SimQA: a light surface
// panel (petrol in dark mode), mono uppercase section labels, and an orange
// active item — replacing the solid theme-coloured slab.
//
// IA follows the user workflow: Build → Run → Observe, then infrastructure,
// admin and account. Test Execution and Stats stay top-level because they are
// the "Run" and "Observe" phases; burying them under Test Management hid the
// path from new callbox users.
'use client';

import type { ThemeConfig } from '@/components/theme/types/theme.types';
import { useUser } from '@/modules/users/context/user-context';
import { useState } from 'react';
import { ModeToggle } from '@/components/theme/mode-toggle';
import { cn } from '@/lib/utils';
import {
  Menu,
  Search,
  LogOut,
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
  Smartphone,
  RadioTower,
} from 'lucide-react';

interface DashboardSidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  activeSection: string;
  setActiveSection: (section: string) => void;
  themeConfig: ThemeConfig;
  handleLogout: () => void;
}

interface NavSubItem {
  id: string;
  label: string;
  icon: any;
}
interface NavLink {
  id: string;
  icon: any;
  label: string;
  badge?: string;
  subItems?: NavSubItem[];
}
interface NavSection {
  title: string;
  items: NavLink[];
  adminOnly?: boolean;
}

const SECTIONS: NavSection[] = [
  {
    title: 'Workflow',
    items: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: '3' },
      {
        id: 'test-management', icon: TestTube, label: 'Test Management',
        subItems: [
          { id: 'create-test',   label: 'Create Test',         icon: Plus },
          { id: 'test-configs',  label: 'Test Configurations', icon: List },
          { id: 'test-sections', label: 'Section Files',       icon: FolderTree },
        ],
      },
      { id: 'test-execution', icon: Play,       label: 'Test Execution' },
      { id: 'stats',          icon: LineChart,  label: 'Stats' },
      { id: 'uesim',          icon: Smartphone, label: 'UE Simulator' },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { id: 'systems',       icon: Server,  label: 'Test Systems', badge: '2' },
      { id: 'sw-management', icon: Package, label: 'SW Management' },
      { id: 'remote-api',    icon: Signal,  label: 'Remote API' },
    ],
  },
  {
    title: 'Admin',
    adminOnly: true,
    items: [{ id: 'users', icon: Users, label: 'User Management' }],
  },
  {
    title: 'Account',
    items: [
      {
        id: 'user-profile', icon: User, label: 'Profile',
        subItems: [
          { id: 'profile',     label: 'Settings',    icon: Settings },
          { id: 'preferences', label: 'Preferences', icon: Bell     },
        ],
      },
    ],
  },
];

// Orange text on paper needs the darker step to stay legible; the lighter
// step reads on petrol.
const ACTIVE_ITEM =
  'bg-brand-orange/10 font-medium text-brand-orange-700 ring-1 ring-inset ring-brand-orange/25 ' +
  'dark:text-brand-orange-400';
const IDLE_ITEM = 'text-foreground/80 hover:bg-accent hover:text-foreground';

export const DashboardSidebar = ({
  isSidebarOpen,
  setIsSidebarOpen,
  activeSection,
  setActiveSection,
  handleLogout,
}: DashboardSidebarProps) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user } = useUser();

  const sections = SECTIONS.filter(s => !s.adminOnly || user?.role === 'admin');
  const allItems = sections.flatMap(s => s.items);

  // A group is "active" (expanded + highlighted) when any of its sub-items is
  // the current section. Sub-item IDs don't share a prefix with the group ID
  // (e.g. 'create-test' vs 'test-management'), so walk the sub-items.
  const isSectionActive = (id: string): boolean => {
    if (activeSection === id || activeSection.startsWith(`${id}-`)) return true;
    const item = allItems.find(i => i.id === id);
    return !!item?.subItems?.some(s => s.id === activeSection);
  };
  const isSubItemActive = (id: string) => activeSection === id;

  return (
    <aside
      className={cn(
        isSidebarOpen ? 'w-60' : 'w-16',
        'sticky top-0 flex h-screen shrink-0 flex-col overflow-x-hidden',
        'border-r border-border bg-card transition-[width] duration-150 ease-out',
      )}
    >
      {/* ── Brand + collapse ── */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-border',
          isSidebarOpen ? 'gap-2.5 px-3' : 'justify-center px-2',
        )}
      >
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-orange to-brand-orange-600 text-white shadow-accent">
          <RadioTower className="h-4 w-4" strokeWidth={2.25} />
        </div>
        {isSidebarOpen && (
          <div className="min-w-0 flex-1 leading-none">
            <div className="truncate text-sm font-semibold tracking-tight">
              Sim<span className="text-brand-orange-700 dark:text-brand-orange-400">Tool</span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-label text-muted-foreground">
              Simnovus
            </div>
          </div>
        )}
        {isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
            aria-label="Collapse sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
      </div>

      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="mx-auto mt-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Expand sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {/* ── Search ── */}
      {isSidebarOpen && (
        <div className="shrink-0 px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search…"
              className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm placeholder:text-muted-foreground transition-colors focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/25"
            />
          </div>
        </div>
      )}

      <nav className={cn('flex-1 overflow-y-auto', isSidebarOpen ? 'px-2 pb-3' : 'px-2 pb-3 pt-1')}>
        {sections.map((section, sIdx) => (
          <div key={section.title}>
            {isSidebarOpen ? (
              <div className="px-2 pb-1 pt-4 font-mono text-[10px] font-semibold uppercase tracking-label text-muted-foreground">
                {section.title}
              </div>
            ) : (
              sIdx > 0 && <div className="mx-2 my-2 h-px bg-border" />
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isSectionActive(item.id);
                return (
                  <div key={item.id}>
                    <button
                      onClick={() => {
                        // Groups jump to their first sub-item so the click
                        // lands on a real view, not a placeholder.
                        if (item.subItems && item.subItems.length > 0) {
                          setActiveSection(item.subItems[0].id);
                        } else {
                          setActiveSection(item.id);
                        }
                      }}
                      title={isSidebarOpen ? undefined : item.label}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-md py-2 text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40',
                        isSidebarOpen ? 'px-3' : 'justify-center px-0',
                        active ? ACTIVE_ITEM : IDLE_ITEM,
                      )}
                    >
                      <item.icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-brand-orange' : 'text-muted-foreground group-hover:text-foreground',
                        )}
                        strokeWidth={2}
                      />
                      {isSidebarOpen && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-inset ring-border">
                              {item.badge}
                            </span>
                          )}
                          {item.subItems && (
                            <ChevronRight
                              className={cn(
                                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                                !item.badge && 'ml-auto',
                                active && 'rotate-90',
                              )}
                            />
                          )}
                        </>
                      )}
                    </button>

                    {item.subItems && isSidebarOpen && active && (
                      <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
                        {item.subItems.map((sub) => {
                          const subActive = isSubItemActive(sub.id);
                          return (
                            <button
                              key={sub.id}
                              onClick={() => setActiveSection(sub.id)}
                              className={cn(
                                'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40',
                                subActive ? ACTIVE_ITEM : IDLE_ITEM,
                              )}
                            >
                              <sub.icon
                                className={cn(
                                  'h-3.5 w-3.5 shrink-0',
                                  subActive ? 'text-brand-orange' : 'text-muted-foreground group-hover:text-foreground',
                                )}
                              />
                              <span className="truncate">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Account + mode ── */}
      <div className={cn('shrink-0 border-t border-border', isSidebarOpen ? 'p-3' : 'p-2')}>
        <div className={cn('relative flex items-center gap-2', !isSidebarOpen && 'flex-col')}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-lg p-1 transition-colors hover:bg-accent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40',
              isSidebarOpen && 'flex-1',
            )}
            title={isSidebarOpen ? undefined : user?.username}
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-orange/15 text-xs font-bold text-brand-orange-700 dark:text-brand-orange-400">
              {user?.username?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            {isSidebarOpen && (
              <div className="min-w-0 flex-1 text-left leading-none">
                <div className="truncate text-sm font-medium">{user?.username ?? 'User'}</div>
                <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                  {user?.role}
                </div>
              </div>
            )}
          </button>

          <ModeToggle />

          {showUserMenu && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-56 divide-y divide-border rounded-lg border border-border bg-popover shadow-glow">
              <div className="p-1.5">
                <button
                  onClick={() => { setActiveSection('profile'); setShowUserMenu(false); }}
                  className="flex w-full items-center rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile Settings
                </button>
                <button
                  onClick={() => { setActiveSection('preferences'); setShowUserMenu(false); }}
                  className="flex w-full items-center rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Preferences
                </button>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => { setActiveSection('users'); setShowUserMenu(false); }}
                    className="flex w-full items-center rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    User Management
                  </button>
                )}
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => { handleLogout(); setShowUserMenu(false); }}
                  className="flex w-full items-center rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-accent"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

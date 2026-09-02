// modules/dashboard/components/dashboard-content.tsx
'use client';

import dynamic from 'next/dynamic';
import { ConfigProvider } from '@/modules/testConfig/context';
import { useUser } from '@/modules/users/context/user-context';

// Every section below used to be a static import. Because this file imports
// all of them, opening ANY dashboard section downloaded the entire app —
// recharts (Stats), xterm (Remote API), the config builders and the UE
// simulator — even though the default view renders a single line of text.
// Measured on /dashboard before this change: ~7 MB of JS, a 4.2 MB page.js.
//
// next/dynamic splits each section into its own chunk that is fetched the
// first time the user opens that section. ssr:false is correct here: these
// are all 'use client' views that read localStorage / websockets on mount.
const sectionLoading = () => (
  <div className="flex items-center justify-center py-16">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
  </div>
);

const ConfigurationView = dynamic(
  () => import('@/modules/testConfig/views').then(m => m.ConfigurationView),
  { ssr: false, loading: sectionLoading },
);
const CreateTestView = dynamic(
  () => import('@/modules/testConfig/views').then(m => m.CreateTestView),
  { ssr: false, loading: sectionLoading },
);
const SectionFilesView = dynamic(
  () => import('@/modules/testConfig/views').then(m => m.SectionFilesView),
  { ssr: false, loading: sectionLoading },
);
const TestExecutionView = dynamic(
  () => import('@/modules/testExecution/views').then(m => m.TestExecutionView),
  { ssr: false, loading: sectionLoading },
);
const SystemsListView = dynamic(
  () => import('@/modules/systems/components/list').then(m => m.SystemsListView),
  { ssr: false, loading: sectionLoading },
);
const RemoteAPIInterface = dynamic(
  () => import('@/modules/remoteAPI').then(m => m.RemoteAPIInterface),
  { ssr: false, loading: sectionLoading },
);
const UserProfile = dynamic(
  () => import('@/modules/users/components/user-profile').then(m => m.UserProfile),
  { ssr: false, loading: sectionLoading },
);
const UserManagement = dynamic(
  () => import('@/modules/users/components/user-management').then(m => m.UserManagement),
  { ssr: false, loading: sectionLoading },
);
const SWManagementView = dynamic(
  () => import('@/modules/sw-management').then(m => m.SWManagementView),
  { ssr: false, loading: sectionLoading },
);
const EnbMonitoringDashboard = dynamic(
  () => import('@/modules/statLogs/components/enb').then(m => m.EnbMonitoringDashboard),
  { ssr: false, loading: sectionLoading },
);
const UeSimView = dynamic(
  () => import('@/modules/ueSim').then(m => m.UeSimView),
  { ssr: false, loading: sectionLoading },
);

interface DashboardContentProps {
  activeSection: string;
  themeConfig: any;
}

export const DashboardContent = ({
  activeSection,
  themeConfig
}: DashboardContentProps) => {
  const { user } = useUser();

  const renderContent = () => {
    switch (activeSection) {
      case 'systems':
        return <SystemsListView />;

      case 'sw-management':
        return <SWManagementView />;

      case 'test-configs':
        return (
          <ConfigProvider>
            <ConfigurationView />
          </ConfigProvider>
        );
    
      case 'create-test':
        return (
          <ConfigProvider>
            <CreateTestView />
          </ConfigProvider>
        );
        
      case 'test-sections':
        return (
          <ConfigProvider>
            <SectionFilesView />
          </ConfigProvider>
        );        
        
      case 'remote-api':
        return (
          <div className="space-y-6">
            <RemoteAPIInterface themeConfig={themeConfig} />
          </div>
        );

      case 'test-execution':
        return (
          <ConfigProvider>
            <TestExecutionView />
          </ConfigProvider>
        );

      // 'stats' is the canonical sidebar entry; 'monitoring' kept as an
      // alias for in-flight handoffs (Quick Run still dispatches the
      // legacy section name) and any saved deep links.
      case 'stats':
      case 'monitoring':
        return <EnbMonitoringDashboard />;

      case 'uesim':
        return <UeSimView />;

      case 'users':
        if (user?.role !== 'admin') return null;
        return <UserManagement />;

      case 'profile':
      case 'preferences':
        return <UserProfile />;
  
      default:
        return (
          <div className={`text-sm ${themeConfig.colors.muted}`}>
            Content for {activeSection} section will be displayed here.
          </div>
        );
    }
  };

  return (
    <div className="flex-1 min-w-0 p-6">
      {renderContent()}
    </div>
  );
};
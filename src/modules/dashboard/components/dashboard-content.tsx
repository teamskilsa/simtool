// modules/dashboard/components/dashboard-content.tsx
'use client';

import { ConfigProvider } from '@/modules/testConfig/context';
import { ConfigurationView, CreateTestView, SectionFilesView } from '@/modules/testConfig/views';
import { TestExecutionView } from '@/modules/testExecution/views';
import { SystemsListView } from '@/modules/systems/components/list';
import { RemoteAPIInterface } from '@/modules/remoteAPI';
import { UserProfile } from '@/modules/users/components/user-profile';
import { UserManagement } from '@/modules/users/components/user-management';
import { SWManagementView } from '@/modules/sw-management';
import { EnbMonitoringDashboard } from '@/modules/statLogs/components/enb';
import { useUser } from '@/modules/users/context/user-context';

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
    <div className="flex-1 p-6">
      {renderContent()}
    </div>
  );
};
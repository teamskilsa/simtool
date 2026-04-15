// src/app/dashboard/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/modules/auth/context/auth-context';
import { Loader2 } from 'lucide-react';
import { ConfigProvider as TestConfigProvider } from '@/modules/testConfig/context/ConfigProvider';
import { ConfigProvider as TestExecutionConfigProvider } from '@/modules/testExecution/context/ConfigContext/ConfigContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Force check auth state on mount
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      localStorage.clear(); // Clear all stored data
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <TestConfigProvider>
      <TestExecutionConfigProvider>
        {children}
      </TestExecutionConfigProvider>
    </TestConfigProvider>
  );
}
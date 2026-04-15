'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/modules/auth/context/auth-context';
import { Loader2 } from 'lucide-react';
import { EnbMonitoringDashboard } from '@/modules/statLogs/components/enb/EnbMonitoringDashboard';

export default function StatsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="container mx-auto p-6">
      <EnbMonitoringDashboard />
    </div>
  );
}
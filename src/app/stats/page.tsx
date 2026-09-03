'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/modules/auth/context/auth-context';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// recharts (used by the dashboard) touches `self` at module scope, which
// does not exist in Node — so statically importing it here made the
// production build fail while prerendering /stats. Loading it client-only
// keeps the library out of the server render entirely.
const EnbMonitoringDashboard = dynamic(
  () => import('@/modules/statLogs/components/enb/EnbMonitoringDashboard')
    .then(m => m.EnbMonitoringDashboard),
  { ssr: false },
);

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
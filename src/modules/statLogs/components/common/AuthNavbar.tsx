// File: src/modules/statLogs/components/common/AuthNavbar.tsx
import { Navbar } from '@/components/ui/navbar';
import { useAuth } from '@/modules/auth/context/auth-context';

export const AuthNavbar = ({ className }: { className?: string }) => {
  const { user, logout } = useAuth();

  return (
    <Navbar
      className={className}
      userEmail={user?.email}
      onLogout={logout}
    />
  );
};
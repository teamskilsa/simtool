// File: src/components/ui/navbar.tsx
import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, LogOut } from 'lucide-react';

interface NavbarProps {
  className?: string;
  userEmail?: string;
  onLogout?: () => void;
}

export const Navbar = ({ className = '', userEmail, onLogout }: NavbarProps) => {
  return (
    <nav className={`px-4 h-14 flex items-center justify-between ${className}`}>
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <Link href="/" className="font-semibold">
          Stats Monitor
        </Link>
      </div>

      <div className="flex items-center space-x-4">
        {userEmail && (
          <>
            <span className="text-sm hidden md:block">
              {userEmail}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </nav>
  );
};
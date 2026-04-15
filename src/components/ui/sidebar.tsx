// File: src/components/ui/sidebar.tsx
import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface SidebarLink {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
}

interface SidebarProps {
  className?: string;
  children?: React.ReactNode;
  links?: SidebarLink[];
  title?: string;
}

export const Sidebar = ({ 
  className = '', 
  children, 
  links = [], // Default empty array
  title = "Monitoring" // Default title
}: SidebarProps) => {
  return (
    <aside className={`border-r bg-background ${className}`}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold">{title}</h2>
          <nav className="space-y-1">
            {links?.map(({ href, label, icon: Icon, active }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center px-3 py-2 text-sm rounded-lg ${
                  active 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
        {children}
      </div>
    </aside>
  );
};
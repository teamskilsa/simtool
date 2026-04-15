// ConfigList/components/FilterDropdown.tsx
import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { ConfigItem } from '../../../types';

interface FilterDropdownProps {
  groups: Record<string, ConfigItem[]>;
  activeGroup: string | null;
  onGroupSelect: (group: string | null) => void;
}

export function FilterDropdown({ groups, activeGroup, onGroupSelect }: FilterDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Filter className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem 
          onClick={() => onGroupSelect(null)}
          className={activeGroup === null ? "bg-accent" : ""}
        >
          All Configurations
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {Object.keys(groups).map(group => (
          <DropdownMenuItem 
            key={group}
            onClick={() => onGroupSelect(group)}
            className={activeGroup === group ? "bg-accent" : ""}
          >
            {group}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
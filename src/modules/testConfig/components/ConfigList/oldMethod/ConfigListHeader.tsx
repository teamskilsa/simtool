import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { ChevronLeft, Copy, Filter, Trash2 } from 'lucide-react';

interface ConfigListHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCount: number;
  onCollapse: () => void;
  onBulkDuplicate: () => Promise<void>;
  onBulkDelete: () => void;
  showBulkActions: boolean;
  onFilterClick: () => void;
  groups: string[];
  activeGroup: string | null;
  onGroupSelect: (group: string | null) => void;
}

export const ConfigListHeader: React.FC<ConfigListHeaderProps> = ({
  searchTerm,
  onSearchChange,
  selectedCount,
  onCollapse,
  onBulkDuplicate,
  onBulkDelete,
  showBulkActions,
  onFilterClick,
  groups,
  activeGroup,
  onGroupSelect,
}) => {
  return (
    <div className="p-4 border-b">
      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="Search configurations..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onCollapse}
          className="px-2"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected
          </span>
        </div>

        <div className="flex items-center gap-1">
          {showBulkActions && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBulkDuplicate}
                className="h-8 px-2"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBulkDelete}
                className="h-8 px-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onGroupSelect(null)}>
                All Configurations
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {groups.map(group => (
                <DropdownMenuItem 
                  key={group}
                  onClick={() => onGroupSelect(group)}
                >
                  {group}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
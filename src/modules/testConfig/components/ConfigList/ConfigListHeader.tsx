import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, Copy, Trash2 } from 'lucide-react';

interface ConfigListHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onCollapse: () => void;
  selectedCount: number;
  isAllSelected: boolean;
  onSelectAll: (checked: boolean) => void;
  onBulkDuplicate: () => void;
  onBulkDelete: () => void;
  filterDropdown: React.ReactNode;
}

// Change function export to const export
export const ConfigListHeader: React.FC<ConfigListHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onCollapse,
  selectedCount,
  isAllSelected,
  onSelectAll,
  onBulkDuplicate,
  onBulkDelete,
  filterDropdown
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
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={onSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected
          </span>
        </div>

        <div className="flex items-center gap-1">
          {selectedCount > 0 && (
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
          {filterDropdown}
        </div>
      </div>
    </div>
  );
}
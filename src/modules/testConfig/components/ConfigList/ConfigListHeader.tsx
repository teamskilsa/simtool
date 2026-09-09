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
    // One row, not two. The select-all checkbox, search, filter and collapse
    // all belong to the same job, and "0 selected" is not worth a line of its
    // own — the count appears only once something is selected.
    <div className="flex items-center gap-2 px-3 py-2 border-b">
      <Checkbox
        checked={isAllSelected}
        onCheckedChange={onSelectAll}
        title="Select all"
      />

      <Input
        placeholder="Search configurations..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 flex-1 min-w-0"
      />

      {selectedCount > 0 && (
        <>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {selectedCount} selected
          </span>
          <Button variant="ghost" size="sm" onClick={onBulkDuplicate} className="h-8 px-2" title="Duplicate selected">
            <Copy className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onBulkDelete} className="h-8 px-2 text-red-600 hover:text-red-700" title="Delete selected">
            <Trash2 className="w-4 h-4" />
          </Button>
        </>
      )}

      {filterDropdown}

      <Button variant="ghost" size="sm" onClick={onCollapse} className="h-8 px-2" title="Collapse list">
        <ChevronLeft className="w-4 h-4" />
      </Button>
    </div>
  );
}
// components/BulkActionMenu.tsx
import React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash, Copy, FolderPlus } from 'lucide-react';

export const BulkActionMenu: React.FC<{
  selectedIds: Set<string>;
  onDelete: (ids: string[]) => void;
  onDuplicate: (ids: string[]) => void;
  onMove: (ids: string[], targetGroupId: string) => void;
}> = ({ selectedIds, onDelete, onDuplicate, onMove }) => {
  if (selectedIds.size === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Actions ({selectedIds.size})
          <MoreHorizontal className="w-4 h-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onDuplicate(Array.from(selectedIds))}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(Array.from(selectedIds))}>
          <Trash className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FolderPlus className="w-4 h-4 mr-2" />
          Move to...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Update store.ts to handle bulk actions
interface GroupState {
  // ... existing state
  selectedIds: Set<string>;
  
  // Add bulk action methods
  bulkDelete: (ids: string[]) => Promise<void>;
  bulkDuplicate: (ids: string[]) => Promise<void>;
  bulkMove: (ids: string[], targetGroupId: string) => Promise<void>;
}
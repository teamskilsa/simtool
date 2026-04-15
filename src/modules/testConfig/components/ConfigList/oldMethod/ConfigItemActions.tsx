import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, FolderPlus, MoreVertical, Pencil, Trash2 } from 'lucide-react';

interface ConfigItemActionsProps {
  onDuplicate: () => Promise<void>;
  onDelete: () => void;
  onRename: () => void;
  onAddToGroup: () => void;
}

export const ConfigItemActions: React.FC<ConfigItemActionsProps> = ({
  onDuplicate,
  onDelete,
  onRename,
  onAddToGroup,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => e.stopPropagation()}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="w-4 h-4 mr-2" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddToGroup}>
          <FolderPlus className="w-4 h-4 mr-2" />
          Add to Group
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-red-600"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
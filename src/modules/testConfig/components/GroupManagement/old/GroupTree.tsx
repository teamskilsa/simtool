import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Group } from '../../types/group.types';
import { cn } from '@/lib/utils';

interface GroupTreeProps {
  groups: Group[];
  onDelete: (groupId: string) => void;
  onRename: (groupId: string, newName: string) => void;
  onMove: (groupId: string, newParentId: string) => void;
  onSelectParent: (groupId: string | null) => void;
  selectedParentId: string | null;
}

export const GroupTree: React.FC<GroupTreeProps> = ({
  groups,
  onDelete,
  onRename,
  onMove,
  onSelectParent,
  selectedParentId,
}) => {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const renderGroup = (group: Group, level: number = 0) => {
    const isEditing = editingGroupId === group.id;
    const isSelected = selectedParentId === group.id;

    return (
      <div key={group.id} className="space-y-2">
        <div 
          className={cn(
            "flex items-center gap-2 p-2 rounded-md",
            "transition-colors duration-200",
            isSelected && "bg-primary/10",
            !isSelected && "hover:bg-accent"
          )}
          style={{ marginLeft: `${level * 1.5}rem` }}
          onClick={() => onSelectParent(isSelected ? null : group.id)}
        >
          {group.subgroups.length > 0 && (
            <ChevronRight className="w-4 h-4" />
          )}
          
          {isEditing ? (
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editingName.trim()) {
                  onRename(group.id, editingName.trim());
                  setEditingGroupId(null);
                }
              }}
              onBlur={() => {
                if (editingName.trim()) {
                  onRename(group.id, editingName.trim());
                }
                setEditingGroupId(null);
              }}
              className="h-7 w-48"
              autoFocus
            />
          ) : (
            <span className="text-sm font-medium">{group.name}</span>
          )}
          
          <div className="flex-1" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                setEditingGroupId(group.id);
                setEditingName(group.name);
              }}>
                <Pencil className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(group.id);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {group.subgroups.map(subgroup => 
          renderGroup(subgroup, level + 1)
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {groups.map(group => renderGroup(group))}
      {groups.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No groups created yet
        </p>
      )}
    </div>
  );
};
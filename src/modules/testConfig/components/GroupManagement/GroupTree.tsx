import React, { useCallback } from 'react';
import { Group } from '../../types/group.types';
import { Button } from '@/components/ui/button';
import { ChevronRight, FolderClosed, FolderOpen } from 'lucide-react';
import { useGroupStore } from '../../store/groupStore';
import { cn } from '@/lib/utils';

interface GroupTreeProps {
  groups: Group[];
  selectedGroupId: string | null;
}

export const GroupTree = React.memo(({ groups, selectedGroupId }) => {
  const setSelectedGroup = useGroupStore(state => state.setSelectedGroup);

  const handleSelect = useCallback((id: string) => {
    setSelectedGroup(id);
  }, [setSelectedGroup]);

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No groups created yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map(group => (
        <Button
          key={group.id}
          variant="ghost"
          className={cn(
            "w-full justify-start",
            selectedGroupId === group.id && "bg-accent text-accent-foreground"
          )}
          onClick={() => handleSelect(group.id)}
        >
          <ChevronRight className="h-4 w-4 mr-2" />
          {selectedGroupId === group.id ? (
            <FolderOpen className="h-4 w-4 mr-2" />
          ) : (
            <FolderClosed className="h-4 w-4 mr-2" />
          )}
          {group.name}
        </Button>
      ))}
    </div>
  );
});

GroupTree.displayName = 'GroupTree';
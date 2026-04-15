// GroupManagementContent.tsx
import React from 'react';
import { styles } from './styles';
import { GroupTree } from './GroupTree';
import { GroupDetails } from './GroupDetails';
import { useGroupStore } from '../../store/groupStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Group } from '../../types/group.types';
import { useAuth } from '@/modules/auth/context/auth-context';
import { cn } from '@/lib/utils';
export const GroupManagementContent: React.FC = () => {
  const { groups, selectedGroupId, setSelectedGroup, updateGroup, deleteGroup } = useGroupStore();
  const { user } = useAuth();

  const handleGroupUpdate = async (group: Group) => {
    if (!user?.id) return;
    await updateGroup(group, user.id);
  };

  const handleGroupDelete = async (groupId: string) => {
    if (!user?.id) return;
    await deleteGroup(groupId, user.id);
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
<div className={cn(
  "flex-1 min-h-0",
  "grid grid-cols-[300px_1fr]",
  "divide-x divide-border/50"
)}>
  <div className="p-4 overflow-auto">
    <GroupTree
      groups={groups}
      selectedGroupId={selectedGroupId}
    />
  </div>

  <div className="p-6 overflow-auto">
    <GroupDetails
      group={selectedGroup || null}
      onUpdate={handleGroupUpdate}
      onDelete={handleGroupDelete}
    />
  </div>
</div>
  );
};
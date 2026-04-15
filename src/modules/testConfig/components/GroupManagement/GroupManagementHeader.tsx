import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { styles } from './styles';
import { useGroupStore } from '../../store/groupStore';
import { cn } from '@/lib/utils';
import { CreateGroupDialog } from './CreateGroupDialog';

interface GroupManagementHeaderProps {
  userId: string;
}

export const GroupManagementHeader: React.FC<GroupManagementHeaderProps> = ({ userId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { createGroup, loadGroups } = useGroupStore();

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleCreateGroup = async (name: string) => {
    try {
      setIsCreating(true);
      
      const success = await createGroup(name, userId);
      if (success) {
        await loadGroups(userId);
      }
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setIsCreating(false);
      setIsDialogOpen(false);
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-4", // Removed extra padding and border
    )}>
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search groups..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <Button 
        onClick={() => setIsDialogOpen(true)}
        className="flex items-center gap-2"
        disabled={isCreating}
      >
        <Plus className="h-4 w-4" />
        Create Group
      </Button>

      <CreateGroupDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  );
};
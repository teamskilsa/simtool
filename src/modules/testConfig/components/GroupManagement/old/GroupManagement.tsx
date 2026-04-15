import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/modules/auth/context/auth-context';  // Add this
import { Group } from '../../types/group.types';

interface GroupManagementProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  onCreateGroup: (name: string, userId: string, parentId?: string) => void;  // Updated signature
  onDeleteGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string, newName: string) => void;
  onMoveGroup: (groupId: string, newParentId: string) => void;
}

export const GroupManagement: React.FC<GroupManagementProps> = ({
  isOpen,
  onClose,
  groups,
  onCreateGroup,
  onDeleteGroup,
  onRenameGroup,
  onMoveGroup,
}) => {
  const { user } = useAuth();
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  const handleCreateGroup = () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create a group",
        variant: "destructive"
      });
      return;
    }

    if (!newGroupName.trim()) {
      toast({
        title: "Error",
        description: "Group name cannot be empty",
        variant: "destructive"
      });
      return;
    }

    try {
      onCreateGroup(newGroupName.trim(), user.id, selectedParentId || undefined);
      setNewGroupName('');
      setSelectedParentId(null);
      
      toast({
        title: "Success",
        description: "Group created successfully",
        variant: "default"
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Enter group name"
            />
          </div>
          
          {groups.length > 0 && (
            <div className="grid gap-2">
              <Label>Parent Group (Optional)</Label>
              <Select
                value={selectedParentId || undefined}
                onValueChange={(value) => setSelectedParentId(value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a parent group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreateGroup}>
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
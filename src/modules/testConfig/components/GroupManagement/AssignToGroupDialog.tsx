import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useGroupStore } from '../../store/groupStore';
import { cn } from '@/lib/utils';

interface AssignToGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  configId: string;
  userId: string;
}

export const AssignToGroupDialog: React.FC<AssignToGroupDialogProps> = ({ 
  isOpen, 
  onClose,
  configId,
  userId
}) => {
  const { groups, loadGroups, addConfigToGroup } = useGroupStore();
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  // Load groups when dialog opens
  useEffect(() => {
    if (isOpen && userId) {
      loadGroups(userId);
    }
  }, [isOpen, userId, loadGroups]);

  const handleAssign = async () => {
    if (!selectedGroupId) return;
    
    try {
      setIsLoading(true);
      await addConfigToGroup(configId, selectedGroupId, userId);
      toast({
        title: "Success",
        description: "Configuration added to group"
      });
      onClose();
    } catch (error) {
      console.error('Failed to add to group:', error);
      toast({
        title: "Error",
        description: "Failed to add configuration to group",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to Group</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {groups?.length > 0 ? (
              groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-colors",
                    selectedGroupId === group.id
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="font-medium">{group.name}</div>
                  {group.description && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {group.description}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No groups available. Create a group first.
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!selectedGroupId || isLoading}
          >
            Add to Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
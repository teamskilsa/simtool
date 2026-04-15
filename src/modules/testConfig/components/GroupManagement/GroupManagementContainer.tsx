import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GroupTree } from './GroupTree';
import { GroupDetails } from './GroupDetails';
import { CreateGroupDialog } from './CreateGroupDialog';
import { useGroupStore } from '../../store/groupStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/auth/context/auth-context';
import { toast } from '@/components/ui/use-toast';

interface GroupManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GroupManagementContainer: React.FC<GroupManagementProps> = ({
  isOpen,
  onClose,
}) => {
  const { 
    groups, 
    selectedGroupId, 
    loadGroups, 
    loadConfigs, 
    createGroup,
    isLoading
  } = useGroupStore();

  const { user } = useAuth();
  const userId = user?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Initialize data when dialog opens
  useEffect(() => {
    if (isOpen && userId) {
      loadGroups(userId);
      loadConfigs(userId);
    }
  }, [isOpen, userId, loadGroups, loadConfigs]);

  // Filter groups based on search term
  const filteredGroups = React.useMemo(() => {
    return groups.filter(group => 
      group.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groups, searchTerm]);

  const handleCreateGroup = async (name: string) => {
    if (!userId) return;

    try {
      const success = await createGroup(name, userId);
      if (success) {
        setIsCreateDialogOpen(false);
        await loadGroups(userId);
        toast({
          title: "Success",
          description: "Group created successfully"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive"
      });
    }
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-[95vw] min-w-[1200px] w-[1600px]",
        "h-[95vh]",
        "fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]",
        "bg-background dark:bg-gray-900",
        "border border-border/10",
        "shadow-lg",
        "rounded-xl overflow-hidden p-0",
        "bg-gradient-to-b from-blue-50/50 to-indigo-50/50", // Added gradient background
        "dark:from-blue-950/10 dark:to-indigo-950/10"       // Dark mode gradient
      )}>
        <div className="flex flex-col h-full">
          <DialogHeader className={cn(
            "px-8 py-4",
            "border-b border-border/10",
            "bg-gradient-to-r from-white/80 to-blue-50/80",  // Header gradient
            "dark:from-gray-900/80 dark:to-blue-900/80"
          )}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileJson className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-bold">
                  Manage Groups
                </h2>
                <p className="text-sm text-muted-foreground">
                  Create and manage your configuration groups
                </p>
              </div>
            </div>
          </DialogHeader>
  
          <div className={cn(
          "px-8 py-4 border-b border-border/10",
          "bg-gradient-to-r from-white/50 to-blue-50/50",
          "dark:from-gray-900/50 dark:to-blue-900/50"
        )}>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search groups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "pl-9",
                  "bg-white/80 dark:bg-gray-950/80",
                  "backdrop-blur-sm",
                  "border-blue-100 dark:border-blue-900",
                  "focus:border-blue-200 dark:focus:border-blue-800",
                  "focus:ring-2 focus:ring-blue-500/20"
                )}
              />
            </div>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={isLoading} // Changed from isCreating to isLoading
              className={cn(
                "bg-gradient-to-r from-blue-500 to-indigo-500",
                "hover:from-blue-600 hover:to-indigo-600",
                "text-white",
                "border-0",
                "shadow-lg shadow-blue-500/25",
                "transition-all duration-300"
              )}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </div>
        </div>
  
          <div className="flex flex-1 min-h-0">
            <div className={cn(
              "w-96 flex-none",
              "border-r border-border/10",
              "bg-white/50 dark:bg-gray-900/50",  // Sidebar gradient
              "backdrop-blur-sm",
              "overflow-hidden"
            )}>
              <ScrollArea className="h-full">
                <div className="p-6">
                  <GroupTree 
                    groups={groups.filter(group => 
                      group.name.toLowerCase().includes(searchTerm.toLowerCase())
                    )} 
                    selectedGroupId={selectedGroupId} 
                  />
                </div>
              </ScrollArea>
            </div>
  
            <div className={cn(
              "flex-1 overflow-hidden",
              "bg-gradient-to-br from-white/30 to-blue-50/30",  // Content area gradient
              "dark:from-gray-900/30 dark:to-blue-900/30",
              "backdrop-blur-sm"
            )}>
              <ScrollArea className="h-full">
                <div className="p-8">
                  <GroupDetails group={selectedGroup} />
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
  
        {isCreateDialogOpen && (
        <CreateGroupDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onCreateGroup={handleCreateGroup}
        />
      )}
    </DialogContent>
  </Dialog>
  );
};
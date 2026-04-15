// CreateGroupDialog.tsx
import React, { useState } from 'react';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (name: string) => Promise<void>;
}

export const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
}) => {
  const [groupName, setGroupName] = useState('');

  const handleSubmit = async () => {
    if (groupName.trim()) {
      await onCreateGroup(groupName.trim());
      setGroupName('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <DialogContent className={cn(
      "fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]",
      "w-[400px] rounded-xl",
      "bg-background/80 dark:bg-gray-900/80",
      "backdrop-blur-md",
      "border border-border/10",
      "shadow-xl shadow-blue-500/5",
      "p-0"
    )}>
      <DialogHeader className="px-6 py-4 border-b border-border/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <FolderPlus className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <DialogTitle className="text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-bold">
              Create New Group
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Create a group to organize your configurations
            </p>
          </div>
        </div>
      </DialogHeader>

      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Name</Label>
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter group name"
            className={cn(
              "bg-background/50 dark:bg-gray-950/50",
              "border border-border/50",
              "focus:ring-2 focus:ring-blue-500/20"
            )}
          />
        </div>
      </div>

      <DialogFooter className={cn(
        "px-6 py-4",
        "border-t border-border/10",
        "bg-muted/20"
      )}>
        <div className="flex items-center justify-end gap-3 w-full">
          <Button 
            variant="outline" 
            onClick={onClose}
            className={cn(
              "border-border/50",
              "hover:bg-background/80"
            )}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!groupName.trim()}
            className={cn(
              "bg-gradient-to-r from-blue-500 to-indigo-500",
              "hover:from-blue-600 hover:to-indigo-600",
              "text-white",
              "border-0",
              "shadow-lg shadow-blue-500/25",
              "transition-all duration-300",
              "hover:scale-105",
              "active:scale-95",
              "disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
            )}
          >
            Create Group
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
};
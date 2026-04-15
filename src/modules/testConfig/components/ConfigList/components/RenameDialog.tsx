// ConfigList/components/RenameDialog.tsx
import React from 'react';
import { ConfigItem } from '../../../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { handleRename } from '../../../actions/configListActions';

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  configId: string | null;
  value: string;
  onChange: (value: string) => void;
  configs: ConfigItem[];
  onConfigsChange: (configs: ConfigItem[]) => void;
  userId: string;
  loadConfigs: () => Promise<void>;
}

export function RenameDialog({
  isOpen,
  onClose,
  configId,
  value,
  onChange,
  configs,
  onConfigsChange,
  userId,
  loadConfigs,
}: RenameDialogProps) {
  const handleSubmit = () => {
    if (configId && value.trim()) {
      handleRename(
        configId,
        value.trim(),
        configs,
        onConfigsChange,
        userId,
        loadConfigs
      );
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Configuration</DialogTitle>
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter new name"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
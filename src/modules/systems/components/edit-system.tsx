// modules/systems/components/edit-system.tsx
import { useState, useEffect } from 'react';
import { FormDialog } from '@/components/dialogs/templates/FormDialog';
import { useDialog } from '@/components/dialogs/hooks/use-dialog';
import { toast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { System } from '../types';

interface EditSystemDialogProps {
  system: System;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (systemId: number, updates: Partial<System>) => Promise<void>;
}

export function EditSystemDialog({ 
  system, 
  open, 
  onOpenChange, 
  onSubmit 
}: EditSystemDialogProps) {
  const dialog = useDialog();
  const [formData, setFormData] = useState({
    type: system.type,
    name: system.name,
    ip: system.ip
  });

  useEffect(() => {
    setFormData({
      type: system.type,
      name: system.name,
      ip: system.ip
    });
  }, [system]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await onSubmit(system.id, formData);
      onOpenChange(false);
      toast({
        title: "Success",
        description: "System has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update system',
        variant: "destructive",
      });
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit System"
      error={dialog.error}
      loading={dialog.loading}
      onSubmit={handleSubmit}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>System Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select system type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Callbox">Callbox</SelectItem>
              <SelectItem value="UESim">UE Simulator</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>System Name</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter system name"
          />
        </div>

        <div className="space-y-2">
          <Label>IP Address</Label>
          <Input
            value={formData.ip}
            onChange={(e) => setFormData(prev => ({ ...prev, ip: e.target.value }))}
            placeholder="192.168.1.100"
          />
        </div>
      </div>
    </FormDialog>
  );
}
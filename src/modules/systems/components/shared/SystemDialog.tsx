// modules/systems/components/shared/SystemDialog.tsx
import { useState, useEffect } from 'react';
import { FormDialog } from '@/components/dialogs/templates/FormDialog';
import { SystemForm } from './SystemForm';
import { useDialog } from '@/components/dialogs/hooks/use-dialog';
import { toast } from '@/components/ui/use-toast';
import type { System } from '../../types';

interface SystemDialogProps {
  mode: 'add' | 'edit';
  system?: System | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (mode: 'add' | 'edit', systemId: number | undefined, data: Partial<System>) => Promise<void>;
}

const initialFormState = {
  type: '',
  name: '',
  ip: '',
  username: '',
  password: '',
};

export function SystemDialog({ 
  mode,
  system, 
  open, 
  onOpenChange, 
  onSubmit 
}: SystemDialogProps) {
  const dialog = useDialog();
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (mode === 'edit' && system) {
      setFormData({
        type: system.type,
        name: system.name,
        ip: system.ip,
        username: system.username || '',
        password: system.password || '',
      });
    } else {
      setFormData(initialFormState);
    }
  }, [mode, system]);

  const validateForm = () => {
    if (!formData.type) {
      throw new Error('Please select a system type');
    }
    if (!formData.name.trim()) {
      throw new Error('Please enter a system name');
    }
    if (!formData.ip.trim()) {
      throw new Error('Please enter an IP address');
    }
    
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(formData.ip)) {
      throw new Error('Please enter a valid IP address');
    }

    const ipParts = formData.ip.split('.').map(Number);
    if (ipParts.some(part => part < 0 || part > 255)) {
      throw new Error('IP address numbers must be between 0 and 255');
    }

    if (!formData.username.trim()) {
      throw new Error('Please enter SSH username');
    }
    if (!formData.password.trim()) {
      throw new Error('Please enter SSH password');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await dialog.handleSubmit(async () => {
      try {
        validateForm();
        await onSubmit(mode, system?.id, formData);
        
        toast({
          title: "Success",
          description: `System has been ${mode === 'add' ? 'added' : 'updated'} successfully.`,
        });

        if (mode === 'add') {
          setFormData(initialFormState);
        }
        
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : `Failed to ${mode} system`,
          variant: "destructive",
        });
        throw error;
      }
    });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          setFormData(initialFormState);
        }
        onOpenChange(open);
      }}
      title={mode === 'add' ? "Add New System" : "Edit System"}
      error={dialog.error}
      loading={dialog.loading}
      onSubmit={handleSubmit}
    >
      <SystemForm
        data={formData}
        onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
      />
    </FormDialog>
  );
}

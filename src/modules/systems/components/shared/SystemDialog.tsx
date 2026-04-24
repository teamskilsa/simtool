// modules/systems/components/shared/SystemDialog.tsx
import { useState, useEffect } from 'react';
import { FormDialog } from '@/components/dialogs/templates/FormDialog';
import { SystemForm } from './SystemForm';
import { useDialog } from '@/components/dialogs/hooks/use-dialog';
import { toast } from '@/components/ui/use-toast';
import type { System } from '../../types';
import { provisionSystem, type ProvisionResult } from '../../services/provision';

interface SystemDialogProps {
  mode: 'add' | 'edit';
  system?: System | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (mode: 'add' | 'edit', systemId: number | undefined, data: Partial<System>) => Promise<System | void>;
  /** Called after provisioning completes (success or failure). Receives the saved system id and the result. */
  onProvisionComplete?: (systemId: number, result: ProvisionResult) => void;
}

type FormState = {
  type: string;
  name: string;
  ip: string;
  username: string;
  password: string;
  authMode: 'password' | 'privateKey';
  privateKey: string;
};

const initialFormState: FormState = {
  type: '',
  name: '',
  ip: '',
  username: '',
  password: '',
  authMode: 'password',
  privateKey: '',
};

export function SystemDialog({ mode, system, open, onOpenChange, onSubmit, onProvisionComplete }: SystemDialogProps) {
  const dialog = useDialog();
  const [formData, setFormData] = useState<FormState>(initialFormState);

  useEffect(() => {
    if (mode === 'edit' && system) {
      setFormData({
        type: system.type,
        name: system.name,
        ip: system.ip,
        username: system.username || '',
        password: system.password || '',
        authMode: system.authMode || 'password',
        privateKey: system.privateKey || '',
      });
    } else {
      setFormData(initialFormState);
    }
  }, [mode, system]);

  const validateForm = () => {
    if (!formData.type) throw new Error('Please select a system type');
    if (!formData.name.trim()) throw new Error('Please enter a system name');
    if (!formData.ip.trim()) throw new Error('Please enter an IP address');

    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(formData.ip)) throw new Error('Please enter a valid IP address');

    const ipParts = formData.ip.split('.').map(Number);
    if (ipParts.some((p) => p < 0 || p > 255)) throw new Error('IP address numbers must be between 0 and 255');

    if (!formData.username.trim()) throw new Error('Please enter SSH username');
    if (formData.authMode === 'password' && !formData.password.trim()) {
      throw new Error('Please enter SSH password');
    }
    if (formData.authMode === 'privateKey' && !formData.privateKey.trim()) {
      throw new Error('Please paste the private key');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await dialog.handleSubmit(async () => {
      try {
        validateForm();

        // Save the system immediately (with provisionStatus='provisioning' for add mode).
        // This way, if provisioning fails, the system is still saved and the user can retry later.
        const dataToSave: Partial<System> = mode === 'add'
          ? { ...formData, provisionStatus: 'provisioning' }
          : formData;

        const saved = await onSubmit(mode, system?.id, dataToSave);

        if (mode === 'add') setFormData(initialFormState);

        // Close dialog immediately — provisioning runs in the background.
        onOpenChange(false);

        // For add mode, kick off async provisioning. For edit, nothing to do.
        if (mode === 'add') {
          const savedSystem = (saved as System) || ({ ...formData, id: Date.now() } as unknown as System);
          toast({
            title: 'System Added',
            description: `Provisioning ${savedSystem.name || formData.name} in the background…`,
          });

          // Fire-and-forget provisioning
          void (async () => {
            const result = await provisionSystem(savedSystem);
            if (onProvisionComplete && savedSystem.id) {
              onProvisionComplete(savedSystem.id, result);
            }
            toast({
              title: result.success ? 'Provisioning Successful' : 'Provisioning Failed',
              description: result.success
                ? `${savedSystem.name} is ready.`
                : `${savedSystem.name}: ${(result.error || 'unknown error').split('\n')[0]}. You can retry from the systems list.`,
              variant: result.success ? 'default' : 'destructive',
            });
          })();
        } else {
          toast({
            title: 'Success',
            description: 'System has been updated successfully.',
          });
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : `Failed to ${mode} system`,
          variant: 'destructive',
        });
        throw error;
      }
    });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) setFormData(initialFormState);
        onOpenChange(open);
      }}
      title={mode === 'add' ? 'Add New System' : 'Edit System'}
      error={dialog.error}
      loading={dialog.loading}
      onSubmit={handleSubmit}
    >
      <SystemForm
        data={formData}
        onChange={(field, value) => setFormData((prev) => ({ ...prev, [field]: value }))}
      />
    </FormDialog>
  );
}

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

export function SystemDialog({ mode, system, open, onOpenChange, onSubmit }: SystemDialogProps) {
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

  const provisionSystem = async () => {
    const credentials = {
      host: formData.ip,
      username: formData.username,
      ...(formData.authMode === 'password'
        ? { password: formData.password }
        : { privateKey: formData.privateKey }),
    };

    // Step 1: ping (TCP probe to SSH port)
    toast({ title: 'Provisioning', description: 'Checking connectivity…' });
    const pingRes = await fetch('/api/systems/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: formData.ip, port: 22 }),
    }).then((r) => r.json());
    if (!pingRes.reachable) throw new Error(`Host ${formData.ip}:22 is not reachable`);

    // Step 2: ssh-test
    toast({ title: 'Provisioning', description: 'Verifying SSH credentials…' });
    const sshRes = await fetch('/api/systems/ssh-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    }).then((r) => r.json());
    if (!sshRes.success) throw new Error(`SSH login failed: ${sshRes.error || 'unknown error'}`);

    // Step 3: deploy agent
    toast({ title: 'Provisioning', description: 'Deploying agent to target…' });
    const deployRes = await fetch('/api/systems/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    }).then((r) => r.json());
    if (!deployRes.success) {
      const failed = (deployRes.steps || []).find((s: any) => !s.ok);
      throw new Error(
        deployRes.error ||
          (failed ? `Deploy failed at step "${failed.name}": ${failed.detail || ''}` : 'Deploy failed'),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await dialog.handleSubmit(async () => {
      try {
        validateForm();

        if (mode === 'add') {
          await provisionSystem();
        }

        await onSubmit(mode, system?.id, formData);

        toast({
          title: 'Success',
          description: `System has been ${mode === 'add' ? 'added and provisioned' : 'updated'} successfully.`,
        });

        if (mode === 'add') setFormData(initialFormState);
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

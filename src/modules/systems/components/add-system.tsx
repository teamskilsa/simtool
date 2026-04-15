// modules/systems/components/add-system.tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { SystemDialog } from './shared/SystemDialog';
import { useTheme } from '@/components/theme/context/theme-context';
import type { System } from '../types';

interface AddSystemProps {
  onAddSystem: (system: Partial<System>) => Promise<void>;
}

export function AddSystem({ onAddSystem }: AddSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();

  const handleSubmit = async (_mode: 'add' | 'edit', _: number | undefined, data: Partial<System>) => {
    try {
      await onAddSystem(data);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to add system:', error);
      throw error;
    }
  };

  const getButtonClass = () => {
    switch (theme) {
      case 'teal': return 'bg-teal-600 hover:bg-teal-700';
      case 'rose': return 'bg-rose-600 hover:bg-rose-700';
      case 'light': return 'bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900';
      default: return 'bg-indigo-600 hover:bg-indigo-700';
    }
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className={`${getButtonClass()} text-white`}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add System
      </Button>

      <SystemDialog
        mode="add"
        open={isOpen}
        onOpenChange={setIsOpen}
        onSubmit={handleSubmit}
      />
    </>
  );
}
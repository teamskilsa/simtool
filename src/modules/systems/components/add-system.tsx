// modules/systems/components/add-system.tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { SystemDialog } from './shared/SystemDialog';
import { useTheme } from '@/components/theme/context/theme-context';
import { THEME_CHROME_BG } from '@/components/theme/utils/theme-chrome';
import type { System } from '../types';
import type { ProvisionResult } from '../services/provision';

interface AddSystemProps {
  onAddSystem: (system: Partial<System>) => Promise<System | void>;
  onProvisionComplete?: (systemId: number, result: ProvisionResult) => void;
}

export function AddSystem({ onAddSystem, onProvisionComplete }: AddSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const btnBg = THEME_CHROME_BG[theme] ?? 'bg-indigo-600';

  const handleSubmit = async (_mode: 'add' | 'edit', _: number | undefined, data: Partial<System>) => {
    return await onAddSystem(data);
  };

  return (
    <>
      <Button
        id="add-system-trigger"
        onClick={() => setIsOpen(true)}
        className={`${btnBg} text-white hover:opacity-90 gap-2 focus-visible:ring-2 focus-visible:ring-ring`}
      >
        <Plus className="w-4 h-4" />
        Add System
      </Button>

      <SystemDialog
        mode="add"
        open={isOpen}
        onOpenChange={setIsOpen}
        onSubmit={handleSubmit}
        onProvisionComplete={onProvisionComplete}
      />
    </>
  );
}

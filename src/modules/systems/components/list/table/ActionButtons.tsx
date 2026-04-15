// modules/systems/components/list/table/ActionButtons.tsx
import { useState } from 'react';
import { Terminal, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DebugConnectionButton } from '../../../debug/DebugConnectionButton';
import { useSystemConnection } from '../../../hooks/use-system-connection';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../../../types';

interface ActionButtonsProps {
  system: System;
  connection?: {
    sshOk?: boolean;
  };
  onRefresh: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
  onConnectionUpdate: (status: {
    pingOk: boolean;
    sshOk: boolean;
    lastError?: string;
  }) => void;
  onOpenSSH: () => void;
}

export function ActionButtons({
  system,
  connection,
  onRefresh,
  onEdit,
  onDelete,
  onConnectionUpdate,
  onOpenSSH
}: ActionButtonsProps) {
  const [refreshing, setRefreshing] = useState(false);
  const { testSystemReachability, testSSHConnection } = useSystemConnection();

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // First call onRefresh to update parent state
      await onRefresh();
      
      // Then update connection status
      const pingOk = await testSystemReachability(system.ip);
      if (pingOk) {
        const sshOk = await testSSHConnection(system);
        onConnectionUpdate({
          pingOk,
          sshOk,
          lastError: sshOk ? undefined : 'SSH connection failed'
        });
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex justify-end items-center gap-2">
        <DebugConnectionButton 
          system={system}
          onConnectionUpdate={onConnectionUpdate}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh system status</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit system</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete system</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSSH}
              disabled={!connection?.sshOk}
            >
              <Terminal className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {connection?.sshOk ? 'Open SSH Terminal' : 'SSH connection not available'}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
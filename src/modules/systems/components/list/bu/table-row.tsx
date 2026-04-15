// modules/systems/components/list/table-row.tsx
import { useState } from 'react';
import { 
  Radio, 
  Smartphone, 
  Terminal, 
  RefreshCw, 
  Trash2, 
  Pencil,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SSHTerminalDialog } from '../ssh/ssh-terminal-dialog';
import { DebugConnectionButton } from '../../debug/DebugConnectionButton';
import { SystemConnectionStatus, SystemStatusBadge } from './SystemConnectionStatus';
import { useSystemConnection } from '../../hooks/use-system-connection';
import type { System } from '../../types';

interface SystemTableRowProps {
  system: System;
  connection?: {
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    lastError?: string;
    pingOk?: boolean;
    sshOk?: boolean;
  };
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onConnectionUpdate?: (status: {
    pingOk: boolean;
    sshOk: boolean;
    lastError?: string;
  }) => void;
}

export function SystemTableRow({
  system,
  connection,
  onRefresh,
  onEdit,
  onDelete,
  onConnectionUpdate
}: SystemTableRowProps) {
  const [sshDialogOpen, setSSHDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { testSystemReachability, testSSHConnection } = useSystemConnection();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('Refreshing system:', system);
      
      // Test basic connectivity
      const pingOk = await testSystemReachability(system.ip);
      console.log('Reachability test result:', pingOk);
      
      // Test SSH if ping successful
      let sshOk = false;
      if (pingOk) {
        sshOk = await testSSHConnection(system);
        console.log('SSH test result:', sshOk);
      }

      // Update connection status through callback
      if (onConnectionUpdate) {
        onConnectionUpdate({
          pingOk,
          sshOk,
          lastError: !pingOk ? 'System not reachable' : 
                    !sshOk ? 'SSH connection failed' : undefined
        });
      }

      // Call the parent's refresh handler
      onRefresh();
      
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderSystemInfo = () => (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-gray-100 rounded-lg">
        {system.type === 'Callbox' ? (
          <Radio className="w-4 h-4 text-indigo-600" />
        ) : (
          <Smartphone className="w-4 h-4 text-indigo-600" />
        )}
      </div>
      <div>
        <div className="font-medium text-gray-900">{system.name}</div>
        <div className="text-sm text-gray-500">{system.ip}</div>
      </div>
    </div>
  );

  const renderActions = () => (
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit system</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
            >
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
              onClick={() => connection?.sshOk && setSSHDialogOpen(true)}
              disabled={!connection?.sshOk}
            >
              <Terminal className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {connection?.sshOk 
              ? 'Open SSH Terminal' 
              : 'SSH connection not available'}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );

  return (
    <tr className="border-t border-gray-200">
      <td className="px-4 py-4">
        {renderSystemInfo()}
      </td>
      <td className="px-4 py-4">
        <SystemConnectionStatus connection={connection} />
      </td>
      <td className="px-4 py-4">
        <SystemStatusBadge connection={connection} />
      </td>
      <td className="px-4 py-4">
        {/* Resources column content */}
      </td>
      <td className="px-4 py-4">
        <div className="text-sm text-gray-500">
          {system.type === 'Callbox' ? 'Callbox Configuration' : 'UE Simulator Configuration'}
        </div>
      </td>
      <td className="px-4 py-4 text-right">
        {renderActions()}
      </td>

      <SSHTerminalDialog
        system={system}
        open={sshDialogOpen}
        onOpenChange={setSSHDialogOpen}
      />
    </tr>
  );
}
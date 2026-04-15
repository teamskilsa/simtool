// modules/systems/components/list/table/SystemTableRow.tsx
import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { SystemInfo } from './SystemInfo';
import { ActionButtons } from './ActionButtons';
import { SystemConnectionStatus } from './SystemConnectionStatus';
import { SystemStatusBadge } from './SystemStatusBadge';
import { SSHTerminalDialog } from '../../ssh/ssh-terminal-dialog';
import { useSystemConnection } from '../../../hooks/use-system-connection';
import { useSystemStats } from '../../../hooks/use-system-stats';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../../../types';
import type { ConnectionStatus } from '../../../types/connection';

interface SystemTableRowProps {
  system: System;
  connection?: ConnectionStatus;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onConnectionUpdate?: (status: {
    pingOk: boolean;
    sshOk: boolean;
    lastError?: string;
  }) => void;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
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
  const [localConnection, setLocalConnection] = useState(connection);
  const { testSystemReachability, testSSHConnection } = useSystemConnection();
  const { stats, loading: statsLoading, error: statsError } = useSystemStats(system);

  useEffect(() => {
    setLocalConnection(connection);
  }, [connection]);

  const updateConnectionStatus = useCallback((status: {
    pingOk: boolean;
    sshOk: boolean;
    lastError?: string;
  }) => {
    setLocalConnection(prev => ({
      ...prev,
      status: status.sshOk ? 'connected' : 'error',
      ...status
    }));

    if (onConnectionUpdate) {
      onConnectionUpdate(status);
    }
  }, [onConnectionUpdate]);

  const handleRefresh = async () => {
    try {
      console.log('Refreshing system:', system);
      
      const pingOk = await testSystemReachability(system.ip);
      console.log('Reachability test result:', pingOk);
      
      let sshOk = false;
      if (pingOk) {
        sshOk = await testSSHConnection(system);
        console.log('SSH test result:', sshOk);
      }

      const status = {
        pingOk,
        sshOk,
        lastError: !pingOk ? 'System not reachable' : 
                  !sshOk ? 'SSH connection failed' : undefined
      };

      updateConnectionStatus(status);
      onRefresh();

      toast({
        title: sshOk ? "Refresh Successful" : "Refresh Warning",
        description: sshOk 
          ? "System connection verified successfully" 
          : status.lastError,
        variant: sshOk ? "default" : "warning",
      });
    } catch (error) {
      console.error('Refresh failed:', error);
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Failed to refresh system status",
        variant: "destructive",
      });
    }
  };

  const renderResources = () => {
    if (statsLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading stats...</span>
        </div>
      );
    }

    if (statsError || !stats) {
      return (
        <div className="text-sm text-muted-foreground">
          Unable to fetch stats
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-6">
        <div>
          <div className="text-xs text-muted-foreground">CPU</div>
          <div className="font-medium flex items-center gap-1">
            {stats.cpu.usage.toFixed(1)}%
            {stats.cpu.temperature > 0 && (
              <span className="text-xs text-muted-foreground">
                ({stats.cpu.temperature}°C)
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Memory</div>
          <div className="font-medium flex items-center gap-1">
            {stats.memory.usage.toFixed(1)}%
            <span className="text-xs text-muted-foreground">
              ({formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)})
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Load</div>
          <div className="font-medium">
            {stats.load[0].toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Uptime</div>
          <div className="font-medium">{formatUptime(stats.uptime)}</div>
        </div>
      </div>
    );
  };

  return (
    <tr className="border-t border-gray-200 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
      <td className="px-4 py-4">
        <SystemInfo system={system} />
      </td>
      <td className="px-4 py-4">
        <SystemConnectionStatus connection={localConnection} />
      </td>
      <td className="px-4 py-4">
        <SystemStatusBadge connection={localConnection} />
      </td>
      <td className="px-4 py-4">
        {renderResources()}
      </td>
      <td className="px-4 py-4">
        <div className="text-sm text-gray-500">
          {system.type === 'Callbox' ? 'Callbox Configuration' : 'UE Simulator Configuration'}
        </div>
      </td>
      <td className="px-4 py-4 text-right">
        <ActionButtons
          system={system}
          connection={localConnection}
          onRefresh={handleRefresh}
          onEdit={onEdit}
          onDelete={onDelete}
          onConnectionUpdate={updateConnectionStatus}
          onOpenSSH={() => setSSHDialogOpen(true)}
        />
      </td>

      <SSHTerminalDialog
        system={system}
        open={sshDialogOpen}
        onOpenChange={setSSHDialogOpen}
      />
    </tr>
  );
}
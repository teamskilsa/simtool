// modules/systems/components/list/table/SystemTableRow.tsx
import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { SystemInfo } from './SystemInfo';
import { ActionButtons } from './ActionButtons';
import { SystemConnectionStatus } from './SystemConnectionStatus';
import { SystemStatusBadge } from './SystemStatusBadge';
import { SSHTerminalDialog } from '../../ssh/ssh-terminal-dialog';
import { useSystemConnection } from '../../../hooks/use-system-connection';
import { useSystemStats } from '../../../hooks/use-system-stats';
import { toast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { provisionSystem as runProvisionSystem, type ProvisionResult } from '../../../services/provision';
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
  onProvisionComplete?: (systemId: number, result: ProvisionResult) => void;
  updateSystemProvisionStatus?: (systemId: number, patch: Partial<System>) => void;
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
  onConnectionUpdate,
  onProvisionComplete,
  updateSystemProvisionStatus,
}: SystemTableRowProps) {
  const [sshDialogOpen, setSSHDialogOpen] = useState(false);
  const [localConnection, setLocalConnection] = useState(connection);
  const [retrying, setRetrying] = useState(false);
  const { testSystemReachability, testSSHConnection } = useSystemConnection();
  const { stats, loading: statsLoading, error: statsError } = useSystemStats(system);

  const handleRetryProvision = async () => {
    if (retrying) return;
    setRetrying(true);
    // Mark as provisioning immediately so the spinner shows
    updateSystemProvisionStatus?.(system.id, { provisionStatus: 'provisioning' } as any);
    toast({ title: 'Retrying provisioning', description: `Re-attempting ${system.name}…` });
    try {
      const result = await runProvisionSystem(system);

      // Update provision state directly — don't rely solely on the parent callback
      updateSystemProvisionStatus?.(system.id, {
        provisionStatus: result.success ? 'success' : 'failed',
        provisionError: result.error,
        provisionSteps: result.steps,
        provisionedAt: Date.now(),
        provisionFailedStep: result.failedStep,
      } as any);

      // Also notify parent (e.g. for any extra handling in SystemsListView)
      onProvisionComplete?.(system.id, result);

      toast({
        title: result.success ? 'Provisioning Successful' : 'Provisioning Failed',
        description: result.success
          ? `${system.name} is now ready.`
          : `${system.name}: ${(result.error || 'unknown error').split('\n')[0]}`,
        variant: result.success ? 'default' : 'destructive',
      });
    } finally {
      setRetrying(false);
    }
  };

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
      
      const pingOk = await testSystemReachability(system.ip, system.sshPort ?? 22);
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
        <div className="space-y-1.5">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-14" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-12" />
          </div>
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

  const provisionStatus = system.provisionStatus;
  const provisionError = system.provisionError;
  const provisionFailedStep = system.provisionFailedStep;

  const renderProvisionBadge = () => {
    if (provisionStatus === 'provisioning' || retrying) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
          <Loader2 className="w-3 h-3 animate-spin" /> Provisioning…
        </span>
      );
    }
    if (provisionStatus === 'failed') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 cursor-help">
                <AlertTriangle className="w-3 h-3" /> Provision failed{provisionFailedStep ? ` (${provisionFailedStep})` : ''}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm whitespace-pre-line bg-popover border-border text-popover-foreground">
              {provisionError || 'Provisioning did not complete.'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    if (provisionStatus === 'success') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
          <CheckCircle2 className="w-3 h-3" /> Provisioned
        </span>
      );
    }
    return null;
  };

  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-4">
        <div className="space-y-1.5">
          <SystemInfo system={system} />
          <div className="flex items-center gap-2">
            {renderProvisionBadge()}
            {provisionStatus === 'failed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryProvision}
                disabled={retrying}
                className="h-6 text-xs px-2 border-red-300 text-red-700 hover:bg-red-50"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
                Retry
              </Button>
            )}
          </div>
        </div>
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
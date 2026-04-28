// components/ScenarioSelector/ScenarioCard.tsx
import React, { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Network, FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { executionService } from '@/modules/testExecution/services';
import { ExecutionStep } from '@/modules/testExecution/types/execution.types';
import { ScenarioActions } from './ScenarioActions';
import { ExecutionLogs } from './ExecutionLogs';
import { useToast } from "@/components/ui/use-toast";
import { useConfigs } from '../../context/ConfigContext/ConfigContext';
import { useSystems } from '@/modules/systems/hooks/use-systems';

interface ScenarioCardProps {
  scenario: {
    id: string;
    name: string;
    topology: string;
    system?: {
      id: string;
      name: string;
      host: string;
      port: string;
    };
    moduleConfigs: Array<{
      moduleId: string;
      module?: string;
      configId: string;
      ipAddress?: string;
      enabled: boolean;
    }>;
    createdAt: string;
    lastRun?: string;
    ipConfig: {
      common?: string;
      [key: string]: string | undefined;
    };
  };
  index: number;
  onRefresh?: () => void;
}

export function ScenarioCard({ scenario, index, onRefresh }: ScenarioCardProps) {
  const { toast } = useToast();
  const { configs } = useConfigs();
  const { systems } = useSystems();
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Helper function to safely handle moduleConfigs
  const getModuleConfigs = () => {
    // If moduleConfigs is undefined, return empty array
    if (!scenario.moduleConfigs) return [];
    
    // If it's already an array, use it
    if (Array.isArray(scenario.moduleConfigs)) {
      return scenario.moduleConfigs.filter(config => config.enabled);
    }
    
    // If it's an object, convert to array
    if (typeof scenario.moduleConfigs === 'object') {
      return Object.entries(scenario.moduleConfigs)
        .map(([moduleId, config]) => ({
          moduleId,
          ...config
        }))
        .filter(config => config.enabled);
    }
    
    return [];
  };

  const handleRun = async () => {
    if (!scenario.id) {
      toast({ title: 'Error', description: 'Invalid scenario configuration', variant: 'destructive' });
      return;
    }

    // ── 1. Pre-flight: scenario must reference a system that still exists,
    //       and must have at least one enabled module + config picked.
    if (!scenario.system?.id) {
      toast({
        title: 'No target system',
        description: 'This scenario has no system selected. Edit the scenario and pick one in Test Systems.',
        variant: 'destructive',
      });
      return;
    }
    const sys = systems.find(s => String(s.id) === String(scenario.system!.id));
    if (!sys) {
      toast({
        title: 'System not found',
        description: `The scenario points at system "${scenario.system.name}" but it's no longer in your systems list. Edit the scenario or restore the system.`,
        variant: 'destructive',
      });
      return;
    }
    if (!sys.username || (!sys.password && !sys.privateKey)) {
      toast({
        title: 'Missing SSH credentials',
        description: `System "${sys.name}" has no SSH username/password set. Edit it in Test Systems before running.`,
        variant: 'destructive',
      });
      return;
    }
    const enabled = (scenario.moduleConfigs ?? []).filter(c => c.enabled && c.configId);
    if (enabled.length === 0) {
      toast({
        title: 'Nothing to deploy',
        description: 'This scenario has no enabled modules with a config selected. Edit it and pick at least one.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsRunning(true);
      setSteps([]);

      const executionSteps = await executionService.executeScenario(scenario.id, {
        host: sys.ip,
        port: sys.sshPort ?? 22,
        username: sys.username,
        ...(sys.authMode === 'privateKey' && sys.privateKey
          ? { privateKey: sys.privateKey }
          : { password: sys.password ?? '' }),
      });
      setSteps(executionSteps);

      // ── 2. After-the-fact: an empty steps array means the executor found
      //       nothing to do. We pre-flighted enabled configs above, so this
      //       is treated as an executor-level bug, not a happy success.
      if (executionSteps.length === 0) {
        toast({
          title: 'Execution did nothing',
          description: 'No deploy steps ran. The scenario may be misconfigured (module names mismatched).',
          variant: 'destructive',
        });
        return;
      }

      const failed = executionSteps.filter(s => s.status === 'failure');
      if (failed.length > 0) {
        toast({
          title: 'Execution Failed',
          description: failed.map(s => `${s.name}: ${s.error ?? 'unknown error'}`).join('\n'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Execution Complete',
          description: `${executionSteps.length} step${executionSteps.length === 1 ? '' : 's'} completed successfully`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const getSystemDisplay = () => {
    if (scenario.system) {
      return (
        <div className="flex flex-col">
          <span className="font-medium">{scenario.system.name}</span>
          <span className="text-sm text-muted-foreground">{scenario.system.host}</span>
        </div>
      );
    }
    return scenario.ipConfig?.common || 'No IP configured';
  };

  const getConfigName = (moduleId: string, configId: string) => {
    if (!configs || !configs[moduleId]) return configId;
    
    const moduleConfigs = configs[moduleId];
    const config = moduleConfigs.find(c => c.id === configId);
    return config?.name || configId;
  };

  const moduleConfigs = getModuleConfigs();

  return (
    <TableRow className={cn(isRunning && "bg-muted/50")}>
      <TableCell className="text-muted-foreground">{index}</TableCell>
      
      {/* Scenario Name & Topology */}
      <TableCell className="font-medium">
        <div className="flex flex-col space-y-1">
          <span>{scenario.name}</span>
          <Badge variant="outline" className="w-fit">{scenario.topology}</Badge>
        </div>
      </TableCell>
      
      {/* Modules */}
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {moduleConfigs.map(config => (
            <Badge 
              key={config.moduleId} 
              variant="secondary"
            >
              {config.moduleId}
            </Badge>
          ))}
        </div>
      </TableCell>
      
      {/* System/IP Info */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          {getSystemDisplay()}
        </div>
      </TableCell>
      
      {/* Config Names */}
      <TableCell>
        <div className="flex flex-col gap-1">
          {moduleConfigs.map(config => {
            const moduleId = config.moduleId;
            const configName = getConfigName(moduleId, config.configId);
            return (
              <div key={moduleId} className="flex items-center gap-2">
                <span className="text-sm font-medium min-w-16">
                  {moduleId}:
                </span>
                <span className="text-sm text-muted-foreground">
                  {configName}
                </span>
              </div>
            );
          })}
        </div>
      </TableCell>
      
      {/* Dates */}
      <TableCell className="whitespace-nowrap">
        {formatDate(scenario.createdAt)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {scenario.lastRun ? formatDate(scenario.lastRun) : '-'}
      </TableCell>
      
      {/* Actions */}
      <TableCell>
        <ScenarioActions
          scenario={scenario}
          isRunning={isRunning}
          onRun={handleRun}
          onViewLogs={() => setShowLogs(true)}
          onRefreshList={onRefresh}
        />
      </TableCell>

      {/* Execution Logs Dialog */}
      <ExecutionLogs
        open={showLogs}
        onOpenChange={setShowLogs}
        scenarioName={scenario.name}
        steps={steps}
      />
    </TableRow>
  );
}
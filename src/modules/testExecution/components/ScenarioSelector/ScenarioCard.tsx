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
      console.error('[ScenarioCard] No scenario ID provided');
      toast({
        title: "Error",
        description: "Invalid scenario configuration",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsRunning(true);
      setSteps([]);

      console.log(`[ScenarioCard] Starting execution for scenario:`, {
        id: scenario.id,
        name: scenario.name,
        topology: scenario.topology,
        modules: scenario.moduleConfigs
      });

      const executionSteps = await executionService.executeScenario(scenario.id);
      setSteps(executionSteps);

      const hasFailed = executionSteps.some(step => step.status === 'failure');
      
      if (hasFailed) {
        const failedSteps = executionSteps.filter(step => step.status === 'failure');
        const errors = failedSteps.map(step => `${step.name}: ${step.error}`).join('\n');
        toast({
          title: "Execution Failed",
          description: errors,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Execution Complete",
          description: "All steps completed successfully"
        });
      }
    } catch (error) {
      console.error('[ScenarioCard] Execution error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
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
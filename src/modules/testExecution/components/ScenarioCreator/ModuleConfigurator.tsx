// src/modules/testExecution/components/ScenarioCreator/ModuleConfigurator.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useConfigs } from '../../context/ConfigContext/ConfigContext';
import { TOPOLOGY_OPTIONS } from './constants';
import { ScenarioConfig } from './types';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

interface ModuleConfiguratorProps {
  config: Partial<ScenarioConfig>;
  onChange: (updates: Partial<ScenarioConfig>) => void;
  onComplete: (name: string) => void;
}

export function ModuleConfigurator({
  config,
  onChange,
  onComplete
}: ModuleConfiguratorProps) {
  const { toast } = useToast();
  const { configs, loading } = useConfigs();
  const [scenarioName, setScenarioName] = React.useState('');

  const selectedTopology = TOPOLOGY_OPTIONS.find(t => t.id === config.topology);
  const requiredModules = selectedTopology?.modules || [];

  const handleComplete = () => {
    if (!scenarioName.trim()) {
      toast({
        title: "Required",
        description: "Please enter a scenario name",
        variant: "destructive"
      });
      return;
    }

    const moduleConfigs = requiredModules.map(module => ({
      module,
      configId: selectedConfigs[module] || `${module}-config.cfg`,
      ipAddress: config.ipConfig?.common
    }));

    onChange({ moduleConfigs });
    onComplete(scenarioName);
  };

  const [selectedConfigs, setSelectedConfigs] = React.useState<Record<string, string>>({});

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Card className={cn(
      "p-6 space-y-6",
      "bg-gradient-to-br from-background/60 to-muted/30",
      "backdrop-blur-sm border-muted/30"
    )}>
      {/* Row 1: Basic Info */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Scenario Name</Label>
          <Input
            id="name"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Enter scenario name"
            className="bg-background/50"
          />
        </div>
        <div className="space-y-2">
          <Label>Topology</Label>
          <Select
            value={config.topology}
            onValueChange={(value) => onChange({ topology: value })}
          >
            <SelectTrigger className="bg-background/50">
              <SelectValue placeholder="Select topology" />
            </SelectTrigger>
            <SelectContent>
              {TOPOLOGY_OPTIONS.map(topology => (
                <SelectItem key={topology.id} value={topology.id}>
                  <div className="flex flex-col">
                    <span>{topology.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {topology.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Module Configurations */}
      {selectedTopology && (
        <div className="space-y-4">
          <h3 className="font-medium">Module Configurations</h3>
          <div className="grid gap-4">
            {requiredModules.map(module => (
              <div key={module} className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-muted/30 bg-background/50">
                <div className="space-y-2">
                  <Label className="capitalize">{module}</Label>
                  <Input
                    value={config.ipConfig?.common || ''}
                    onChange={(e) => onChange({
                      ipConfig: { common: e.target.value }
                    })}
                    placeholder="IP Address"
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Configuration</Label>
                  <Select
                    value={selectedConfigs[module]}
                    onValueChange={(value) => setSelectedConfigs(prev => ({
                      ...prev,
                      [module]: value
                    }))}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder={`Select ${module} config`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Available Configs</SelectLabel>
                        {configs[module]?.map(config => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleComplete}
          className="bg-primary/90 hover:bg-primary"
        >
          Create Scenario
        </Button>
      </div>
    </Card>
  );
}
// components/ScenarioCreator/ModuleConfigurator.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfigContext } from '@/modules/testConfig/context/ConfigContext';
import { ScenarioConfig } from './types';
import { TOPOLOGY_OPTIONS } from './constants';
import { ChevronLeft } from 'lucide-react';

interface ModuleConfiguratorProps {
  config: Partial<ScenarioConfig>;
  onChange: (updates: Partial<ScenarioConfig>) => void;
  onBack: () => void;
  onComplete: () => void;
}

export function ModuleConfigurator({
  config,
  onChange,
  onBack,
  onComplete
}: ModuleConfiguratorProps) {
  const { configs } = useConfigContext();
  const { toast } = useToast();
  const [scenarioName, setScenarioName] = React.useState('');

  const selectedTopology = TOPOLOGY_OPTIONS.find(t => t.id === config.topology);

  const handleModuleConfigSelect = (module: string, configId: string) => {
    const currentConfigs = config.moduleConfigs || [];
    const updatedConfigs = [...currentConfigs];
    const existingIndex = updatedConfigs.findIndex(c => c.module === module);

    if (existingIndex >= 0) {
      updatedConfigs[existingIndex].configId = configId;
    } else {
      updatedConfigs.push({ module, configId, ipAddress: config.ipConfig?.common });
    }

    onChange({ moduleConfigs: updatedConfigs });
  };

  const handleComplete = () => {
    if (!scenarioName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a scenario name",
        variant: "destructive"
      });
      return;
    }

    onChange({ name: scenarioName });
    onComplete();
  };

  if (!selectedTopology) {
    return null;
  }

  return (
    <div className="space-y-6 mt-6">
      <Card className="p-4">
        <div className="space-y-4">
          <Label htmlFor="scenarioName">Scenario Name</Label>
          <Input
            id="scenarioName"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Enter scenario name"
            className="max-w-md"
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-4">
          <Label>Module Configurations</Label>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {selectedTopology.modules.map(module => (
                <div key={module} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="capitalize">{module} Configuration</Label>
                    {selectedTopology.optional?.includes(module) && (
                      <Badge variant="outline">Optional</Badge>
                    )}
                  </div>

                  <Select
                    value={config.moduleConfigs?.find(c => c.module === module)?.configId}
                    onValueChange={(value) => handleModuleConfigSelect(module, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${module} configuration`} />
                    </SelectTrigger>
                    <SelectContent>
                      {configs
                        .filter(config => config.module === module)
                        .map(config => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {config.moduleConfigs?.find(c => c.module === module)?.configId && (
                    <div className="mt-4 p-2 bg-muted rounded-lg">
                      <div className="text-sm">
                        Selected: {
                          configs.find(c => 
                            c.id === config.moduleConfigs?.find(mc => mc.module === module)?.configId
                          )?.name
                        }
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Last modified: {
                          new Date(configs.find(c => 
                            c.id === config.moduleConfigs?.find(mc => mc.module === module)?.configId
                          )?.modifiedAt || '').toLocaleDateString()
                        }
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleComplete}>
          Create Scenario
        </Button>
      </div>
    </div>
  );
}
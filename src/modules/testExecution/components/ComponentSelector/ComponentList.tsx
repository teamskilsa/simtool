// components/ComponentSelector/ComponentList.tsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Network, Server, FileText } from 'lucide-react';
import { useConfigContext } from '@/modules/testConfig/context/ConfigContext';
import { cn } from '@/lib/utils';

interface ComponentListProps {
  scenarioName: string;
  onScenarioNameChange: (name: string) => void;
}

export function ComponentList({ scenarioName, onScenarioNameChange }: ComponentListProps) {
  // Get stored systems
  const [systems, setSystems] = useState([
    { id: 'system1', name: 'System 1', host: '192.168.1.100', port: '9050' },
    { id: 'system2', name: 'System 2', host: '192.168.1.200', port: '9050' }
  ]);

  // Get stored configurations
  const { configs } = useConfigContext();
  
  const [moduleConfigs, setModuleConfigs] = useState<Record<string, string>>({});
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [ipAddresses, setIpAddresses] = useState<Record<string, string>>({});

  // Handle system selection
  const handleSystemSelect = (systemId: string) => {
    const system = systems.find(s => s.id === systemId);
    if (system) {
      setSelectedSystem(systemId);
      // Pre-fill IP with system's IP
      setIpAddresses(prev => ({
        ...prev,
        common: system.host
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Scenario Name */}
      <Card className="p-4">
        <div className="space-y-4">
          <Label htmlFor="scenarioName">Scenario Name</Label>
          <Input
            id="scenarioName"
            value={scenarioName}
            onChange={(e) => onScenarioNameChange(e.target.value)}
            placeholder="Enter scenario name"
            className="max-w-md"
          />
        </div>
      </Card>

      {/* System Selection and IP Configuration */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            <Label>System Selection</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select System</Label>
              <Select value={selectedSystem} onValueChange={handleSystemSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a system" />
                </SelectTrigger>
                <SelectContent>
                  {systems.map(system => (
                    <SelectItem key={system.id} value={system.id}>
                      {system.name} ({system.host})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>IP Address</Label>
              <Input
                value={ipAddresses.common || ''}
                onChange={(e) => setIpAddresses(prev => ({
                  ...prev,
                  common: e.target.value
                }))}
                placeholder="IP Address"
              />
              <p className="text-sm text-muted-foreground">
                You can modify the system IP if needed
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Configuration Selection */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <Label>Module Configurations</Label>
          </div>

          <ScrollArea className="h-[300px]">
            <div className="space-y-4">
              {['enb', 'mme', 'ims'].map(module => (
                <div key={module} className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div>
                    <Label className="capitalize mb-2">{module} Configuration</Label>
                    <Select 
                      value={moduleConfigs[module]}
                      onValueChange={(value) => setModuleConfigs(prev => ({
                        ...prev,
                        [module]: value
                      }))}
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
                  </div>

                  {/* Show selected configuration details */}
                  {moduleConfigs[module] && (
                    <div className="space-y-2">
                      <Label>Selected Configuration</Label>
                      <div className="text-sm text-muted-foreground">
                        {configs.find(c => c.id === moduleConfigs[module])?.name}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          {configs.find(c => c.id === moduleConfigs[module])?.module}
                        </Badge>
                        <Badge variant="secondary">
                          Last modified: {
                            new Date(configs.find(c => c.id === moduleConfigs[module])?.modifiedAt || '')
                              .toLocaleDateString()
                          }
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}
// components/ScenarioCreator/SystemSelector.tsx
import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScenarioConfig } from './types';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import { useToast } from '@/components/ui/use-toast';

interface SystemSelectorProps {
  config: Partial<ScenarioConfig>;
  onChange: (updates: Partial<ScenarioConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function SystemSelector({ config, onChange, onNext, onBack }: SystemSelectorProps) {
  const { systems: globalSystems, addSystem } = useSystems();
  const { toast } = useToast();
  const [showNewSystem, setShowNewSystem] = useState(false);
  const [newSystemData, setNewSystemData] = useState({ name: '', host: '', port: '9050' });

  // Map the user's saved systems into the shape the scenario expects
  const systems = useMemo(() =>
    globalSystems.map(s => ({
      id: String(s.id),
      name: s.name,
      host: s.ip,
      port: '9050',
    })),
  [globalSystems]);

  const handleSystemSelect = (systemId: string) => {
    const system = systems.find(s => s.id === systemId);
    if (system) {
      onChange({
        system: { ...system },
        ipConfig: { common: system.host }
      });
    }
  };

  const handleIpChange = (ip: string) => {
    onChange({
      ipConfig: { common: ip },
      system: config.system ? {
        ...config.system,
        host: ip
      } : undefined
    });
  };

  const handleAddNewSystem = async () => {
    if (!newSystemData.name.trim() || !newSystemData.host.trim()) {
      toast({
        title: 'Required',
        description: 'Name and host are both required.',
        variant: 'destructive',
      });
      return;
    }
    const created = await addSystem({
      name: newSystemData.name.trim(),
      ip: newSystemData.host.trim(),
      type: 'Callbox',
      username: '',
      password: '',
    });
    setShowNewSystem(false);
    setNewSystemData({ name: '', host: '', port: '9050' });
    handleSystemSelect(String(created.id));
    toast({ title: 'System added', description: `${created.name} (${created.ip})` });
  };

  return (
    <div className="space-y-6 mt-6">
      {/* System Selection */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Select System</Label>
            <Button variant="outline" size="sm" onClick={() => setShowNewSystem(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add New System
            </Button>
          </div>

          {systems.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center">
              No systems configured. Add one here or in the <span className="font-medium">Test Systems</span> section.
            </p>
          ) : (
            <Select value={config.system?.id} onValueChange={handleSystemSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a system" />
              </SelectTrigger>
              <SelectContent>
                {systems.map(system => (
                  <SelectItem key={system.id} value={system.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{system.name}</span>
                      <Badge variant="outline" className="ml-2">
                        {system.host}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Card>

      {/* IP Configuration */}
      {config.system && (
        <Card className="p-4">
          <div className="space-y-4">
            <Label>IP Configuration</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  value={config.ipConfig?.common || config.system.host}
                  onChange={(e) => handleIpChange(e.target.value)}
                  placeholder="Enter IP address"
                />
                <p className="text-sm text-muted-foreground">
                  You can modify the system IP if needed
                </p>
              </div>
              <div className="space-y-2">
                <Input
                  value={config.system.port}
                  placeholder="Port"
                  disabled
                />
                <p className="text-sm text-muted-foreground">
                  Default port: {config.system.port}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!config.system}>
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Add New System Dialog */}
      <Dialog open={showNewSystem} onOpenChange={setShowNewSystem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New System</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>System Name</Label>
              <Input
                value={newSystemData.name}
                onChange={(e) => setNewSystemData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter system name"
              />
            </div>
            <div className="space-y-2">
              <Label>Host IP</Label>
              <Input
                value={newSystemData.host}
                onChange={(e) => setNewSystemData(prev => ({ ...prev, host: e.target.value }))}
                placeholder="Enter IP address"
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                value={newSystemData.port}
                onChange={(e) => setNewSystemData(prev => ({ ...prev, port: e.target.value }))}
                placeholder="Enter port"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewSystem(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNewSystem}>
              Add System
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
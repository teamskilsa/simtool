// components/ScenarioCreator/SystemSelector.tsx
import React, { useState, useEffect } from 'react';
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
import { ChevronLeft, ChevronRight, Server, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface SystemSelectorProps {
  config: Partial<ScenarioConfig>;
  onChange: (updates: Partial<ScenarioConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

// Mock systems data - this will be replaced with actual systems from storage
const MOCK_SYSTEMS = [
  { id: 'system1', name: 'System 1', host: '192.168.1.100', port: '9050' },
  { id: 'system2', name: 'System 2', host: '192.168.1.200', port: '9050' }
];

// Mock configurations - this will be replaced with actual configs from storage
const MOCK_CONFIGS = {
  enb: [
    'demo-mme.cfg',
    'demo-mme-11152024-23:18.cfg',
    'demo-mme-11162024-00:13.cfg'
  ],
  gnb: [
    'gnb-2cc-nsa.cfg',
    'gnb-2cc-nsa-11152024-23:16.cfg'
  ],
  mme: ['mme-config.cfg'],
  ims: ['ims-config.cfg']
};

export function SystemSelector({ config, onChange, onNext, onBack }: SystemSelectorProps) {
  const [showNewSystem, setShowNewSystem] = useState(false);
  const [newSystemData, setNewSystemData] = useState({
    name: '',
    host: '',
    port: '9050'
  });

  const handleSystemSelect = (systemId: string) => {
    const system = MOCK_SYSTEMS.find(s => s.id === systemId);
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

  const handleAddNewSystem = () => {
    // Here you would typically save to your storage
    setShowNewSystem(false);
    // Refresh systems list
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

          <Select value={config.system?.id} onValueChange={handleSystemSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a system" />
            </SelectTrigger>
            <SelectContent>
              {MOCK_SYSTEMS.map(system => (
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
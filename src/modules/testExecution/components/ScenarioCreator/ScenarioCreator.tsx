// components/ScenarioCreator/ScenarioCreator.tsx
import React from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModuleConfig } from './useModuleConfig';
import { ModuleConfigRow } from './ModuleConfigRow';
import { TOPOLOGY_OPTIONS } from './constants';
import { useConfigs } from '../../context/ConfigContext/ConfigContext';
import { cn } from "@/lib/utils";

interface ScenarioCreatorProps {
  initialData?: any;
  isEditing?: boolean;
  onSave?: (data: any) => Promise<void>;
  isSaving?: boolean;
}

export function ScenarioCreator({
  initialData,
  isEditing = false,
  onSave,
  isSaving = false
}: ScenarioCreatorProps) {
  const { configs } = useConfigs();
  const { formState, updateFormState, updateModuleConfig } = useModuleConfig([]);

  const selectedTopology = TOPOLOGY_OPTIONS.find(t => t.id === formState.topology);
  const modules = selectedTopology?.modules || [];

  const handleSave = () => {
    if (!onSave) return;

    const moduleConfigsArray = Object.entries(formState.moduleConfigs).map(([moduleId, config]) => ({
      moduleId,
      enabled: config.enabled ?? true,
      configId: config.configId || '',
      ipAddress: config.ipAddress || '',
      isCustomIp: config.isCustomIp || false,
      systemId: config.systemId
    }));

    const saveData = {
      name: formState.name,
      topology: formState.topology,
      system: formState.system,
      ipConfig: formState.ipConfig || {},
      moduleConfigs: moduleConfigsArray
    };

    onSave(saveData);
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className={cn(
        "grid grid-cols-2 gap-6 p-6 rounded-lg",
        "bg-gradient-to-br from-background/40 to-muted/20",
        "border border-muted/20"
      )}>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground/90">Scenario Name</Label>
          <Input
            value={formState.name}
            onChange={(e) => updateFormState({ name: e.target.value })}
            placeholder="Enter scenario name"
            className="bg-background/50 border-muted/30"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground/90">Topology</Label>
          <Select
            value={formState.topology}
            onValueChange={(value) => updateFormState({ topology: value })}
          >
            <SelectTrigger className="bg-background/50 border-muted/30">
              <SelectValue placeholder="Select topology" />
            </SelectTrigger>
            <SelectContent>
              {TOPOLOGY_OPTIONS.map(topology => (
                <SelectItem key={topology.id} value={topology.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{topology.name}</span>
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

      {/* Module Configurations */}
      {selectedTopology && (
        <div className="space-y-4">
          {modules.map(moduleId => (
            <ModuleConfigRow
              key={moduleId}
              module={moduleId}
              config={formState.moduleConfigs[moduleId]}
              configs={configs}
              onUpdate={(updates) => updateModuleConfig(moduleId, updates)}
            />
          ))}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSave}
          disabled={isSaving || !formState.name || !formState.topology}
          className={cn(
            "bg-gradient-to-r from-blue-500 to-indigo-600",
            "hover:from-blue-600 hover:to-indigo-700",
            "text-white shadow-lg hover:shadow-xl",
            "transition-all duration-200",
            "px-8"
          )}
        >
          {isSaving 
            ? 'Saving...' 
            : isEditing 
              ? 'Save Changes' 
              : 'Create Scenario'
          }
        </Button>
      </div>
    </div>
  );
}
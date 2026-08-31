// components/ScenarioCreator/ScenarioCreator.tsx
import React, { useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ModuleConfigRow, MODULE_GRID } from './ModuleConfigRow';
import { TOPOLOGY_OPTIONS } from './constants';
import { useConfigs } from '../../context/ConfigContext/ConfigContext';
import { useSystems } from '@/modules/systems/hooks/use-systems';
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
  const { configs, refreshConfigs } = useConfigs();
  const { systems: globalSystems } = useSystems();
  const { formState, updateFormState, updateModuleConfig } = useModuleConfig([]);

  // The execution ConfigProvider wraps the dashboard layout and only loads
  // configs once on mount; refresh whenever the user opens the creator so
  // newly created/duplicated configs appear without a page reload.
  useEffect(() => {
    refreshConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTopology = TOPOLOGY_OPTIONS.find(t => t.id === formState.topology);
  const modules = selectedTopology?.modules || [];

  // Map saved systems (Test Systems section) into the shape the scenario uses.
  //
  // Note `port` here is the SSH port we'll use at execution time to deploy
  // configs over SSH. The previous code stored '9050' (the on-box agent
  // port), which silently broke deploy because the deploy API speaks SSH.
  // Username/password are NOT carried into the scenario — they're looked
  // up fresh from the systems store at run time so credentials updated in
  // Test Systems take effect without re-saving every scenario.
  const availableSystems = useMemo(() =>
    globalSystems.map(s => ({
      id: String(s.id),
      name: s.name,
      host: s.ip,
      port: String(s.sshPort ?? 22),
    })),
  [globalSystems]);

  const handleSystemChange = (systemId: string) => {
    const sys = availableSystems.find(s => s.id === systemId);
    if (!sys) return;
    updateFormState({
      system: sys,
      ipConfig: { ...formState.ipConfig, common: sys.host },
    });
  };

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
    <div className="space-y-5">
      {/* ─── Basics ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Scenario Name</Label>
          <Input
            value={formState.name}
            onChange={(e) => updateFormState({ name: e.target.value })}
            placeholder="e.g. dish-roaming-demo"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Topology</Label>
          <Select
            value={formState.topology}
            onValueChange={(value) => updateFormState({ topology: value })}
          >
            {/* Passing children to SelectValue is deliberate: by default Radix
                clones the *selected item's* children into the trigger, which
                dragged the multi-line description in and crushed this column.
                Show the name here; the description sits below the field. */}
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select topology">
                {selectedTopology?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TOPOLOGY_OPTIONS.map(topology => (
                <SelectItem key={topology.id} value={topology.id}>
                  <div className="flex flex-col gap-0.5 py-0.5">
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

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Target System</Label>
          {availableSystems.length === 0 ? (
            <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border px-3 py-2 leading-snug">
              No systems yet — add one in <span className="font-medium">Test Systems</span>.
            </p>
          ) : (
            <Select
              value={formState.system?.id}
              onValueChange={handleSystemChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select system">
                  {formState.system?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableSystems.map(sys => (
                  <SelectItem key={sys.id} value={sys.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sys.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{sys.host}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Topology description as helper text — full width, room to breathe */}
      {selectedTopology && (
        <p className="text-xs text-muted-foreground -mt-1">
          <span className="font-medium text-foreground">{selectedTopology.name}:</span>{' '}
          {selectedTopology.description}
        </p>
      )}

      {/* ─── Modules ────────────────────────────────────────────────── */}
      {selectedTopology && (
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/40">
            <h3 className="text-sm font-semibold text-foreground">Modules</h3>
            <span className="text-xs text-muted-foreground">
              {modules.length} in this topology · deployed in order
            </span>
          </div>

          {/* One header row for all modules instead of repeating the two
              labels inside every card. Hidden on mobile, where each row
              stacks and carries its own inline labels. */}
          <div className={cn(
            MODULE_GRID,
            'hidden sm:grid px-4 py-2 border-b border-border/60 bg-muted/20',
          )}>
            <span className="text-xs font-medium text-muted-foreground">Module</span>
            <span className="text-xs font-medium text-muted-foreground">IP address</span>
            <span className="text-xs font-medium text-muted-foreground">Configuration</span>
          </div>

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

      {/* ─── Submit ─────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2 pt-1">
        <Button
          onClick={handleSave}
          disabled={isSaving || !formState.name || !formState.topology || !formState.system}
        >
          {isSaving
            ? 'Saving…'
            : isEditing
              ? 'Save Changes'
              : 'Create Scenario'
          }
        </Button>
      </div>
    </div>
  );
}

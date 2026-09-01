// components/ScenarioCreator/ScenarioCreator.tsx
import React, { useEffect, useMemo } from 'react';
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
  // initialData drives edit mode — previously it was accepted as a prop and
  // then dropped on the floor, which is why Edit opened an empty form.
  const { formState, updateFormState, setTopology, updateModuleConfig, modules } =
    useModuleConfig(initialData);

  // The execution ConfigProvider wraps the dashboard layout and only loads
  // configs once on mount; refresh whenever the user opens the creator so
  // newly created/duplicated configs appear without a page reload.
  useEffect(() => {
    refreshConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTopology = TOPOLOGY_OPTIONS.find(t => t.id === formState.topology);

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

  // A scenario can outlive the system it points at (system deleted, or the
  // scenario came from another machine). The Select then matches nothing and
  // renders blank, which is indistinguishable from "never set" — so say it.
  const danglingSystem =
    formState.system?.id && !availableSystems.some(s => s.id === String(formState.system!.id))
      ? formState.system
      : null;

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

    // Emit a row for every module in the topology. Only emitting *touched*
    // rows used to save scenarios with an empty moduleConfigs list — and
    // because /api/scenarios PUT shallow-merges, an edit then wiped the
    // module configs of an otherwise working scenario.
    const moduleConfigsArray = modules.map((moduleId) => {
      const config = formState.moduleConfigs[moduleId] ?? {};
      return {
        moduleId,
        enabled: config.enabled ?? true,
        configId: config.configId || '',
        ipAddress: config.ipAddress || '',
        isCustomIp: config.isCustomIp || false,
        systemId: config.systemId,
      };
    });

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
            onValueChange={setTopology}
          >
            {/* Only `children` lands in the trigger (Radix clones ItemText);
                `description` renders outside it, so the long topology blurb
                stays in the dropdown instead of crushing this column. */}
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select topology" />
            </SelectTrigger>
            <SelectContent>
              {TOPOLOGY_OPTIONS.map(topology => (
                <SelectItem
                  key={topology.id}
                  value={topology.id}
                  description={topology.description}
                >
                  {topology.name}
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
                <SelectValue placeholder="Select system" />
              </SelectTrigger>
              <SelectContent>
                {availableSystems.map(sys => (
                  <SelectItem key={sys.id} value={sys.id} description={sys.host}>
                    {sys.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {danglingSystem && (
            <p className="text-xs text-amber-600 dark:text-amber-500 leading-snug">
              Saved system <span className="font-medium">{danglingSystem.name}</span>
              {danglingSystem.host ? ` (${danglingSystem.host})` : ''} is no longer in
              Test Systems. Pick a replacement, or the run will fail.
            </p>
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

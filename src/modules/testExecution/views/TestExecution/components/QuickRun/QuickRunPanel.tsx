// Quick Run — the simple "I just want to run an enb.cfg on my callbox" path.
//
// Most callbox users have the core (MME/IMS/UE_DB) already running and just
// want to swap the eNB or gNB config and watch KPIs. That's a totally
// different mental model from the multi-component Scenarios flow, so it
// lives in its own tab with a deliberately tiny surface:
//
//   1. Pick a module     (eNB / gNB / MME / IMS / UE / UE_DB)
//   2. Pick a config     (filtered by the module above)
//   3. Pick a system     (from Test Systems)
//   4. Click Run         (SCP + service restart over SSH)
//   5. See result        (success/failure)
//   6. View live stats   (jumps to the monitoring dashboard with the
//                         system + module pre-selected)
//
// Internally this just calls executionService.deployModule() with the same
// API the multi-step Scenario runner uses, so the SSH / restart / port
// probe path is identical — there's no second copy of "how to deploy".

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  PlayCircle, Loader2, CheckCircle2, AlertCircle, BarChart3,
} from 'lucide-react';
import { useConfigs } from '@/modules/testExecution/context/ConfigContext/ConfigContext';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import { executionService } from '@/modules/testExecution/services';
import type { ExecutionStep } from '@/modules/testExecution/types/execution.types';
import type { ModuleType } from '@/lib/storage/config';

// Modules a user can deploy. Order matters — eNB first because that's the
// 80% case for callbox users running radio.
const MODULES: Array<{ id: ModuleType; label: string }> = [
  { id: 'enb',   label: 'eNB (LTE)'   },
  { id: 'gnb',   label: 'gNB (5G NR)' },
  { id: 'mme',   label: 'MME / EPC'   },
  { id: 'ims',   label: 'IMS'         },
  { id: 'ue_db', label: 'UE Database' },
];

// Modules that have meaningful KPIs to view post-run. UE-DB is just a
// subscriber list — no live stats, so we hide the "View live stats" CTA
// for it.
const RADIO_MODULES: Array<ModuleType> = ['enb', 'gnb'];

/**
 * Hand off the user to the monitoring dashboard with a pre-selected target.
 * The dashboard reads this on mount and pops directly into the right system
 * + module so the user doesn't have to re-pick.
 */
function navigateToMonitoring(systemId: string, module: ModuleType) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      'simtool_monitor_target',
      JSON.stringify({ systemId, module }),
    );
  } catch { /* sessionStorage unavailable — proceed without pre-selection */ }
  window.dispatchEvent(
    new CustomEvent('simtool:navigate', { detail: { section: 'monitoring' } }),
  );
}

export function QuickRunPanel() {
  const { configs } = useConfigs();
  const { systems } = useSystems();

  const [module, setModule] = useState<ModuleType>('enb');
  const [configId, setConfigId] = useState<string>('');
  const [systemId, setSystemId] = useState<string>('');

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecutionStep | null>(null);

  // Filter configs by selected module. Reset config pick when module changes
  // since the previous selection won't be in the new list anyway.
  const moduleConfigs = useMemo(
    () => (configs?.[module] ?? []),
    [configs, module],
  );
  useEffect(() => { setConfigId(''); setResult(null); }, [module]);

  // Auto-pick first system on mount so the dropdown isn't empty.
  useEffect(() => {
    if (!systemId && systems.length > 0) setSystemId(String(systems[0].id));
  }, [systems, systemId]);

  const selectedSystem = systems.find(s => String(s.id) === systemId);
  const selectedConfig = moduleConfigs.find(c => c.id === configId);

  const canRun =
    !!selectedSystem &&
    !!selectedConfig &&
    !!selectedConfig.content &&
    !running;

  const handleRun = async () => {
    if (!canRun || !selectedSystem || !selectedConfig) return;
    setRunning(true);
    setResult(null);
    try {
      // Pre-flight credential check — same shape as the Scenario runner so
      // errors look the same regardless of which path the user took.
      if (!selectedSystem.username || (!selectedSystem.password && !selectedSystem.privateKey)) {
        setResult({
          id: `${module}-${Date.now()}`,
          name: `Deploy ${module}`,
          status: 'failure',
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          error: `System "${selectedSystem.name}" has no SSH credentials. Edit it in Test Systems before running.`,
        });
        return;
      }

      const step = await executionService.deployModule(module, selectedConfig.content, {
        host: selectedSystem.ip,
        port: selectedSystem.sshPort ?? 22,
        username: selectedSystem.username,
        ...(selectedSystem.authMode === 'privateKey' && selectedSystem.privateKey
          ? { privateKey: selectedSystem.privateKey }
          : { password: selectedSystem.password ?? '' }),
      });
      step.name = `Deploy ${module} (${selectedConfig.name})`;
      setResult(step);
    } catch (err) {
      setResult({
        id: `${module}-${Date.now()}`,
        name: `Deploy ${module}`,
        status: 'failure',
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setRunning(false);
    }
  };

  // ─── Empty state when there are no systems yet ─────────────────────────
  if (systems.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <h3 className="text-lg font-semibold">No systems configured</h3>
          <p className="text-sm text-muted-foreground">
            Add a Callbox in <span className="font-medium">Test Systems</span> first,
            then come back here to deploy a config to it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quick Run</CardTitle>
          <p className="text-sm text-muted-foreground">
            Deploy a single config to a system and watch live stats. Use this
            when the core (MME/IMS) is already running and you just want to
            swap the radio config.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Module */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Module</Label>
              <Select value={module} onValueChange={(v) => setModule(v as ModuleType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULES.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Config */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Config{' '}
                <span className="opacity-60">
                  ({moduleConfigs.length} available)
                </span>
              </Label>
              <Select
                value={configId}
                onValueChange={setConfigId}
                disabled={moduleConfigs.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    moduleConfigs.length === 0
                      ? `No ${module} configs — create one in Test Configurations`
                      : 'Pick a config'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {moduleConfigs.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* System */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">System</Label>
              <Select value={systemId} onValueChange={setSystemId}>
                <SelectTrigger><SelectValue placeholder="Pick a system" /></SelectTrigger>
                <SelectContent>
                  {systems.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} <span className="text-muted-foreground">({s.ip})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Run + view-stats actions */}
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleRun} disabled={!canRun} size="lg">
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deploying…
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Run
                </>
              )}
            </Button>

            {result?.status === 'success' && RADIO_MODULES.includes(module) && (
              <Button
                variant="outline"
                onClick={() => navigateToMonitoring(systemId, module)}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View live stats →
              </Button>
            )}

            {selectedSystem && (
              <span className="text-xs text-muted-foreground ml-auto">
                Target: <span className="font-mono">{selectedSystem.name}</span>
                {' '}({selectedSystem.ip})
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result panel */}
      {result && (
        <Alert variant={result.status === 'success' ? 'default' : 'destructive'}>
          {result.status === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle className="flex items-center gap-2">
            {result.status === 'success' ? 'Deployed' : 'Deploy failed'}
            {result.duration != null && (
              <Badge variant="outline" className="text-[10px]">
                {result.duration.toFixed(1)}s
              </Badge>
            )}
          </AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{result.name}</p>
            {result.error && (
              <p className="font-mono text-xs">{result.error}</p>
            )}
            {result.status === 'success' && !RADIO_MODULES.includes(module) && (
              <p className="text-xs opacity-80">
                {module} is now running with <span className="font-mono">{selectedConfig?.name}</span>.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

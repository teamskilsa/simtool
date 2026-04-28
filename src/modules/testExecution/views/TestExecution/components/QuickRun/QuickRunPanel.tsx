// Quick Run — the simple "I just want to run an enb.cfg on my callbox" path.
//
// Most callbox users have the core (MME/IMS/UE_DB) already running and just
// want to swap the eNB or gNB config and watch KPIs. That's a totally
// different mental model from the multi-component Scenarios flow, so it
// lives in its own tab with a deliberately tiny surface — and a visible
// 3-step header that makes the workflow obvious without having to read
// any prose:
//
//   ① What    — module + config
//   ② Where   — target system
//   ③ Run     — kicks off SCP + service restart over SSH
//
// On success for a radio module we hand the user off to the Stats screen
// with the system+module pre-selected — explicitly via a "View live stats"
// button, AND automatically after a 5-second countdown that the user can
// cancel if they want to read the success details first.
//
// Internally this calls executionService.deployModule() with the same API
// the multi-step Scenario runner uses, so the SSH/restart/port-probe path
// is identical — there's no second copy of "how to deploy".

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  PlayCircle, Loader2, CheckCircle2, AlertCircle, BarChart3,
} from 'lucide-react';
import { useConfigs } from '@/modules/testExecution/context/ConfigContext/ConfigContext';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import { executionService } from '@/modules/testExecution/services';
import type { ExecutionStep } from '@/modules/testExecution/types/execution.types';
import type { ModuleType } from '@/lib/storage/config';

// Modules a user can deploy. eNB first because that's the 80% case.
const MODULES: Array<{ id: ModuleType; label: string }> = [
  { id: 'enb',   label: 'eNB (LTE)'   },
  { id: 'gnb',   label: 'gNB (5G NR)' },
  { id: 'mme',   label: 'MME / EPC'   },
  { id: 'ims',   label: 'IMS'         },
  { id: 'ue_db', label: 'UE Database' },
];

// Modules with KPIs worth viewing post-run. UE-DB is just a subscriber list.
const RADIO_MODULES: Array<ModuleType> = ['enb', 'gnb'];

// How long to wait before auto-jumping to Stats after a successful radio
// deploy. Long enough that the user can read the success line and press
// Cancel if they don't want it.
const AUTO_JUMP_SECONDS = 5;

/**
 * Hand off to the monitoring dashboard with a pre-selected target. The
 * dashboard reads sessionStorage on mount and pops directly into the right
 * system + module so the user doesn't have to re-pick.
 */
function navigateToStats(systemId: string, module: ModuleType) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      'simtool_monitor_target',
      JSON.stringify({ systemId, module }),
    );
  } catch { /* sessionStorage unavailable — proceed without pre-selection */ }
  window.dispatchEvent(
    new CustomEvent('simtool:navigate', { detail: { section: 'stats' } }),
  );
}

// ─── Step header ───────────────────────────────────────────────────────────
function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'What',  hint: 'Module + config' },
    { n: 2, label: 'Where', hint: 'Target system' },
    { n: 3, label: 'Run',   hint: 'Deploy + restart' },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors',
                done   && 'bg-emerald-500 text-white',
                active && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                !done && !active && 'bg-muted text-muted-foreground',
              )}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : s.n}
              </div>
              <div className="leading-tight">
                <div className={cn(
                  'text-sm font-medium',
                  (done || active) ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {s.label}
                </div>
                <div className="text-[11px] text-muted-foreground">{s.hint}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                'flex-1 h-px mx-2 transition-colors',
                step > s.n ? 'bg-emerald-500/60' : 'bg-muted',
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function QuickRunPanel() {
  const { configs, refreshConfigs } = useConfigs();
  const { systems } = useSystems();

  // The testExecution ConfigProvider mounts at app-startup and only loads
  // once. A user might create or import a config in Test Configurations
  // and immediately come here via the "Deploy now →" handoff — refresh
  // on mount so the new file shows up in the Config dropdown without a
  // page reload.
  useEffect(() => {
    refreshConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [module, setModule] = useState<ModuleType>('enb');
  const [configId, setConfigId] = useState<string>('');
  const [systemId, setSystemId] = useState<string>('');

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecutionStep | null>(null);

  // Auto-jump countdown state. null = no jump scheduled. Decrements 5→0.
  const [autoJumpIn, setAutoJumpIn] = useState<number | null>(null);
  const autoJumpTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelAutoJump = () => {
    if (autoJumpTimer.current) clearInterval(autoJumpTimer.current);
    autoJumpTimer.current = null;
    setAutoJumpIn(null);
  };
  // Cleanup on unmount.
  useEffect(() => () => cancelAutoJump(), []);

  // Filter configs by module. Reset config + result when module changes.
  const moduleConfigs = useMemo(
    () => (configs?.[module] ?? []),
    [configs, module],
  );
  useEffect(() => { setConfigId(''); setResult(null); cancelAutoJump(); }, [module]);

  // Auto-pick first system on mount.
  useEffect(() => {
    if (!systemId && systems.length > 0) setSystemId(String(systems[0].id));
  }, [systems, systemId]);

  // Build → Run handoff. If Test Configurations / Create Test just sent
  // us here via the "Deploy now →" toast action, pre-select the matching
  // module + config so the user lands on Step 3 (Run) ready to click.
  // One-shot: clear the hint immediately so a later manual nav doesn't
  // re-apply a stale selection.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem('simtool_quickrun_target');
    if (!raw) return;
    window.sessionStorage.removeItem('simtool_quickrun_target');
    try {
      const hint = JSON.parse(raw) as { module?: ModuleType; configName?: string };
      if (hint.module && MODULES.some(m => m.id === hint.module)) {
        setModule(hint.module);
      }
      // Defer config-id pick to a follow-up effect (we may not have configs
      // loaded yet at this exact moment); store the name and resolve below.
      if (hint.configName) {
        (window as any).__simtool_pending_config_name = hint.configName;
      }
    } catch { /* malformed — ignore */ }
  }, []);

  // Resolve a pending config name (from the handoff above) once the configs
  // for the current module have actually loaded.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pending: string | undefined = (window as any).__simtool_pending_config_name;
    if (!pending || moduleConfigs.length === 0) return;
    const match = moduleConfigs.find(c => c.name === pending);
    if (match) {
      setConfigId(match.id);
      delete (window as any).__simtool_pending_config_name;
    }
  }, [moduleConfigs]);

  const selectedSystem = systems.find(s => String(s.id) === systemId);
  const selectedConfig = moduleConfigs.find(c => c.id === configId);

  // Drive the step indicator from current state.
  const currentStep: 1 | 2 | 3 =
    !configId ? 1 :
    !systemId ? 2 :
    3;

  const canRun =
    !!selectedSystem &&
    !!selectedConfig &&
    !!selectedConfig.content &&
    !running;

  const handleRun = async () => {
    if (!canRun || !selectedSystem || !selectedConfig) return;
    setRunning(true);
    setResult(null);
    cancelAutoJump();
    try {
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

      // ─── Auto-jump to Stats on radio-module success ────────────────────
      // The user just deployed the radio config — the obvious next thing
      // they want is to watch KPIs. Start a countdown so it happens
      // automatically without forcing them to find a button. Cancellable.
      if (step.status === 'success' && RADIO_MODULES.includes(module)) {
        let n = AUTO_JUMP_SECONDS;
        setAutoJumpIn(n);
        autoJumpTimer.current = setInterval(() => {
          n -= 1;
          if (n <= 0) {
            cancelAutoJump();
            navigateToStats(systemId, module);
          } else {
            setAutoJumpIn(n);
          }
        }, 1000);
      }
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
        <CardContent className="pt-6 space-y-6">
          <StepHeader step={currentStep} />

          {/* ─── Step 1: What — module + config ──────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* ─── Step 2: Where — system ──────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Target system</Label>
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

          {/* ─── Step 3: Run ─────────────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-2 border-t">
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

            {selectedSystem && selectedConfig && (
              <span className="text-xs text-muted-foreground">
                Will deploy <span className="font-mono">{selectedConfig.name}</span>
                {' → '}
                <span className="font-mono">{selectedSystem.name}</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Result panel ─────────────────────────────────────────────── */}
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
          <AlertDescription className="space-y-2">
            <p>{result.name}</p>
            {result.error && (
              <p className="font-mono text-xs">{result.error}</p>
            )}

            {result.status === 'success' && RADIO_MODULES.includes(module) && (
              <div className="flex items-center gap-3 pt-1">
                <Button
                  size="sm"
                  onClick={() => { cancelAutoJump(); navigateToStats(systemId, module); }}
                >
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                  View live stats →
                </Button>
                {autoJumpIn !== null && (
                  <>
                    <span className="text-xs opacity-80">
                      Auto-opening in {autoJumpIn}s…
                    </span>
                    <Button size="sm" variant="ghost" onClick={cancelAutoJump}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            )}

            {result.status === 'success' && !RADIO_MODULES.includes(module) && (
              <p className="text-xs opacity-80">
                {module} is now running with{' '}
                <span className="font-mono">{selectedConfig?.name}</span>.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

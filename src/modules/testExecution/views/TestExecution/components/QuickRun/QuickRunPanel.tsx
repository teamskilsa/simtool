// Quick Run — the simple "I just want to run an enb.cfg on my callbox" path.
//
// Most callbox users have the core (MME/IMS/UE_DB) already running and just
// want to swap the eNB or gNB config and watch KPIs. Two selects + a button:
//
//   1. Pick a config    (every saved config across all modules; module is
//                        a property of the config so we don't ask the user
//                        to pick it twice)
//   2. Pick a system    (from Test Systems)
//   3. Click Run        (SCP + service restart over SSH)
//
// On success for a radio module (eNB/gNB) we hand the user off to the Stats
// screen with the system+module pre-selected — explicitly via a "View live
// stats" button, and automatically after a 5-second countdown that the user
// can cancel if they want to read the success details first.
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
  PlayCircle, Loader2, CheckCircle2, AlertCircle, BarChart3, Copy, Download,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useConfigs } from '@/modules/testExecution/context/ConfigContext/ConfigContext';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import { executionService } from '@/modules/testExecution/services';
import type { ExecutionStep } from '@/modules/testExecution/types/execution.types';
import type { ModuleType } from '@/lib/storage/config';
import type { StoredConfig } from '@/lib/storage/storage.types';

// Friendly labels for the module badge shown next to each config name.
const MODULE_LABEL: Record<ModuleType, string> = {
  enb:   'eNB',
  gnb:   'gNB',
  mme:   'MME',
  ims:   'IMS',
  ue_db: 'UE-DB',
};

// Modules with KPIs worth viewing post-run. UE-DB is just a subscriber list.
const RADIO_MODULES: ModuleType[] = ['enb', 'gnb'];

/**
 * True when the file is an Amarisoft *dependency* file, not a deployable
 * top-level config. Examples: drb.cfg / drb_nr.cfg (data radio bearer
 * defs included by enb.cfg via `drb_config`), sib*.asn (system info
 * blocks), rrc_nr.cfg (RRC ASN.1 includes). These would silently
 * overwrite the wrong target file if a user picked them in Quick Run, so
 * we hide them from the dropdown.
 */
const DEPENDENCY_NAME_RE = /^(drb|sib|rrc[_-]?nr|fapi)/i;
const isDependencyFile = (name: string) => DEPENDENCY_NAME_RE.test(name);

// How long to wait before auto-jumping to Stats after a successful radio
// deploy. Long enough that the user can read the success line and press
// Cancel if they don't want it.
const AUTO_JUMP_SECONDS = 5;

/**
 * Build a self-contained plain-text deploy report from an ExecutionStep
 * plus context. The receiver of this report (an ops engineer in Slack,
 * a vendor support inbox, etc.) needs to understand what happened
 * without any reference to the running app — so we include target host,
 * module, config name, timestamps, the high-level error, and the full
 * per-command log with stdout/stderr.
 *
 * Format is plain text (not JSON) because that's what people paste into
 * tickets and read in dumb terminal viewers.
 */
function formatReport(
  result: ExecutionStep,
  ctx: { systemName?: string; systemHost?: string; configName?: string; module?: string | null },
): string {
  const lines: string[] = [];
  const ts = (d?: Date) => (d instanceof Date ? d.toISOString() : new Date().toISOString());

  lines.push('SimTool Deploy Report');
  lines.push('='.repeat(60));
  lines.push(`Status      : ${result.status.toUpperCase()}`);
  if (result.duration != null) lines.push(`Duration    : ${result.duration.toFixed(1)} s`);
  lines.push(`Started     : ${ts(result.startTime)}`);
  lines.push(`Finished    : ${ts(result.endTime)}`);
  lines.push('');
  lines.push(`Target      : ${ctx.systemName ?? '(unknown)'}${ctx.systemHost ? ` (${ctx.systemHost})` : ''}`);
  lines.push(`Module      : ${ctx.module ?? '(unknown)'}`);
  lines.push(`Config      : ${ctx.configName ?? '(unknown)'}`);
  lines.push(`Step name   : ${result.name}`);
  if (result.phase) lines.push(`Failed phase: ${result.phase}`);
  lines.push('');
  if (result.error) {
    lines.push('Error');
    lines.push('-'.repeat(60));
    lines.push(result.error);
    lines.push('');
  }
  if (result.output) {
    lines.push('Service output (tail)');
    lines.push('-'.repeat(60));
    lines.push(result.output);
    lines.push('');
  }
  if (result.commandLog && result.commandLog.length > 0) {
    lines.push('Command log');
    lines.push('-'.repeat(60));
    for (let i = 0; i < result.commandLog.length; i++) {
      const e = result.commandLog[i];
      const mark = e.ok ? '✓' : '✗';
      const meta = [
        typeof e.code === 'number' ? `exit=${e.code}` : null,
        typeof e.ms === 'number'   ? `${e.ms}ms`      : null,
      ].filter(Boolean).join(' ');
      lines.push(`[${i + 1}] ${mark} ${e.step}${meta ? `  (${meta})` : ''}`);
      if (e.cmd)    lines.push(`    $ ${e.cmd}`);
      if (e.stdout) lines.push(e.stdout.split('\n').map(l => `    ${l}`).join('\n'));
      if (e.stderr) lines.push(e.stderr.split('\n').map(l => `    [stderr] ${l}`).join('\n'));
      lines.push('');
    }
  }
  lines.push(`Generated   : ${ts(new Date())} by SimTool`);
  return lines.join('\n');
}

/**
 * Build a stable filename for a saved report. Includes the deploy module
 * + config name + UTC date so multiple reports sort sensibly in a ticket
 * inbox.
 */
function reportFilename(ctx: { configName?: string; module?: string | null; status: string }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2026-04-28T15-23-45
  const slug = (ctx.configName || 'deploy')
    .replace(/\.cfg$/i, '')
    .replace(/[^\w.-]+/g, '_');
  return `simtool-deploy-${ctx.status}-${ctx.module ?? 'unknown'}-${slug}-${stamp}.txt`;
}

function downloadText(filename: string, body: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Slight delay before revoke so Safari finishes the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
    { n: 1, label: 'Pick config',  hint: 'Saved cfg file to deploy' },
    { n: 2, label: 'Pick system',  hint: 'Where to run it' },
    { n: 3, label: 'Run',          hint: 'Deploy + restart' },
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
  const { toast } = useToast();

  // The testExecution ConfigProvider mounts at app-startup and only loads
  // once. A user might create or import a config in Test Configurations
  // and immediately come here via the "Deploy now →" handoff — refresh
  // on mount so the new file shows up in the dropdown without a reload.
  useEffect(() => {
    refreshConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [configId, setConfigId] = useState<string>('');
  const [systemId, setSystemId] = useState<string>('');

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecutionStep | null>(null);

  // Auto-jump countdown state. null = no jump scheduled.
  const [autoJumpIn, setAutoJumpIn] = useState<number | null>(null);
  const autoJumpTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelAutoJump = () => {
    if (autoJumpTimer.current) clearInterval(autoJumpTimer.current);
    autoJumpTimer.current = null;
    setAutoJumpIn(null);
  };
  useEffect(() => () => cancelAutoJump(), []);

  // Flatten all configs across modules into a single list so the dropdown
  // shows every saved cfg in one place. Each entry carries the module so
  // we can both badge it in the UI and use it as the deploy target.
  const allConfigs = useMemo(() => {
    if (!configs) return [] as Array<StoredConfig & { module: ModuleType }>;
    const out: Array<StoredConfig & { module: ModuleType }> = [];
    for (const m of Object.keys(configs) as ModuleType[]) {
      for (const c of configs[m] ?? []) {
        // Skip dependency files (drb*.cfg, sib*.asn, etc.) — they're
        // included by the main cfg, not deployed standalone.
        if (isDependencyFile(c.name)) continue;
        out.push({ ...c, module: m });
      }
    }
    // Sort: radio modules first (most common deploy target), then alpha.
    return out.sort((a, b) => {
      const ar = RADIO_MODULES.includes(a.module) ? 0 : 1;
      const br = RADIO_MODULES.includes(b.module) ? 0 : 1;
      if (ar !== br) return ar - br;
      return a.name.localeCompare(b.name);
    });
  }, [configs]);

  // Build → Run handoff from Create Test's "Deploy now →" toast. Sets a
  // sessionStorage hint with the just-saved configName; once the configs
  // load we resolve it to an id and pre-select. One-shot.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem('simtool_quickrun_target');
    if (!raw) return;
    window.sessionStorage.removeItem('simtool_quickrun_target');
    try {
      const hint = JSON.parse(raw) as { configName?: string };
      if (hint.configName) {
        (window as any).__simtool_pending_config_name = hint.configName;
      }
    } catch { /* malformed — ignore */ }
  }, []);

  // Resolve the pending config name once configs are loaded.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pending: string | undefined = (window as any).__simtool_pending_config_name;
    if (!pending || allConfigs.length === 0) return;
    const match = allConfigs.find(c => c.name === pending);
    if (match) {
      setConfigId(match.id);
      delete (window as any).__simtool_pending_config_name;
    }
  }, [allConfigs]);

  // Auto-pick first system on mount.
  useEffect(() => {
    if (!systemId && systems.length > 0) setSystemId(String(systems[0].id));
  }, [systems, systemId]);

  const selectedConfig = allConfigs.find(c => c.id === configId);
  const selectedSystem = systems.find(s => String(s.id) === systemId);
  // Derive the module from the selected config — no separate picker needed.
  const module: ModuleType | null = selectedConfig?.module ?? null;

  // Drive the step indicator from current state.
  const currentStep: 1 | 2 | 3 =
    !configId ? 1 :
    !systemId ? 2 :
    3;

  const canRun =
    !!selectedSystem &&
    !!selectedConfig &&
    !!selectedConfig.content &&
    !!module &&
    !running;

  const handleRun = async () => {
    if (!canRun || !selectedSystem || !selectedConfig || !module) return;
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

      // Auto-jump to Stats on radio-module success.
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

          {/* ─── Step 1 — Config (module derived from this pick) ─────── */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Config{' '}
              <span className="opacity-60">
                ({allConfigs.length} available)
              </span>
            </Label>
            <Select
              value={configId}
              onValueChange={setConfigId}
              disabled={allConfigs.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  allConfigs.length === 0
                    ? 'No saved configs — create one in Test Configurations first'
                    : 'Pick a config to deploy'
                } />
              </SelectTrigger>
              <SelectContent>
                {allConfigs.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <Badge
                        variant={RADIO_MODULES.includes(c.module) ? 'default' : 'secondary'}
                        className="text-[10px] uppercase"
                      >
                        {MODULE_LABEL[c.module]}
                      </Badge>
                      <span className="font-mono text-sm">{c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedConfig && (
              <p className="text-[11px] text-muted-foreground">
                {MODULE_LABEL[selectedConfig.module]} config — will deploy to
                {' '}<span className="font-mono">/root/
                {selectedConfig.module === 'mme' || selectedConfig.module === 'ims'
                  ? 'mme'
                  : selectedConfig.module === 'ue_db'
                    ? 'mme'
                    : 'enb'}/config/{selectedConfig.name}</span>
                {' '}and restart the matching service.
              </p>
            )}
          </div>

          {/* ─── Step 2 — Target system ──────────────────────────────── */}
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

          {/* ─── Step 3 — Run ────────────────────────────────────────── */}
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
              <p className="font-mono text-xs whitespace-pre-wrap">{result.error}</p>
            )}
            {result.phase && (
              <p className="text-[11px] opacity-80">
                Failed at phase: <span className="font-mono">{result.phase}</span>
              </p>
            )}

            {/* Share controls — turn the result into something the user
                can paste into a ticket or attach to an email. Available
                for both success and failure since "send the deploy log
                to ops" is a common pattern even on success. */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={async () => {
                  const txt = formatReport(result, {
                    systemName: selectedSystem?.name,
                    systemHost: selectedSystem?.ip,
                    configName: selectedConfig?.name,
                    module: module ? MODULE_LABEL[module] : null,
                  });
                  try {
                    await navigator.clipboard.writeText(txt);
                    toast({ title: 'Copied report', description: 'Paste it into a ticket / Slack / email.' });
                  } catch {
                    // Fallback if clipboard API isn't available (e.g. http context)
                    downloadText(reportFilename({
                      configName: selectedConfig?.name,
                      module,
                      status: result.status,
                    }), txt);
                    toast({ title: 'Downloaded report', description: 'Clipboard unavailable — saved as file instead.' });
                  }
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy report
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => {
                  const txt = formatReport(result, {
                    systemName: selectedSystem?.name,
                    systemHost: selectedSystem?.ip,
                    configName: selectedConfig?.name,
                    module: module ? MODULE_LABEL[module] : null,
                  });
                  downloadText(reportFilename({
                    configName: selectedConfig?.name,
                    module,
                    status: result.status,
                  }), txt);
                }}
              >
                <Download className="w-3 h-3 mr-1" />
                Download .txt
              </Button>
            </div>

            {/* Command log — collapsed by default. The phase + error line
                above answers most "why" questions, but for the trickier
                failures (sudo password prompt, exotic Amarisoft errors)
                the full per-command stderr is the only thing that
                actually pins down the cause. Show as a <details> so it
                doesn't shout when it's not needed. */}
            {result.commandLog && result.commandLog.length > 0 && (
              <details className="text-[11px]">
                <summary className="cursor-pointer opacity-80 hover:opacity-100">
                  Show details ({result.commandLog.length} step{result.commandLog.length === 1 ? '' : 's'})
                </summary>
                <div className="mt-2 space-y-2 pl-2 border-l border-current/30">
                  {result.commandLog.map((entry, i) => (
                    <div key={i} className="font-mono text-[11px] leading-snug">
                      <div className="flex items-baseline gap-2">
                        <span className={cn(entry.ok ? 'text-emerald-600' : 'text-destructive')}>
                          {entry.ok ? '✓' : '✗'}
                        </span>
                        <span className="font-semibold">{entry.step}</span>
                        {typeof entry.code === 'number' && (
                          <span className="opacity-60">exit={entry.code}</span>
                        )}
                        {typeof entry.ms === 'number' && (
                          <span className="opacity-60">{entry.ms}ms</span>
                        )}
                      </div>
                      {entry.cmd && (
                        <pre className="opacity-70 whitespace-pre-wrap break-all pl-4">$ {entry.cmd}</pre>
                      )}
                      {entry.stdout && (
                        <pre className="opacity-90 whitespace-pre-wrap break-all pl-4">{entry.stdout}</pre>
                      )}
                      {entry.stderr && (
                        <pre className="text-destructive whitespace-pre-wrap break-all pl-4">{entry.stderr}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {result.status === 'success' && module && RADIO_MODULES.includes(module) && (
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

            {result.status === 'success' && module && !RADIO_MODULES.includes(module) && (
              <p className="text-xs opacity-80">
                {MODULE_LABEL[module]} is now running with{' '}
                <span className="font-mono">{selectedConfig?.name}</span>.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

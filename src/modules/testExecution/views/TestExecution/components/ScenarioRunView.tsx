// views/TestExecution/components/ScenarioRunView.tsx
//
// Full-page progress view for a scenario run. Replaces the scenario list
// while a run is in flight so the user watches the deploy happen instead of
// staring at a spinning Run button and then getting a toast.
//
// The important property: every step of the topology is listed from the
// start (pending → running → success/failure), so when something breaks it
// is obvious WHICH step broke and which ones never ran.
'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  MinusCircle,
  Copy,
  Download,
  RotateCcw,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExecutionStep, ExecutionStatus } from '@/modules/testExecution/types/execution.types';

interface RunTarget {
  name: string;
  host: string;
}

interface ScenarioRunViewProps {
  scenarioName: string;
  topology: string;
  target?: RunTarget;
  steps: ExecutionStep[];
  isRunning: boolean;
  /** Set when the run never got as far as producing steps (e.g. pre-flight
   *  failure, network error fetching the scenario). */
  fatalError?: string | null;
  onBack: () => void;
  onRetry: () => void;
}

// ─── Per-status presentation ────────────────────────────────────────────────
const STATUS_META: Record<ExecutionStatus, {
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  label: string;
}> = {
  pending: { icon: Circle, className: 'text-muted-foreground/50', label: 'Pending' },
  running: { icon: Loader2, className: 'text-primary animate-spin', label: 'Running' },
  success: { icon: CheckCircle2, className: 'text-emerald-600', label: 'Done' },
  failure: { icon: XCircle, className: 'text-destructive', label: 'Failed' },
  skipped: { icon: MinusCircle, className: 'text-muted-foreground/40', label: 'Not run' },
};

/** Plain-text report of the whole run — paste into a ticket or Slack. */
function formatRunReport(
  scenarioName: string,
  topology: string,
  target: RunTarget | undefined,
  steps: ExecutionStep[],
): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push(`Scenario run report: ${scenarioName}`);
  lines.push('='.repeat(60));
  lines.push(`Topology : ${topology}`);
  if (target) lines.push(`Target   : ${target.name} (${target.host})`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  steps.forEach((s, i) => {
    lines.push(`--- Step ${i + 1}/${steps.length}: ${s.name}`);
    lines.push(`    status  : ${s.status}`);
    if (s.duration != null) lines.push(`    duration: ${s.duration.toFixed(2)}s`);
    if (s.phase) lines.push(`    phase   : ${s.phase}`);
    if (s.error) lines.push(`    error   : ${s.error}`);
    if (s.output) {
      lines.push('    output  :');
      s.output.split('\n').forEach(l => lines.push(`      ${l}`));
    }
    if (s.commandLog?.length) {
      lines.push('    commands:');
      s.commandLog.forEach(e => {
        lines.push(`      [${e.ok ? 'ok' : 'FAIL'}] ${e.step}${e.code != null ? ` (exit ${e.code})` : ''}`);
        if (e.cmd) lines.push(`        $ ${e.cmd}`);
        if (e.stdout?.trim()) lines.push(`        out: ${e.stdout.trim().slice(0, 500)}`);
        if (e.stderr?.trim()) lines.push(`        err: ${e.stderr.trim().slice(0, 500)}`);
      });
    }
    lines.push('');
  });
  return lines.join('\n');
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ScenarioRunView({
  scenarioName,
  topology,
  target,
  steps,
  isRunning,
  fatalError,
  onBack,
  onRetry,
}: ScenarioRunViewProps) {
  const { toast } = useToast();

  const failedIndex = steps.findIndex(s => s.status === 'failure');
  const doneCount = steps.filter(s => s.status === 'success').length;
  const totalElapsed = useMemo(
    () => steps.reduce((sum, s) => sum + (s.duration ?? 0), 0),
    [steps],
  );

  const overall: 'running' | 'failed' | 'done' | 'idle' =
    fatalError ? 'failed'
      : isRunning ? 'running'
        : failedIndex >= 0 ? 'failed'
          : steps.length > 0 && doneCount === steps.length ? 'done'
            : 'idle';

  const banner = {
    running: {
      cls: 'border-primary/30 bg-primary/5',
      title: `Running — step ${Math.min(doneCount + 1, steps.length)} of ${steps.length}`,
      body: 'Deploying configs over SSH. Leave this page open to watch progress.',
    },
    failed: {
      cls: 'border-destructive/30 bg-destructive/5',
      title: fatalError
        ? 'Run could not start'
        : `Failed at step ${failedIndex + 1} of ${steps.length} — ${steps[failedIndex]?.name ?? ''}`,
      body: fatalError ?? steps[failedIndex]?.error ?? 'See the failing step below for details.',
    },
    done: {
      cls: 'border-emerald-600/30 bg-emerald-600/5',
      title: `Completed — all ${steps.length} step${steps.length === 1 ? '' : 's'} succeeded`,
      body: `Total deploy time ${totalElapsed.toFixed(1)}s.`,
    },
    idle: { cls: 'border-border bg-muted/30', title: 'Preparing run…', body: 'Resolving scenario and configs.' },
  }[overall];

  const report = () => formatRunReport(scenarioName, topology, target, steps);

  return (
    <div className="space-y-4">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 h-7 text-xs text-muted-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to scenarios
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-foreground truncate">{scenarioName}</h2>
            <Badge variant="outline">{topology}</Badge>
          </div>
          {target && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              {target.name} <span className="font-mono text-xs">({target.host})</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isRunning && steps.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(report());
                    toast({ title: 'Copied report', description: 'Paste it into a ticket or Slack.' });
                  } catch {
                    downloadText(`${scenarioName}-run.txt`, report());
                    toast({ title: 'Downloaded report', description: 'Clipboard unavailable — saved as a file.' });
                  }
                }}
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadText(`${scenarioName}-run.txt`, report())}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                .txt
              </Button>
            </>
          )}
          {!isRunning && (
            <Button size="sm" onClick={onRetry}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Run again
            </Button>
          )}
        </div>
      </div>

      {/* ─── Status banner ───────────────────────────────────────────── */}
      <div className={cn('rounded-xl border px-4 py-3', banner.cls)}>
        <p className="text-sm font-medium text-foreground">{banner.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{banner.body}</p>
      </div>

      {/* ─── Steps ───────────────────────────────────────────────────── */}
      {steps.length > 0 && (
        <Card>
          <CardContent className="p-0">
            {steps.map((step, i) => {
              const meta = STATUS_META[step.status];
              const Icon = meta.icon;
              const isFailed = step.status === 'failure';
              return (
                <div
                  key={step.id}
                  className={cn(
                    'px-4 py-3 border-b border-border/60 last:border-0',
                    isFailed && 'bg-destructive/5',
                    step.status === 'skipped' && 'opacity-60',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <span className="text-xs font-mono text-muted-foreground w-4 text-right">
                        {i + 1}
                      </span>
                      <Icon className={cn('w-4 h-4', meta.className)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'text-sm',
                          isFailed ? 'font-medium text-destructive' : 'text-foreground',
                        )}>
                          {step.name}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                        {step.duration != null && step.status !== 'skipped' && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {step.duration.toFixed(1)}s
                          </span>
                        )}
                      </div>

                      {step.description && step.status === 'pending' && (
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      )}

                      {/* Failure detail — the whole point of this view. */}
                      {isFailed && (
                        <div className="mt-2 space-y-1.5">
                          {step.phase && (
                            <p className="text-xs">
                              <span className="text-muted-foreground">Failed at phase: </span>
                              <span className="font-mono text-destructive">{step.phase}</span>
                            </p>
                          )}
                          {step.error && (
                            <pre className="text-xs font-mono whitespace-pre-wrap text-destructive bg-destructive/5 rounded-md p-2 border border-destructive/20">
                              {step.error}
                            </pre>
                          )}
                          {step.output && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Service output
                              </summary>
                              <pre className="mt-1 font-mono text-[11px] whitespace-pre-wrap bg-muted/50 rounded-md p-2 overflow-x-auto">
                                {step.output}
                              </pre>
                            </details>
                          )}
                          {step.commandLog && step.commandLog.length > 0 && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Show commands ({step.commandLog.length})
                              </summary>
                              <div className="mt-1.5 space-y-1.5 pl-2 border-l border-border">
                                {step.commandLog.map((e, k) => (
                                  <div key={k} className="font-mono text-[11px] leading-snug">
                                    <div className="flex items-baseline gap-2">
                                      <span className={e.ok ? 'text-emerald-600' : 'text-destructive'}>
                                        {e.ok ? '✓' : '✗'}
                                      </span>
                                      <span className="text-foreground">{e.step}</span>
                                      {e.code != null && (
                                        <span className="text-muted-foreground">exit {e.code}</span>
                                      )}
                                      {e.ms != null && (
                                        <span className="text-muted-foreground">{e.ms}ms</span>
                                      )}
                                    </div>
                                    {e.cmd && (
                                      <div className="text-muted-foreground pl-4 break-all">$ {e.cmd}</div>
                                    )}
                                    {e.stderr?.trim() && (
                                      <div className="text-destructive pl-4 whitespace-pre-wrap">
                                        {e.stderr.trim().slice(0, 400)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

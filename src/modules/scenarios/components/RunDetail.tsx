// One Mobility Scenario run: summary tiles, preflight, step timeline, asserts,
// metrics, teardown and the raw event log. Used live (Run tab) and for saved
// runs (History tab).
'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, Loader2, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Kicker, Stat } from '@/components/ui/stat';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { RunState, RunView, StepStatus } from '../types';
import { statsOf, verdictLine } from '../lib/cellLabel';

export const STATE_VARIANT: Record<RunState, 'success' | 'destructive' | 'warning' | 'secondary' | 'default'> = {
  passed: 'success', failed: 'destructive', error: 'destructive', aborted: 'warning', inconclusive: 'warning',
  running: 'default', preflight: 'secondary', teardown: 'secondary',
};

const STEP_ICON: Record<StepStatus, JSX.Element> = {
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />,
  passed: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
  failed: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  warned: <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
  skipped: <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />,
};

export const fmtMs = (ms?: number) => (ms === undefined ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : ms < 120_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`);
const time = (t: number) => new Date(t).toLocaleTimeString([], { hour12: false });

export const metricSummary = (run: Pick<RunView, 'metrics'>) => statsOf(run.metrics);

export function RunDetail({ run, live = false }: { run: RunView; live?: boolean }) {
  const [showDebug, setShowDebug] = useState(false);
  const [tab, setTab] = useState<'timeline' | 'asserts' | 'events'>('timeline');
  const metrics = useMemo(() => metricSummary(run), [run]);
  const elapsed = (run.endedAt ?? Date.now()) - run.startedAt;
  const current = [...run.steps].reverse().find(s => s.status === 'running');
  const phoneSkipped = run.steps.filter(s => s.status === 'skipped' && s.detail === 'no phone selected').length;
  const badChecks = run.preflight.filter(c => !c.ok);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="State" value={<Badge variant={STATE_VARIANT[run.state]} className="text-sm">{run.state}</Badge>}
          hint={run.error ? run.error : live && current ? `step ${current.path}: ${current.label}` : `${run.scenarioName}`} />
        <Stat label="Asserts" value={`${run.asserts.passed}/${run.asserts.total}`}
          tone={run.asserts.failed ? 'bad' : run.asserts.total ? 'good' : 'default'}
          hint={`${run.asserts.failed} failed · ${run.asserts.warned} warned (optional)`} />
        <Stat label="Duration" value={fmtMs(elapsed)} hint={`started ${new Date(run.startedAt).toLocaleString()}`} />
        <Stat label="Target" value={run.systemName || run.host}
          hint={`${run.host} · IMSI ${run.imsi}${run.phoneSerial ? ` · phone ${run.phoneSerial}` : ' · no phone'}`} />
      </div>

      {(badChecks.length > 0 || run.notes.length > 0 || phoneSkipped > 0) && (
        <Card className="space-y-1 p-3 text-xs">
          {badChecks.map(c => (
            <div key={c.name} className={cn('flex gap-2', c.level === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400')}>
              {c.level === 'error' ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <span><b>{c.name}:</b> {c.detail}</span>
            </div>
          ))}
          {phoneSkipped > 0 && (
            <div className="text-muted-foreground">
              No phone was plugged in, so {phoneSkipped} optional phone step(s) were skipped — the background ping and its loss
              figure. The handover timings below come from the callbox and are unaffected.
            </div>
          )}
          {run.notes.filter(n => !/Phone steps were skipped/.test(n)).map(n => <div key={n} className="text-muted-foreground">{n}</div>)}
        </Card>
      )}

      {!live && (run.metrics.length > 0 || run.asserts.total > 0) && (
        <Card className="p-3 text-sm">
          <Kicker className="mb-1">Verdict</Kicker>
          {verdictLine(run)}
        </Card>
      )}

      {metrics.length > 0 && (
        <Card className="p-3">
          <Kicker className="mb-2">Timings</Kicker>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {metrics.map(m => (
              <div key={m.name} className="rounded border border-border px-3 py-2">
                <div className="font-mono text-[11px] text-muted-foreground">{m.name}</div>
                <div className="num text-lg font-semibold">{m.avg.toFixed(m.unit === 'ms' ? 0 : 1)} <span className="text-xs font-normal text-muted-foreground">{m.unit} avg</span></div>
                <div className="num text-[11px] text-muted-foreground">min {m.min} · max {m.max} · n={m.n}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 pt-2">
          {(['timeline', 'asserts', 'events'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('-mb-px border-b-2 px-3 py-1.5 text-sm font-medium', tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t === 'timeline' ? `Steps (${run.steps.length})` : t === 'asserts' ? `Asserts (${run.assertResults.length})` : `Events (${run.events.length})`}
            </button>
          ))}
          {tab === 'events' && (
            <label className="ml-auto flex items-center gap-1 pb-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} /> debug (API messages)
            </label>
          )}
        </div>

        {tab === 'timeline' && (
          <div className="max-h-[420px] overflow-auto p-2 text-xs">
            {run.steps.length === 0 && <div className="p-3 text-muted-foreground">{run.state === 'error' ? 'Refused at preflight.' : 'No steps yet.'}</div>}
            {run.steps.map((s, i) => {
              const depth = s.path.split('/').length - 1;
              return (
                <div key={`${s.path}-${i}`} className={cn('flex items-start gap-2 rounded px-2 py-1', s.status === 'failed' && 'bg-destructive/10', s.status === 'running' && 'bg-primary/5')}
                  style={{ paddingLeft: 8 + depth * 18 }}>
                  <span className="mt-0.5">{STEP_ICON[s.status]}</span>
                  <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">{s.path}</span>
                  <Badge variant="outline" className="h-4 shrink-0 px-1.5 py-0 text-[10px] font-normal">{s.type}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className={cn('font-medium', s.status === 'skipped' && 'text-muted-foreground')}>{s.label}</span>
                    {s.detail && <span className="block break-words text-[11px] text-muted-foreground">{s.detail}</span>}
                  </span>
                  <span className="num shrink-0 text-[11px] text-muted-foreground">{s.endedAt ? fmtMs(s.endedAt - s.startedAt) : '…'}</span>
                </div>
              );
            })}
            {run.teardown.length > 0 && (
              <div className="mt-2 border-t border-border pt-2">
                <Kicker className="mb-1 px-2">Teardown</Kicker>
                {run.teardown.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 px-2 py-0.5">
                    {t.ok ? STEP_ICON.passed : STEP_ICON.failed}
                    <span>{t.what}{t.detail ? <span className="text-muted-foreground"> — {t.detail}</span> : null}</span>
                  </div>
                ))}
              </div>
            )}
            {!live && run.teardown.length === 0 && run.steps.length > 0 && <div className="mt-2 px-2 text-muted-foreground">Teardown: nothing to undo.</div>}
          </div>
        )}

        {tab === 'asserts' && (
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead className="w-24">Step</TableHead><TableHead>Assert</TableHead><TableHead className="w-20">Result</TableHead><TableHead className="w-20 text-right">Took</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {run.assertResults.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-[11px]">{a.path}</TableCell>
                    <TableCell className="text-xs"><div className="font-medium">{a.label}</div><div className="break-words text-[11px] text-muted-foreground">{a.detail}</div></TableCell>
                    <TableCell><Badge variant={a.passed ? 'success' : a.optional ? 'warning' : 'destructive'}>{a.passed ? 'pass' : a.optional ? 'warn' : 'fail'}</Badge></TableCell>
                    <TableCell className="num text-right text-xs">{fmtMs(a.elapsedMs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {tab === 'events' && (
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-snug">
            {run.events.filter(e => showDebug || e.level !== 'debug').map((e, i) => (
              <div key={i} className={cn(e.level === 'error' && 'text-destructive', e.level === 'warn' && 'text-amber-700 dark:text-amber-400', e.level === 'debug' && 'text-muted-foreground')}>
                {time(e.t)} {e.path ? `[${e.path}] ` : ''}{e.msg}
              </div>
            ))}
          </pre>
        )}
      </Card>

      {!live && (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><a href={`/api/scenarios/runs?id=${run.id}&format=csv`}><Download className="mr-1 h-4 w-4" />CSV</a></Button>
          <Button asChild size="sm" variant="outline"><a href={`/api/scenarios/runs?id=${run.id}&format=json`}><Download className="mr-1 h-4 w-4" />JSON</a></Button>
          {run.linkedTest && <span className="self-center text-xs text-muted-foreground">Linked to test “{run.linkedTest.name ?? run.linkedTest.id}”</span>}
        </div>
      )}
    </div>
  );
}

// Pieces shared by the Pre-conformance tabs: verdict badge, the disclaimer
// banner (on every surface that shows results), and the per-case result table
// used live (Run) and for saved reports (Reports).
'use client';

import { Fragment, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { CaseResult, Verdict } from '../types';
import { DISCLAIMER, DISCLAIMER_LONG } from '../types';
import { specText } from '../lib/cases';
import { fmtDuration, VERDICT_LABEL } from '../lib/report';

export const postJson = async (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

const VERDICT_VARIANT: Record<Verdict, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  PASS: 'success', FAIL: 'destructive', INCONCLUSIVE: 'warning', NOT_RUN: 'secondary',
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  return <Badge variant={VERDICT_VARIANT[verdict]} className={cn('h-5 whitespace-nowrap px-2 font-mono text-[10px]', className)}>{VERDICT_LABEL[verdict]}</Badge>;
}

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" className="flex gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <span className="font-semibold">{DISCLAIMER}</span>
        {!compact && <span className="ml-1">{DISCLAIMER_LONG.replace(DISCLAIMER, '').trim()}</span>}
      </div>
    </div>
  );
}

export function RatBadges({ rat }: { rat: 'nr' | 'lte' | 'both' }) {
  return (
    <span className="inline-flex gap-1">
      {(rat === 'both' || rat === 'nr') && <Badge variant="outline" className="h-5 whitespace-nowrap px-1.5 text-[10px]">NR SA</Badge>}
      {(rat === 'both' || rat === 'lte') && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">LTE</Badge>}
    </span>
  );
}

/** One row per case; click to see why (checks, signalling evidence, metrics, teardown). */
export function CaseResultTable({ cases, live = false, onOpenRun }: { cases: CaseResult[]; live?: boolean; onOpenRun?: (runId: string) => void }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setOpen(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead className="w-10">#</TableHead>
          <TableHead>Case</TableHead>
          <TableHead className="w-32">Verdict</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="w-20 text-right">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map(c => {
          const isOpen = open.has(c.index);
          return (
            <Fragment key={c.index}>
              <TableRow className="cursor-pointer" onClick={() => toggle(c.index)}>
                <TableCell className="align-top">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</TableCell>
                <TableCell className="num align-top text-xs">{c.index + 1}</TableCell>
                <TableCell className="align-top">
                  <div className="font-mono text-[11px] text-muted-foreground">{c.caseId}</div>
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground">{c.category} · {c.automation}</div>
                </TableCell>
                <TableCell className="align-top">
                  {c.status === 'running'
                    ? <Badge variant="default" className="h-5 gap-1 px-2 text-[10px]"><Loader2 className="h-3 w-3 animate-spin" />RUNNING</Badge>
                    : c.status === 'pending' && live ? <Badge variant="outline" className="h-5 px-2 text-[10px]">queued</Badge>
                      : <VerdictBadge verdict={c.verdict} />}
                  {c.measurement && <div className="num mt-1 text-[11px] text-muted-foreground">{c.measurement.stat} {c.measurement.value} {c.measurement.unit} / ≤{c.measurement.threshold}</div>}
                </TableCell>
                <TableCell className="align-top text-xs">
                  {c.status === 'running' ? <span className="text-muted-foreground">{c.currentStep ?? 'starting…'}</span> : c.status === 'pending' && live ? '' : c.reason}
                </TableCell>
                <TableCell className="num align-top text-right text-xs text-muted-foreground">{c.startedAt ? fmtDuration((c.endedAt ?? Date.now()) - c.startedAt) : '—'}</TableCell>
              </TableRow>
              {isOpen && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell />
                  <TableCell colSpan={5} className="space-y-2 py-3 text-xs">
                    {c.specs.length > 0 && <div><span className="font-medium">Procedure reference: </span>{c.specs.map(specText).join('; ')}</div>}
                    {c.checks.length > 0 && (
                      <div className="space-y-0.5">
                        <div className="font-medium">Checks</div>
                        {c.checks.map((k, i) => (
                          <div key={i} className={cn('flex gap-2', !k.passed && !k.optional && 'text-destructive', !k.passed && k.optional && 'text-amber-700 dark:text-amber-400')}>
                            <span className="w-10 shrink-0 font-mono">{k.passed ? 'pass' : k.optional ? 'warn' : 'FAIL'}</span>
                            <span className="font-medium">{k.label}</span>
                            <span className="truncate text-muted-foreground" title={k.detail}>{k.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {c.evidence.length > 0 && (
                      <div>
                        <div className="font-medium">Signalling evidence <span className="font-normal text-muted-foreground">(callbox logs, ms after the stimulus)</span></div>
                        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-2 font-mono text-[11px] leading-snug">{c.evidence.join('\n')}</pre>
                      </div>
                    )}
                    {c.metrics.length > 0 && <div><span className="font-medium">Metrics: </span><span className="num">{c.metrics.map(m => `${m.name} ${m.value} ${m.unit}`).join(' · ')}</span></div>}
                    {c.teardown.length > 0 && <div className="text-muted-foreground"><span className="font-medium text-foreground">Teardown: </span>{c.teardown.map(t => `${t.what}${t.ok ? '' : ' (FAILED)'}`).join('; ')}</div>}
                    {c.runId && onOpenRun && <button className="text-primary underline-offset-2 hover:underline" onClick={() => onOpenRun(c.runId!)}>Open the scenario run {c.runId}</button>}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Saved pre-conformance reports: history, open one, download HTML / JSON / CSV.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Kicker, Stat } from '@/components/ui/stat';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { RunDetail } from '@/modules/scenarios/components/RunDetail';
import type { RunView } from '@/modules/scenarios/types';
import type { PlanRunSummary, PlanRunView } from '../types';
import { fmtDuration } from '../lib/report';
import { CaseResultTable, Disclaimer } from './shared';

export function ReportsPanel({ refreshKey, openId }: { refreshKey: number; openId?: string }) {
  const [reports, setReports] = useState<PlanRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<PlanRunView | null>(null);
  const [caseRun, setCaseRun] = useState<RunView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/conformance/reports').then(x => x.json()).catch(() => null);
    if (r?.success) setReports(r.reports);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const show = async (id: string) => {
    const r = await fetch(`/api/conformance/reports?id=${id}`).then(x => x.json()).catch(() => null);
    if (r?.success) { setOpen(r.report); setCaseRun(null); }
  };
  useEffect(() => { if (openId) show(openId); }, [openId]);

  const remove = async (id: string) => {
    if (!window.confirm('Delete this report? The per-case scenario runs stay in Mobility Scenarios → History.')) return;
    await fetch(`/api/conformance/reports?id=${id}`, { method: 'DELETE' });
    if (open?.id === id) setOpen(null);
    load();
  };
  const openRun = async (runId: string) => {
    const r = await fetch(`/api/scenarios/runs?id=${runId}`).then(x => x.json()).catch(() => null);
    if (r?.success) setCaseRun(r.run);
  };

  const downloads = (id: string) => (
    <div className="flex flex-wrap gap-1">
      {(['html', 'json', 'csv'] as const).map(f => (
        <Button key={f} size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
          <a href={`/api/conformance/reports?id=${id}&format=${f}`}><Download className="mr-1 h-3 w-3" />{f.toUpperCase()}</a>
        </Button>
      ))}
    </div>
  );

  if (open) {
    const r = open;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(null)}><ArrowLeft className="mr-1 h-4 w-4" />All reports</Button>
          <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {downloads(r.id)}
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild><a href={`/api/conformance/reports?id=${r.id}&format=html&download=0`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3 w-3" />Printable</a></Button>
          </div>
        </div>
        <Disclaimer />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Stat label="Plan" value={r.planName} hint={`${r.rat === 'nr' ? 'NR SA' : r.rat === 'lte' ? 'LTE' : '—'} · ${r.state}`} />
          <Stat label="PASS" value={r.counts.PASS} tone={r.counts.PASS ? 'good' : 'default'} />
          <Stat label="FAIL" value={r.counts.FAIL} tone={r.counts.FAIL ? 'bad' : 'default'} />
          <Stat label="Inconclusive" value={r.counts.INCONCLUSIVE} tone={r.counts.INCONCLUSIVE ? 'warn' : 'default'} />
          <Stat label="Not run" value={r.counts.NOT_RUN} />
          <Stat label="Duration" value={r.endedAt ? fmtDuration(r.endedAt - r.startedAt) : '—'} hint={new Date(r.startedAt).toLocaleString()} />
        </div>
        <Card className="grid gap-x-6 gap-y-1 p-3 text-xs md:grid-cols-2">
          <div><Kicker>Test system</Kicker>{r.systemName ?? ''} {r.host} (API :{r.enbPort} / :{r.mmePort})</div>
          <div><Kicker>Callbox software</Kicker>{r.callbox.enb?.name} {r.callbox.enb?.version} · {r.callbox.mme?.name} {r.callbox.mme?.version}</div>
          <div><Kicker>UE</Kicker>IMSI {r.ue.imsi}{r.ue.imeisv ? ` · IMEISV ${r.ue.imeisv}` : ''}{r.ue.ip ? ` · IP ${r.ue.ip}` : ''}</div>
          <div><Kicker>Options</Kicker>stop on fail {r.stopOnFail ? 'on' : 'off'}{r.confirmedRisky.length ? ` · confirmed: ${r.confirmedRisky.join(', ')}` : ''}</div>
          <div className="md:col-span-2"><Kicker>Cells (config_get)</Kicker><div className="space-y-0.5">{r.cellSummary.map((c, i) => <div key={i} className="font-mono text-[11px]">{c}</div>)}</div></div>
          {r.error && <div className="text-destructive md:col-span-2"><Kicker>Error</Kicker>{r.error}</div>}
        </Card>
        <Card className="p-0"><CaseResultTable cases={r.cases} onOpenRun={openRun} /></Card>
        {caseRun && (
          <div className="space-y-1">
            <div className="flex items-center gap-2"><Kicker>Scenario run {caseRun.id} — {caseRun.scenarioName}</Kicker><Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setCaseRun(null)}>close</Button></div>
            <RunDetail run={caseRun} />
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <span className="text-xs text-muted-foreground">Stored in data/conformance/reports. Every export carries the “not certified” disclaimer.</span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={load}><RefreshCw className={cn('mr-1 h-4 w-4', loading && 'animate-spin')} />Reload</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>System / UE</TableHead>
            <TableHead className="w-60">Verdicts</TableHead>
            <TableHead className="w-24">Duration</TableHead>
            <TableHead className="w-64" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && reports.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No reports yet — run a plan.</TableCell></TableRow>}
          {reports.map(r => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-xs">{new Date(r.startedAt).toLocaleString()}</TableCell>
              <TableCell className="text-xs">
                <div className="font-medium">{r.planName}</div>
                <div className="text-muted-foreground">{r.rat === 'nr' ? 'NR SA' : r.rat === 'lte' ? 'LTE' : '—'} · {r.state}{r.softwareVersion ? ` · ${r.softwareVersion}` : ''}</div>
              </TableCell>
              <TableCell className="text-xs">{r.systemName ?? r.host}<div className="font-mono text-[11px] text-muted-foreground">{r.imsi}</div></TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="success" className="h-5 px-1.5 text-[10px]">{r.counts.PASS} pass</Badge>
                  {r.counts.FAIL > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{r.counts.FAIL} fail</Badge>}
                  {r.counts.INCONCLUSIVE > 0 && <Badge variant="warning" className="h-5 px-1.5 text-[10px]">{r.counts.INCONCLUSIVE} inconcl.</Badge>}
                  {r.counts.NOT_RUN > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{r.counts.NOT_RUN} not run</Badge>}
                </div>
              </TableCell>
              <TableCell className="num text-xs">{r.endedAt ? fmtDuration(r.endedAt - r.startedAt) : '—'}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => show(r.id)}>Open</Button>
                  {downloads(r.id)}
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

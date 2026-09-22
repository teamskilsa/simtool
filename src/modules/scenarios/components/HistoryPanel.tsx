// Saved Mobility Scenario runs (data/scenario-runs) with per-run detail and export.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { MobilityScenario, RunSummary, RunView } from '../types';
import { LiveRunView } from './LiveRunView';
import { RunDetail, STATE_VARIANT, fmtMs } from './RunDetail';

export function HistoryPanel({ scenarios, refreshKey }: { scenarios: MobilityScenario[]; refreshKey: number }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<RunView | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const q = filter ? `?scenarioId=${encodeURIComponent(filter)}` : '';
    const r = await fetch(`/api/scenarios/runs${q}`).then(x => x.json()).catch(() => null);
    if (r?.success) setRuns(r.runs);
    setLoading(false);
  }, [filter]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const open = async (id: string) => {
    const r = await fetch(`/api/scenarios/runs?id=${id}`).then(x => x.json()).catch(() => null);
    if (r?.success) setSelected(r.run);
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this run result file?')) return;
    await fetch(`/api/scenarios/runs?id=${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  };

  return (
    <div className="space-y-3">
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All scenarios</option>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{runs.length} run(s)</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={load}><RefreshCw className={cn('mr-1 h-4 w-4', loading && 'animate-spin')} />Refresh</Button>
        </div>
        <div className="max-h-[360px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead><TableHead>Scenario</TableHead><TableHead>System</TableHead>
                <TableHead>Result</TableHead><TableHead className="text-right">Asserts</TableHead><TableHead className="text-right">Duration</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 && <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">No runs yet.</TableCell></TableRow>}
              {runs.map(r => (
                <TableRow key={r.id} onClick={() => open(r.id)} className={cn('cursor-pointer', selected?.id === r.id && 'bg-primary/5')}>
                  <TableCell className="num whitespace-nowrap text-xs">{new Date(r.startedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-xs"><div className="font-medium">{r.scenarioName}</div>{r.linkedTest && <div className="text-[11px] text-muted-foreground">test: {r.linkedTest.name ?? r.linkedTest.id}</div>}</TableCell>
                  <TableCell className="text-xs">{r.systemName || r.host}<div className="text-[11px] text-muted-foreground">{r.imsi}</div></TableCell>
                  <TableCell><Badge variant={STATE_VARIANT[r.state]}>{r.state}</Badge></TableCell>
                  <TableCell className="num text-right text-xs">{r.asserts.passed}/{r.asserts.total}{r.asserts.failed ? <span className="text-destructive"> · {r.asserts.failed} fail</span> : null}</TableCell>
                  <TableCell className="num text-right text-xs">{r.endedAt ? fmtMs(r.endedAt - r.startedAt) : '…'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); remove(r.id); }} title="Delete result"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      {selected && (
        <>
          {/* Same cell map, metric tiles and handover strip as the live run,
              rebuilt from the saved result (no polling: live={false}). */}
          <LiveRunView run={selected} live={false} host={selected.host} />
          <RunDetail run={selected} />
        </>
      )}
    </div>
  );
}

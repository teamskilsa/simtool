// Mobility Scenarios — author, run and review field-like procedures on an
// Amarisoft callbox with a real phone: handover, RRC release/reconnect, SCell
// churn, RLF re-establishment, cell barring, TAU, gain-ramp drive tests.
//
// Named "Mobility Scenarios" because Test Execution already owns "Scenario"
// (deploy topologies). Server side: pages/api/scenarios/{library,run,jobs,runs}.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Route, Plus, Play, Pencil, Copy, Trash2, RotateCcw, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TAB_LIST, TAB_TRIGGER, TAB_TRIGGER_ACTIVE, TAB_TRIGGER_IDLE } from '@/components/ui/tab-styles';
import { cn } from '@/lib/utils';
import type { MobilityScenario, RunSummary } from '../types';
import { RequirementBadges } from './RequirementBadges';
import { ScenarioEditor, blankScenario } from './ScenarioEditor';
import { RunPanel } from './RunPanel';
import { HistoryPanel } from './HistoryPanel';

type Tab = 'library' | 'run' | 'history';

export function MobilityScenariosView() {
  const [tab, setTab] = useState<Tab>('library');
  const [scenarios, setScenarios] = useState<MobilityScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ doc: MobilityScenario; isNew: boolean } | null>(null);
  const [runId, setRunId] = useState('');
  const [historyKey, setHistoryKey] = useState(0);
  const [active, setActive] = useState<RunSummary[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/scenarios/library').then(x => x.json()).catch(e => ({ success: false, error: e.message }));
    if (r.success) { setScenarios(r.scenarios); setError(null); if (!runId && r.scenarios[0]) setRunId(r.scenarios[0].id); }
    else setError(r.error ?? 'Could not load the library');
    setLoading(false);
  }, [runId]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const poll = () => fetch('/api/scenarios/jobs').then(x => x.json()).then(r => r.success && setActive(r.runs.filter((x: RunSummary) => !x.endedAt))).catch(() => {});
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  const duplicate = (s: MobilityScenario) => {
    const { builtin: _b, updatedAt: _u, ...rest } = s;
    setEditing({ doc: { ...rest, id: `${s.id}-copy`.slice(0, 64), name: `${s.name} (copy)` }, isNew: true });
  };
  const remove = async (s: MobilityScenario) => {
    if (!window.confirm(`Delete "${s.name}"?${s.builtin ? ' Built-ins can be restored later.' : ''}`)) return;
    await fetch(`/api/scenarios/library?id=${s.id}`, { method: 'DELETE' });
    load();
  };
  const restore = async (id?: string) => {
    if (!window.confirm(id ? 'Restore this built-in to its shipped version?' : 'Restore all built-in scenarios to their shipped versions? Your own scenarios are kept.')) return;
    await fetch('/api/scenarios/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore', id }) });
    load();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'library', label: `Library (${scenarios.length})` },
    { id: 'run', label: active.length ? `Run · ${active.length} active` : 'Run' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Route />}
        title="Mobility Scenarios"
        subtitle="Handover, RRC, SCell, RLF, barring, TAU and drive tests on a callbox with a real phone"
        actions={
          <>
            {active.length > 0 && <Badge variant="success">{active.length} running</Badge>}
            <Button size="sm" variant="outline" onClick={() => { setEditing({ doc: blankScenario(), isNew: true }); setTab('library'); }}>
              <Plus className="mr-1 h-4 w-4" />New
            </Button>
          </>
        }
      />

      <div className={TAB_LIST}>
        {tabs.map(t => (
          <button key={t.id} className={cn(TAB_TRIGGER, tab === t.id ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_IDLE)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {error && <Card className="p-3 text-sm text-destructive">{error}</Card>}

      {tab === 'library' && (editing ? (
        <ScenarioEditor
          key={`${editing.doc.id}-${editing.isNew}`}
          initial={editing.doc}
          isNew={editing.isNew}
          onCancel={() => setEditing(null)}
          onSaved={s => { setEditing(null); load(); setRunId(s.id); }}
        />
      ) : (
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-border p-2">
            <span className="text-xs text-muted-foreground">Stored in data/scenarios. Cell targets resolve from the running eNB config, so built-ins work on 6 or 12 cells.</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={load}><RefreshCw className={cn('mr-1 h-4 w-4', loading && 'animate-spin')} />Reload</Button>
            <Button size="sm" variant="ghost" onClick={() => restore()}><RotateCcw className="mr-1 h-4 w-4" />Restore built-ins</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario</TableHead>
                <TableHead className="w-56">Requirements</TableHead>
                <TableHead className="w-16 text-right">Steps</TableHead>
                <TableHead className="w-52" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && scenarios.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No scenarios — Restore built-ins or create one.</TableCell></TableRow>
              )}
              {scenarios.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{s.name}</span>
                      {s.builtin && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">built-in</Badge>}
                      {(s.tags ?? []).map(t => <Badge key={t} variant="outline" className="h-5 px-1.5 text-[10px] font-normal">{t}</Badge>)}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                  </TableCell>
                  <TableCell className="align-top"><RequirementBadges r={s.requirements} /></TableCell>
                  <TableCell className="num text-right align-top text-xs">{s.steps.length}</TableCell>
                  <TableCell className="align-top">
                    <div className="flex justify-end gap-0.5">
                      <Button size="sm" className="h-7" onClick={() => { setRunId(s.id); setTab('run'); }}><Play className="mr-1 h-3.5 w-3.5" />Run</Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => setEditing({ doc: s, isNew: false })}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicate" onClick={() => duplicate(s)}><Copy className="h-3.5 w-3.5" /></Button>
                      {s.builtin && <Button size="icon" variant="ghost" className="h-7 w-7" title="Restore shipped version" onClick={() => restore(s.id)}><RotateCcw className="h-3.5 w-3.5" /></Button>}
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete" onClick={() => remove(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}

      {/* Kept mounted so a live run keeps polling while you browse the library. */}
      <div className={tab === 'run' ? '' : 'hidden'}>
        <RunPanel scenarios={scenarios} scenarioId={runId} onScenarioChange={setRunId} onFinished={() => setHistoryKey(k => k + 1)} />
      </div>

      {tab === 'history' && <HistoryPanel scenarios={scenarios} refreshKey={historyKey} />}
    </div>
  );
}

export default MobilityScenariosView;

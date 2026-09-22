// Mobility Scenario editor: header form (name, requirements, params), a step
// outline with per-step JSON, and a whole-document JSON view for advanced
// edits. Validation runs on every change with the same validator the server
// applies on save.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Save, Trash2, X, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { MobilityScenario, Step } from '../types';
import { slugify, validateScenario, type Issue } from '../lib/validate';
import { MESSAGES } from '../lib/catalog';

const TEMPLATES: Record<string, Step> = {
  'handover': { type: 'action', target: 'enb', label: 'handover → cell ${cells[1].id}', mark: 'ho', message: { message: 'handover', ran_ue_id: '${ue.ran_ue_id}', pci: '${cells[1].pci}', dl_earfcn: '${cells[1].earfcn}' }, ensureNeighbour: true },
  'assert PCell': { type: 'assert', label: 'PCell changed', expect: { all: [{ path: 'ue.pcell', op: 'eq', value: '${cells[1].id}' }, { path: 'ue.contexts', op: 'eq', value: 1 }] }, timeoutMs: 5000, metric: { name: 'ho_complete_ms', since: 'ho' } },
  'rrc release': { type: 'action', target: 'enb', message: { message: 'rrc_cnx_release', ran_ue_id: '${ue.ran_ue_id}' } },
  'cell gain': { type: 'action', target: 'enb', message: { message: 'cell_gain', cell_id: '${ue.pcell}', gain: -10 } },
  'SCell reconf': { type: 'action', target: 'enb', message: { message: 'rrc_cnx_reconf', enb_ue_id: '${ue.enb_ue_id}', eutra_secondary_cell_list: [] } },
  'bar cell': { type: 'action', target: 'enb', message: { message: 'sib_set', cells: { '${ue.pcell}': { sib1: { cell_barred: true } } } } },
  'TAU (MME)': { type: 'action', target: 'mme', message: { message: 'load_balancing_tau', imsi: '${ue.imsi}', imei: '${ue.imei}' } },
  'wait': { type: 'wait', ms: 1000 },
  'ramp': { type: 'ramp', cells: [{ cell: '${cells[0].id}', from: 0, to: -30 }, { cell: '${cells[1].id}', from: -30, to: 0 }], stepDb: 3, dwellMs: 1500, stopWhen: { path: 'ue.pcell', op: 'eq', value: '${cells[1].id}' }, requireStop: true },
  'loop': { type: 'loop', count: 3, steps: [{ type: 'wait', ms: 1000 }] },
  'log assert': { type: 'assert', source: 'log', log: { target: 'enb', layer: 'RRC', pattern: 'measurementReport' }, timeoutMs: 3000, optional: true },
  'phone ping': { type: 'action', target: 'phone', phone: { op: 'ping', count: 3 }, optional: true },
  'phone airplane on': { type: 'action', target: 'phone', phone: { op: 'airplane_on' }, optional: true },
  'traffic start': { type: 'traffic', op: 'start', generator: 'callbox', direction: 'dl', bitrateMbps: 5, durationSec: 300, ref: 'dl' },
};

export const blankScenario = (): MobilityScenario => ({
  id: 'new-mobility-scenario', name: 'New mobility scenario', description: '', schemaVersion: 1,
  requirements: { minCells: 2, needsPhone: false, needsHoConfig: false },
  params: {},
  steps: [{ type: 'assert', label: 'UE connected', expect: { path: 'ue.connected', op: 'eq', value: true }, timeoutMs: 30000 }],
});

const summary = (s: Step): string => {
  switch (s.type) {
    case 'action': return s.target === 'phone' ? `phone ${s.phone?.op}` : `${s.target} ${String((s as any).message?.message)}`;
    case 'wait': return `${s.ms} ms`;
    case 'assert': return s.source === 'log' ? `log /${s.log?.pattern}/`
      : s.source === 'sequence' ? `sequence of ${s.sequence?.items?.length ?? 0} · timeout ${s.timeoutMs}` : `${s.source ?? 'ue'} · timeout ${s.timeoutMs}`;
    case 'ramp': return `${s.cells?.length} cell(s), ${s.stepDb} dB / ${s.dwellMs} ms`;
    case 'loop': return `× ${s.count ?? 'until'} · ${s.steps?.length ?? 0} step(s)`;
    case 'traffic': return `${s.op}`;
    case 'operator': return `waits for the operator · ${s.timeoutMs} ms`;
  }
};

interface Props {
  initial: MobilityScenario;
  isNew: boolean;
  onSaved: (s: MobilityScenario) => void;
  onCancel: () => void;
}

export function ScenarioEditor({ initial, isNew, onSaved, onCancel }: Props) {
  const [doc, setDoc] = useState<MobilityScenario>(initial);
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initial, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [paramsText, setParamsText] = useState(() => JSON.stringify(initial.params ?? {}, null, 2));
  const [paramsError, setParamsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [stepText, setStepText] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [template, setTemplate] = useState('handover');

  const issues: Issue[] = useMemo(() => validateScenario(doc), [doc]);
  const errors = issues.filter(i => i.level === 'error');

  useEffect(() => { if (mode === 'json') setJsonText(JSON.stringify(doc, null, 2)); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selected !== null && doc.steps[selected]) setStepText(JSON.stringify(doc.steps[selected], null, 2));
    setStepError(null);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (p: Partial<MobilityScenario>) => setDoc(d => ({ ...d, ...p }));
  const setSteps = (fn: (steps: Step[]) => Step[]) => setDoc(d => ({ ...d, steps: fn([...d.steps]) }));

  const move = (i: number, by: number) => setSteps(s => {
    const j = i + by;
    if (j < 0 || j >= s.length) return s;
    [s[i], s[j]] = [s[j], s[i]];
    setSelected(j);
    return s;
  });

  const applyStepText = (text: string) => {
    setStepText(text);
    try {
      const parsed = JSON.parse(text);
      setStepError(null);
      if (selected !== null) setSteps(s => { s[selected] = parsed; return s; });
    } catch (e: any) { setStepError(e.message); }
  };

  const applyJson = (text: string) => {
    setJsonText(text);
    try { const parsed = JSON.parse(text); setJsonError(null); setDoc(parsed); setParamsText(JSON.stringify(parsed.params ?? {}, null, 2)); }
    catch (e: any) { setJsonError(e.message); }
  };

  const save = async () => {
    setSaving(true); setSaveError(null);
    const r = await fetch('/api/scenarios/library', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', scenario: doc }),
    }).then(x => x.json()).catch(e => ({ success: false, error: e.message }));
    setSaving(false);
    if (!r.success) { setSaveError(r.issues?.length ? `${r.issues[0].path}: ${r.issues[0].msg}` : r.error); return; }
    onSaved(r.scenario);
  };

  const issuesFor = (i: number) => issues.filter(x => x.path.startsWith(`steps[${i}]`));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(['form', 'json'] as const).map(m => (
            <Button key={m} size="sm" variant={mode === m ? 'default' : 'outline'} onClick={() => setMode(m)} disabled={m === 'form' && !!jsonError}>
              {m === 'form' ? 'Steps' : 'JSON'}
            </Button>
          ))}
        </div>
        <Badge variant={errors.length ? 'destructive' : 'success'}>{errors.length ? `${errors.length} error(s)` : 'valid'}</Badge>
        {issues.length - errors.length > 0 && <Badge variant="warning">{issues.length - errors.length} warning(s)</Badge>}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}><X className="mr-1 h-4 w-4" />Close</Button>
          <Button size="sm" onClick={save} disabled={saving || errors.length > 0 || !!jsonError}><Save className="mr-1 h-4 w-4" />Save</Button>
        </div>
      </div>
      {saveError && <Alert variant="destructive"><AlertDescription className="text-xs">{saveError}</AlertDescription></Alert>}

      {mode === 'json' ? (
        <Card className="p-3">
          <Textarea className="min-h-[520px] font-mono text-xs" spellCheck={false} value={jsonText} onChange={e => applyJson(e.target.value)} />
          {jsonError && <p className="mt-1 text-xs text-destructive">JSON: {jsonError}</p>}
        </Card>
      ) : (
        <>
          <Card className="grid grid-cols-1 gap-3 p-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2">
              <Kicker>Name</Kicker>
              <Input value={doc.name} onChange={e => patch({ name: e.target.value, ...(isNew ? { id: slugify(e.target.value) } : {}) })} />
            </div>
            <div className="space-y-1">
              <Kicker>ID (file name)</Kicker>
              <Input className="font-mono text-xs" value={doc.id} disabled={!isNew} onChange={e => patch({ id: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Kicker>Tags</Kicker>
              <Input value={(doc.tags ?? []).join(', ')} onChange={e => patch({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />
            </div>
            <div className="space-y-1 md:col-span-4">
              <Kicker>Description</Kicker>
              <Textarea rows={2} value={doc.description} onChange={e => patch({ description: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Kicker>Min cells</Kicker>
              <Input type="number" min={1} className="num" value={doc.requirements.minCells}
                onChange={e => patch({ requirements: { ...doc.requirements, minCells: Math.max(1, Number(e.target.value) || 1) } })} />
            </div>
            {([['needsPhone', 'Needs phone'], ['needsHoConfig', 'Needs HO config (ho_from_meas)'], ['needsCa', 'Needs CA (SCells)']] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 self-end pb-2 text-sm">
                <Switch checked={!!doc.requirements[k]} onCheckedChange={v => patch({ requirements: { ...doc.requirements, [k]: v } })} />
                {label}
              </label>
            ))}
            <div className="space-y-1 md:col-span-4">
              <Kicker>Params — defaults for {'${params.*}'}; overridable per run</Kicker>
              <Textarea rows={3} className="font-mono text-xs" value={paramsText} onChange={e => {
                setParamsText(e.target.value);
                try { const p = JSON.parse(e.target.value); setParamsError(null); patch({ params: p }); } catch (err: any) { setParamsError(err.message); }
              }} />
              {paramsError && <p className="text-xs text-destructive">{paramsError}</p>}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="p-2">
              <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
                <Kicker>Steps ({doc.steps.length})</Kicker>
                <div className="ml-auto flex items-center gap-1">
                  <Select value={template} onValueChange={setTemplate}>
                    <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(TEMPLATES).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => { setSteps(s => [...s, JSON.parse(JSON.stringify(TEMPLATES[template]))]); setSelected(doc.steps.length); }}>
                    <Plus className="mr-1 h-4 w-4" />Add
                  </Button>
                </div>
              </div>
              <div className="max-h-[520px] space-y-1 overflow-auto">
                {doc.steps.map((s, i) => {
                  const own = issuesFor(i);
                  return (
                    <div key={i} onClick={() => setSelected(i)}
                      className={cn('group flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs',
                        selected === i ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                        own.some(x => x.level === 'error') && 'border-destructive')}>
                      <span className="w-5 font-mono text-muted-foreground">{i + 1}</span>
                      <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px] font-normal">{s?.type ?? '?'}</Badge>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{s?.label || summary(s)}</span>
                        {s?.label && <span className="ml-1 text-muted-foreground">{summary(s)}</span>}
                        {s?.optional && <span className="ml-1 text-muted-foreground">(optional)</span>}
                      </span>
                      <span className="hidden gap-0.5 group-hover:flex">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); move(i, -1); }}><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); move(i, 1); }}><ArrowDown className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); setSteps(st => { st.splice(i + 1, 0, JSON.parse(JSON.stringify(st[i]))); return st; }); }}><Copy className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); setSteps(st => { st.splice(i, 1); return st; }); setSelected(null); }}><Trash2 className="h-3 w-3" /></Button>
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="space-y-2 p-3">
              {selected === null || !doc.steps[selected] ? (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>Pick a step to edit its JSON. Placeholders resolve at run time:</p>
                  <pre className="whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-[11px] leading-snug">{`\${ue.ran_ue_id} \${ue.enb_ue_id} \${ue.pcell} \${ue.scells} \${ue.scellList}
\${ue.imsi} \${ue.imei} \${ue.contexts} \${ue.connected} \${mme.registered}
\${cells[N].id|pci|earfcn|gain} \${cellCount} \${cellById.3.pci}
\${params.x} \${vars.x} \${reply.name.field} \${loop.i} \${marks.name}
Arithmetic: \${cells[(loop.i + 1) % cellCount].pci}`}</pre>
                  <p>Teardown always restores cell gains, clears barring, deletes neighbours the run added, restores log levels and sends every recorded <code>undo</code>. <code>ue_del</code> and <code>ue_detach</code> are refused.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Kicker>Step {selected + 1}</Kicker>
                    {doc.steps[selected]?.type === 'action' && (doc.steps[selected] as any).target !== 'phone' && MESSAGES[String((doc.steps[selected] as any).message?.message)] && (
                      <span className="truncate text-[11px] text-muted-foreground">{MESSAGES[String((doc.steps[selected] as any).message?.message)].doc}</span>
                    )}
                  </div>
                  <Textarea className="min-h-[380px] font-mono text-xs" spellCheck={false} value={stepText} onChange={e => applyStepText(e.target.value)} />
                  {stepError && <p className="text-xs text-destructive">JSON: {stepError}</p>}
                  {issuesFor(selected).map((x, k) => (
                    <p key={k} className={cn('text-xs', x.level === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400')}>{x.path.replace(`steps[${selected}]`, '')} {x.msg}</p>
                  ))}
                </>
              )}
            </Card>
          </div>
        </>
      )}

      {issues.length > 0 && (
        <Card className="max-h-40 space-y-0.5 overflow-auto p-3 text-xs">
          {issues.map((x, i) => (
            <div key={i} className={x.level === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}>
              <span className="font-mono">{x.path || '(root)'}</span> {x.msg}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

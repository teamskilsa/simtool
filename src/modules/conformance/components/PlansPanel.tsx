// Test plans: an ordered list of catalogue cases with parameters, a RAT and a
// stop-on-fail switch. Built-ins can be edited and restored; a duplicate
// becomes the user's own plan (data/conformance/plans).
'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Play, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ParamControls } from '@/modules/scenarios/components/ParamControls';
import type { MobilityScenario } from '@/modules/scenarios/types';
import type { TestCaseDef, TestPlan } from '../types';
import { CATEGORIES } from '../types';
import { CASE_BY_ID, CASES, defaultParams, supportsRat } from '../lib/cases';
import { postJson, RatBadges } from './shared';

/** ParamControls works on a scenario's params; give it one made of the case's defaults. */
const paramScenario = (c: TestCaseDef): MobilityScenario => ({
  id: c.id.toLowerCase(), name: c.title, schemaVersion: 1, requirements: { minCells: 1, needsHoConfig: false }, steps: [],
  description: c.params.map(p => `${p.help.replace(/\.$/, '')} (params.${p.key}).`).join(' '),
  params: defaultParams(c),
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'plan';

export function PlansPanel({ plans, onChanged, onRun }: { plans: TestPlan[]; onChanged: (selectId?: string) => void; onRun: (planId: string) => void }) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<TestPlan | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [openCase, setOpenCase] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const selected = plans.find(p => p.id === selectedId) ?? null;
  const edit = (p: TestPlan, fresh = false) => { setDraft(JSON.parse(JSON.stringify(p))); setIsNew(fresh); setSelectedId(fresh ? '' : p.id); setOpenCase(null); setMsg(null); };
  const dirty = !!draft && (isNew || JSON.stringify(draft) !== JSON.stringify(selected));

  const create = () => edit({ id: 'my-plan', name: 'My plan', description: '', rat: 'auto', stopOnFail: false, interCaseMs: 2000, cases: [] }, true);
  const duplicate = (p: TestPlan) => {
    const { builtin: _b, updatedAt: _u, ...rest } = p;
    edit({ ...rest, id: `${p.id}-copy`.slice(0, 64), name: `${p.name} (copy)` }, true);
  };
  const save = async () => {
    if (!draft) return;
    const r = await postJson('/api/conformance/plans', { action: 'save', plan: draft });
    if (!r.success) { setMsg({ ok: false, text: r.error ?? 'Could not save' }); return; }
    setMsg({ ok: true, text: 'Saved.' });
    setIsNew(false);
    setSelectedId(r.plan.id);
    setDraft(r.plan);
    onChanged(r.plan.id);
  };
  const remove = async (p: TestPlan) => {
    if (!window.confirm(`Delete plan "${p.name}"?${p.builtin ? ' Built-ins can be restored.' : ''}`)) return;
    await fetch(`/api/conformance/plans?id=${p.id}`, { method: 'DELETE' });
    setDraft(null); setSelectedId('');
    onChanged();
  };
  const restore = async () => {
    if (!window.confirm('Restore the built-in plans to their shipped versions? Your own plans are kept.')) return;
    await postJson('/api/conformance/plans', { action: 'restore' });
    setDraft(null);
    onChanged();
  };

  const setCases = (cases: TestPlan['cases']) => draft && setDraft({ ...draft, cases });
  const move = (i: number, d: -1 | 1) => {
    if (!draft) return;
    const c = [...draft.cases];
    const j = i + d;
    if (j < 0 || j >= c.length) return;
    [c[i], c[j]] = [c[j], c[i]];
    setCases(c);
    setOpenCase(null);
  };
  const toggleCase = (id: string, on: boolean) => {
    if (!draft) return;
    if (on) setCases([...draft.cases, { caseId: id }]);
    else setCases(draft.cases.filter(c => c.caseId !== id));
  };
  const available = useMemo(() => CASES.filter(c => !draft || draft.rat === 'auto' || supportsRat(c, draft.rat)), [draft]);

  return (
    <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-fit p-0">
        <div className="flex items-center gap-1 border-b border-border p-2">
          <Kicker className="mr-auto">Plans ({plans.length})</Kicker>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={restore} title="Restore built-in plans"><RotateCcw className="mr-1 h-3.5 w-3.5" />Built-ins</Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={create}><Plus className="mr-1 h-3.5 w-3.5" />New</Button>
        </div>
        <div className="divide-y divide-border">
          {plans.map(p => (
            <button key={p.id} onClick={() => edit(p)} className={cn('block w-full px-3 py-2 text-left hover:bg-accent', selectedId === p.id && 'bg-accent')}>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{p.name}</span>
                {p.builtin && <Badge variant="secondary" className="h-4 px-1 text-[9px]">built-in</Badge>}
              </div>
              <div className="text-[11px] text-muted-foreground">{p.rat === 'auto' ? 'NR SA or LTE (auto)' : p.rat === 'nr' ? 'NR SA' : 'LTE'} · {p.cases.length} case{p.cases.length === 1 ? '' : 's'}{p.stopOnFail ? ' · stop on fail' : ''}</div>
            </button>
          ))}
        </div>
      </Card>

      {!draft ? (
        <Card className="flex items-center justify-center p-8 text-sm text-muted-foreground">Pick a plan to see and edit its cases, or create a new one.</Card>
      ) : (
        <div className="space-y-3">
          <Card className="space-y-3 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_180px]">
              <div className="space-y-1">
                <Kicker>Name</Kicker>
                <Input className="h-8" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value, ...(isNew ? { id: slug(e.target.value) } : {}) })} />
                <p className="font-mono text-[10px] text-muted-foreground">id: {draft.id}{isNew ? ' (from the name)' : ''}</p>
              </div>
              <div className="space-y-1">
                <Kicker>RAT</Kicker>
                <Select value={draft.rat} onValueChange={v => setDraft({ ...draft, rat: v as TestPlan['rat'] })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto" description="Follows the UE / running config">Auto</SelectItem>
                    <SelectItem value="nr">NR SA</SelectItem>
                    <SelectItem value="lte">LTE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Kicker>Execution</Kicker>
                <label className="flex h-8 items-center gap-2 text-xs"><Switch checked={draft.stopOnFail} onCheckedChange={v => setDraft({ ...draft, stopOnFail: v })} />Stop on first FAIL</label>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  pause <Input className="num h-6 w-20 text-xs" type="number" min={0} value={draft.interCaseMs ?? 2000} onChange={e => setDraft({ ...draft, interCaseMs: Number(e.target.value) || 0 })} /> ms between cases
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Kicker>Description</Kicker>
              <Textarea className="min-h-[48px] text-xs" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={save} disabled={!dirty}><Save className="mr-1 h-4 w-4" />Save</Button>
              {!isNew && selected && <Button size="sm" variant="outline" onClick={() => onRun(selected.id)} disabled={dirty}><Play className="mr-1 h-4 w-4" />Run this plan</Button>}
              {!isNew && selected && <Button size="sm" variant="ghost" onClick={() => duplicate(selected)}><Copy className="mr-1 h-4 w-4" />Duplicate</Button>}
              {!isNew && selected && <Button size="sm" variant="ghost" onClick={() => remove(selected)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>}
              {isNew && <Button size="sm" variant="ghost" onClick={() => { setDraft(null); setIsNew(false); }}><X className="mr-1 h-4 w-4" />Cancel</Button>}
              {dirty && !isNew && <span className="text-xs text-amber-700 dark:text-amber-400">Unsaved changes</span>}
              {msg && <span className={cn('text-xs', msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>{msg.text}</span>}
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="p-0">
              <div className="border-b border-border p-2"><Kicker>Cases in run order ({draft.cases.length})</Kicker></div>
              {draft.cases.length === 0 && <p className="p-4 text-xs text-muted-foreground">Tick cases on the right to add them.</p>}
              <div className="divide-y divide-border">
                {draft.cases.map((pc, i) => {
                  const def = CASE_BY_ID[pc.caseId];
                  const open = openCase === i;
                  const changed = Object.keys(pc.params ?? {}).length;
                  return (
                    <div key={`${pc.caseId}-${i}`} className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <span className="num w-5 text-right text-[11px] text-muted-foreground">{i + 1}</span>
                        <button className="flex min-w-0 flex-1 items-center gap-1 text-left" onClick={() => setOpenCase(open ? null : i)}>
                          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          <span className="font-mono text-[10px] text-muted-foreground">{pc.caseId}</span>
                          <span className="truncate text-xs font-medium">{def?.title ?? 'unknown case'}</span>
                          {changed > 0 && <Badge variant="outline" className="h-4 px-1 text-[9px]">{changed} param{changed === 1 ? '' : 's'}</Badge>}
                          {def?.risky && <Badge variant="warning" className="h-4 px-1 text-[9px]">confirm</Badge>}
                        </button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0} title="Earlier"><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === draft.cases.length - 1} title="Later"><ArrowDown className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setCases(draft.cases.filter((_, j) => j !== i)); setOpenCase(null); }} title="Remove"><X className="h-3 w-3" /></Button>
                      </div>
                      {open && def && (
                        <div className="mt-2 rounded border border-border p-2">
                          <ParamControls
                            scenario={paramScenario(def)}
                            cells={[]}
                            values={{ ...defaultParams(def), ...(pc.params ?? {}) }}
                            onChange={next => {
                              const d = defaultParams(def);
                              const overrides = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== '' && v !== d[k]));
                              setCases(draft.cases.map((x, j) => (j === i ? { ...x, params: Object.keys(overrides).length ? overrides : undefined } : x)));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-0">
              <div className="border-b border-border p-2"><Kicker>Catalogue{draft.rat !== 'auto' ? ` — ${draft.rat === 'nr' ? 'NR SA' : 'LTE'} cases` : ''}</Kicker></div>
              <div className="max-h-[560px] overflow-y-auto">
                {CATEGORIES.map(cat => {
                  const items = available.filter(c => c.category === cat);
                  if (!items.length) return null;
                  return (
                    <div key={cat} className="border-b border-border px-2 py-1.5 last:border-0">
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{cat}</div>
                      {items.map(c => {
                        const inPlan = draft.cases.some(x => x.caseId === c.id);
                        return (
                          <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-accent">
                            <Checkbox className="mt-0.5" checked={inPlan} onCheckedChange={v => toggleCase(c.id, v === true)} />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] text-muted-foreground">{c.id}</span>
                                <span className="text-xs font-medium">{c.title}</span>
                                <RatBadges rat={c.rat} />
                                {c.automation === 'operator-prompted' && <Badge variant="outline" className="h-4 px-1 text-[9px]">operator</Badge>}
                                {c.risky && <Badge variant="warning" className="h-4 px-1 text-[9px]">needs confirmation</Badge>}
                              </span>
                              <span className="block text-[11px] leading-snug text-muted-foreground">{c.summary}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

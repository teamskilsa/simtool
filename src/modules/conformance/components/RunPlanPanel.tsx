// Run a pre-conformance plan: pick the plan, the system and the UE, check the
// preconditions in plain language, then watch each case live. Operator steps
// pop up as a prompt (Continue / Skip / Abort); SimTool never touches the phone.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Hand, Loader2, Play, RefreshCw, ShieldCheck, Square } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Kicker, Stat } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import { sshCredsOf } from '@/modules/scenarios/integration';
import { CellMap } from '@/modules/scenarios/components/CellMap';
import { LiveRunView } from '@/modules/scenarios/components/LiveRunView';
import type { CellInfo, RunView } from '@/modules/scenarios/types';
import type { PlanRunView, TestPlan } from '../types';
import { CASE_BY_ID } from '../lib/cases';
import { fmtDuration } from '../lib/report';
import { CaseResultTable, Disclaimer, postJson } from './shared';

const CUSTOM = '__custom__';
interface UeRow { imsi: string; registered: boolean; rat: string; bearers: { ip?: string; apn: string }[] }
interface Preflight {
  ok: boolean; rat?: string; checks: { name: string; ok: boolean; level: string; plain: string }[];
  cases: { caseId: string; ok: boolean; detail: string }[]; cells: CellInfo[];
}

export function RunPlanPanel({ plans, planId, onPlanChange, onFinished }: {
  plans: TestPlan[]; planId: string; onPlanChange: (id: string) => void; onFinished?: () => void;
}) {
  const plan = plans.find(p => p.id === planId) ?? null;
  const { systems } = useSystems();
  const [systemId, setSystemId] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [enbPort, setEnbPort] = useState('9001');
  const [mmePort, setMmePort] = useState('9000');
  const system = systems.find(s => String(s.id) === systemId) ?? null;
  const host = systemId === CUSTOM ? customHost.trim() : system?.ip ?? '';
  const hostOk = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  useEffect(() => { if (!systemId && systems.length) setSystemId(String(systems[0].id)); }, [systems, systemId]);

  const [ues, setUes] = useState<UeRow[]>([]);
  const [ueError, setUeError] = useState<string | null>(null);
  const [imsi, setImsi] = useState('');
  const loadUes = useCallback(async () => {
    if (!hostOk) { setUes([]); return; }
    const r = await postJson('/api/traffic/ues', { host, mmePort: Number(mmePort), enbPort: Number(enbPort) }).catch(e => ({ success: false, error: e.message }));
    if (!r.success) { setUeError(r.error ?? 'Core unreachable'); setUes([]); return; }
    setUeError(null);
    setUes(r.ues);
    setImsi(cur => (cur && r.ues.some((u: UeRow) => u.imsi === cur) ? cur : r.ues[0]?.imsi ?? cur));
  }, [host, mmePort, enbPort, hostOk]);
  useEffect(() => { loadUes(); }, [loadUes]);

  const [stopOnFail, setStopOnFail] = useState(false);
  useEffect(() => { setStopOnFail(!!plan?.stopOnFail); setPre(null); setConfirmed([]); }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const riskyCases = useMemo(() => (plan?.cases ?? []).map(c => CASE_BY_ID[c.caseId]).filter(c => c?.risky), [plan]);
  const [confirmed, setConfirmed] = useState<string[]>([]);

  const body = () => ({
    planId, host, imsi, enbPort: Number(enbPort) || 9001, mmePort: Number(mmePort) || 9000,
    systemId: system ? String(system.id) : undefined, systemName: system?.name ?? (systemId === CUSTOM ? host : undefined),
    creds: system?.username ? sshCredsOf(system) : undefined, confirmRisky: confirmed, stopOnFail,
  });

  // ─── Pre-check ────────────────────────────────────────────────────────────
  const [pre, setPre] = useState<Preflight | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preflight = async () => {
    setBusy('preflight'); setError(null);
    const r = await postJson('/api/conformance/run', { ...body(), action: 'preflight' }).catch(e => ({ success: false, error: e.message }));
    setBusy(null);
    if (!r.success) { setError(r.error); setPre(null); return; }
    setPre(r);
  };

  // ─── Live plan run ────────────────────────────────────────────────────────
  const [run, setRun] = useState<PlanRunView | null>(null);
  const polling = useRef(false);
  const poll = useCallback(async (id: string) => {
    if (polling.current) return;
    polling.current = true;
    const r = await fetch(`/api/conformance/jobs?id=${id}`).then(x => x.json()).catch(() => null).finally(() => { polling.current = false; });
    if (!r?.success) return;
    setRun(r.run);
    if (r.run.endedAt) onFinished?.();
  }, [onFinished]);
  useEffect(() => {
    if (!run || run.endedAt) return;
    const t = setInterval(() => poll(run.id), 1000);
    return () => clearInterval(t);
  }, [run?.id, run?.endedAt, poll]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-attach to a plan that is still running (e.g. after switching tabs or reloading).
  useEffect(() => {
    fetch('/api/conformance/jobs').then(x => x.json()).then(r => {
      const live = r.success && r.runs.find((x: { endedAt?: number }) => !x.endedAt);
      if (live) poll(live.id);
    }).catch(() => {});
  }, [poll]);

  // The current case's scenario run, for the cell map and timeline.
  const current = run && run.currentIndex >= 0 ? run.cases[run.currentIndex] : null;
  const [caseRun, setCaseRun] = useState<RunView | null>(null);
  useEffect(() => {
    const id = current?.runId;
    if (!id) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/scenarios/jobs?id=${id}&eventsFrom=0`).then(x => x.json()).catch(() => null);
      if (!stop && r?.success) setCaseRun(r.run);
    };
    tick();
    const t = setInterval(tick, 1500);
    return () => { stop = true; clearInterval(t); };
  }, [current?.runId]);

  const start = async () => {
    setError(null); setBusy('start'); setRun(null); setCaseRun(null);
    const r = await postJson('/api/conformance/run', { ...body(), action: 'start' }).catch(e => ({ success: false, error: e.message }));
    setBusy(null);
    if (r.run) setRun(r.run);
    if (!r.success) setError(r.error ?? 'Did not start');
  };
  const abort = async () => {
    if (!run || run.endedAt) return;
    if (!window.confirm('Abort the plan? The running case is torn down (gains, barring, neighbours, SCells, traffic, log levels restored) and the rest are not run.')) return;
    await postJson('/api/conformance/jobs', { action: 'abort', id: run.id });
    poll(run.id);
  };
  const answer = async (response: 'continue' | 'skip' | 'abort') => {
    if (!run?.prompt) return;
    await postJson('/api/conformance/jobs', { action: 'prompt', id: run.id, promptId: run.prompt.id, response });
    poll(run.id);
  };

  // Countdown for the operator prompt.
  const [now, setNow] = useState(Date.now());
  const promptId = run?.prompt?.id;
  useEffect(() => {
    if (!promptId) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [promptId]);
  const left = run?.prompt ? Math.max(0, Math.min(run.prompt.timeoutMs, run.prompt.startedAt + run.prompt.timeoutMs - now)) : 0;

  const running = !!run && !run.endedAt;
  const blockers = [
    !plan && 'Pick a plan.',
    !hostOk && 'Pick a system or enter a host IP.',
    !/^\d{5,15}$/.test(imsi) && 'Pick the UE (IMSI).',
  ].filter(Boolean) as string[];
  const cellsForMap = caseRun?.cells?.length ? caseRun.cells : run?.cells ?? pre?.cells ?? [];

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Kicker>Test plan</Kicker>
            <Select value={planId} onValueChange={onPlanChange} disabled={running}>
              <SelectTrigger><SelectValue placeholder="Pick a plan" /></SelectTrigger>
              <SelectContent>
                {plans.map(p => <SelectItem key={p.id} value={p.id} description={`${p.rat === 'auto' ? 'auto RAT' : p.rat === 'nr' ? 'NR SA' : 'LTE'} · ${p.cases.length} cases`}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {plan && <p className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">{plan.description}</p>}
          </div>
          <div className="space-y-1">
            <Kicker>System</Kicker>
            <Select value={systemId} onValueChange={setSystemId} disabled={running}>
              <SelectTrigger><SelectValue placeholder="Pick a system" /></SelectTrigger>
              <SelectContent>
                {systems.map(s => <SelectItem key={s.id} value={String(s.id)} description={`${s.ip}${s.username ? ' · SSH login' : ' · no SSH login'}`}>{s.name}</SelectItem>)}
                <SelectItem value={CUSTOM} description="Any callbox by IP (e.g. a mock)">Custom host…</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-[1fr_70px_70px] gap-1">
              <Input className="num h-8 text-xs" placeholder="host IP" disabled={systemId !== CUSTOM || running} value={systemId === CUSTOM ? customHost : host} onChange={e => setCustomHost(e.target.value)} />
              <Input className="num h-8 text-xs" title="eNB/gNB remote API port" value={enbPort} onChange={e => setEnbPort(e.target.value)} disabled={running} />
              <Input className="num h-8 text-xs" title="MME/AMF remote API port" value={mmePort} onChange={e => setMmePort(e.target.value)} disabled={running} />
            </div>
            <p className="text-[11px] text-muted-foreground">{system?.username ? 'SSH login saved: the callbox can send DL data (paging, keep-alive).' : 'No SSH login: paging cases will be INCONCLUSIVE.'}</p>
          </div>
          <div className="space-y-1">
            <Kicker>UE (IMSI, from the core)</Kicker>
            <div className="flex gap-1">
              <Select value={imsi} onValueChange={setImsi} disabled={!ues.length || running}>
                <SelectTrigger><SelectValue placeholder={ueError ? 'Core unreachable' : 'No UEs in the core'} /></SelectTrigger>
                <SelectContent>
                  {ues.map(u => <SelectItem key={u.imsi} value={u.imsi} description={`${u.rat} · ${u.registered ? 'registered' : 'not registered'} · ${u.bearers.map(b => b.ip).filter(Boolean).join(', ')}`}>{u.imsi}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="icon" variant="outline" className="shrink-0" onClick={loadUes} title="Refresh UEs"><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <p className="text-[11px] text-muted-foreground">SimTool never controls the phone: operator-prompted cases ask you to act on it.</p>
          </div>
        </div>

        {riskyCases.length > 0 && (
          <div className="space-y-1 rounded border border-amber-500/50 bg-amber-500/5 p-2">
            <Kicker>Confirmation required</Kicker>
            {riskyCases.map(c => c && (
              <label key={c.id} className="flex items-start gap-2 text-xs">
                <Checkbox className="mt-0.5" checked={confirmed.includes(c.id)} disabled={running} onCheckedChange={v => setConfirmed(x => (v === true ? [...x, c.id] : x.filter(y => y !== c.id)))} />
                <span><b>{c.id} {c.title}.</b> {c.risky!.confirm} Unticked → the case is NOT RUN.</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
          {running ? (
            <Button variant="destructive" onClick={abort}><Square className="mr-2 h-4 w-4" />Abort plan (undoes the running case)</Button>
          ) : (
            <Button size="lg" onClick={start} disabled={!!busy || blockers.length > 0}>
              {busy === 'start' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Run plan
            </Button>
          )}
          <Button variant="outline" onClick={preflight} disabled={!!busy || running || blockers.length > 0}>
            {busy === 'preflight' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Check preconditions
          </Button>
          <label className="flex items-center gap-2 text-xs"><Switch checked={stopOnFail} onCheckedChange={setStopOnFail} disabled={running} />Stop on first FAIL</label>
          {blockers.length > 0 && <span className="text-xs text-amber-700 dark:text-amber-400">{blockers[0]}</span>}
          {plan && <span className="ml-auto text-xs text-muted-foreground">{plan.cases.length} case{plan.cases.length === 1 ? '' : 's'}, {plan.cases.filter(c => CASE_BY_ID[c.caseId]?.automation === 'operator-prompted').length} need the operator</span>}
        </div>

        {error && <Alert variant="destructive"><AlertTitle>Not started</AlertTitle><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}

        {pre && !run && (
          <div className="grid gap-2 lg:grid-cols-2">
            <div className="space-y-1 rounded border border-border p-2 text-xs">
              <Kicker>Pre-checks {pre.rat && <span className="normal-case">— testing {pre.rat === 'nr' ? 'NR SA' : 'LTE'}</span>}</Kicker>
              {pre.checks.map(c => (
                <div key={c.name} className="flex gap-2">
                  <Badge variant={c.ok ? 'success' : c.level === 'error' ? 'destructive' : 'warning'} className="h-5 shrink-0">{c.ok ? 'ok' : c.level === 'error' ? 'blocked' : 'warning'}</Badge>
                  <span>{c.plain}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1 rounded border border-border p-2 text-xs">
              <Kicker>Cases on this config</Kicker>
              {pre.cases.map(c => (
                <div key={c.caseId} className="flex gap-2">
                  <Badge variant={c.ok ? 'success' : 'warning'} className="h-5 shrink-0">{c.ok ? 'ready' : 'note'}</Badge>
                  <span><span className="font-mono">{c.caseId}</span> {CASE_BY_ID[c.caseId]?.title}: <span className="text-muted-foreground">{c.detail}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {run && (
        <>
          <Disclaimer compact />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Stat label="State" value={run.state} hint={run.error ?? (current ? `case ${run.currentIndex + 1}/${run.cases.length}: ${current.caseId}` : run.planName)} tone={run.state === 'finished' ? 'good' : run.state === 'error' ? 'bad' : 'default'} />
            <Stat label="PASS" value={run.counts.PASS} tone={run.counts.PASS ? 'good' : 'default'} />
            <Stat label="FAIL" value={run.counts.FAIL} tone={run.counts.FAIL ? 'bad' : 'default'} />
            <Stat label="Inconclusive" value={run.counts.INCONCLUSIVE} tone={run.counts.INCONCLUSIVE ? 'warn' : 'default'} />
            <Stat label="Not run" value={run.counts.NOT_RUN} hint={running ? 'includes the queued ones' : undefined} />
            <Stat label="Duration" value={fmtDuration((run.endedAt ?? Date.now()) - run.startedAt)} hint={`${run.callbox.enb?.name ?? ''} ${run.callbox.enb?.version ?? ''}`} />
          </div>
          {run.state === 'error' && run.preflight.some(c => !c.ok) && (
            <Alert variant="destructive"><AlertTitle>Pre-checks failed</AlertTitle><AlertDescription className="space-y-0.5 text-xs">{run.preflight.filter(c => !c.ok).map(c => <div key={c.name}>{c.plain}</div>)}</AlertDescription></Alert>
          )}
          {run.endedAt && (
            <Card className="flex flex-wrap items-center gap-2 p-3 text-xs">
              <span className="font-medium">Report {run.id} saved.</span>
              {(['html', 'json', 'csv'] as const).map(f => (
                <Button key={f} size="sm" variant="outline" className="h-7" asChild>
                  <a href={`/api/conformance/reports?id=${run.id}&format=${f}`}><Download className="mr-1 h-3.5 w-3.5" />{f.toUpperCase()}</a>
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="h-7" asChild><a href={`/api/conformance/reports?id=${run.id}&format=html&download=0`} target="_blank" rel="noreferrer">Open printable report</a></Button>
            </Card>
          )}
          <Card className="p-0"><CaseResultTable cases={run.cases} live={running} /></Card>
          {running && caseRun && !caseRun.endedAt && (
            <div className="space-y-1">
              <Kicker>Now running: {current?.caseId} {current?.title}</Kicker>
              <LiveRunView run={caseRun} live host={run.host} enbPort={run.enbPort} mmePort={run.mmePort} fallbackCells={run.cells} />
            </div>
          )}
          {(!running || !caseRun) && cellsForMap.length > 0 && <Card className="p-3"><CellMap cells={cellsForMap} hint="Cells of the running config (config_get)." /></Card>}
        </>
      )}

      {!run && pre?.cells?.length ? <Card className="p-3"><CellMap cells={pre.cells} hint="Not running — the config on the callbox right now." /></Card> : null}

      <Dialog open={!!run?.prompt} onOpenChange={() => { /* answered with the buttons only */ }}>
        <DialogContent className="sm:max-w-lg" onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Hand className="h-5 w-5 text-primary" />Operator action needed</DialogTitle>
            <DialogDescription>{run?.prompt?.caseId} — {run?.prompt?.caseTitle}</DialogDescription>
          </DialogHeader>
          <p className="text-base font-semibold leading-snug">{run?.prompt?.text}</p>
          {run?.prompt?.detail && <p className="text-sm text-muted-foreground">{run.prompt.detail}</p>}
          <p className="text-xs text-muted-foreground">SimTool does not control the device. No answer in <span className="num font-semibold">{Math.ceil(left / 1000)} s</span> → the case is INCONCLUSIVE. Skip also ends the case INCONCLUSIVE; Abort stops the whole plan.</p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => answer('abort')}>Abort plan</Button>
            <Button variant="outline" onClick={() => answer('skip')}>Skip</Button>
            <Button onClick={() => answer('continue')}>{run?.prompt?.continueLabel ?? 'Continue'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

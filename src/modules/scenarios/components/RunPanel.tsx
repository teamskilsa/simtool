// Run a Mobility Scenario: pick the system and the UE, see the cells the
// callbox is actually running, set the scenario's parameters with real
// controls, optionally add a phone and traffic, then watch the run live on the
// cell map and timeline.
//
// The run itself is polled from /api/scenarios/jobs once a second; the cell
// list comes from /api/scenarios/cells (the runner's own view, read-only) so
// "pair" can be picked as "Cell 4 — n78 3580 MHz" instead of the index 3.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, RefreshCw, Loader2, ShieldCheck, Link2, ChevronDown, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import type { CellInfo, MobilityScenario, PreflightCheck, RunSummary, RunView } from '../types';
import { cellLabel, runSummary } from '../lib/cellLabel';
import { RunDetail } from './RunDetail';
import { CellMap } from './CellMap';
import { LiveRunView } from './LiveRunView';
import { ParamControls } from './ParamControls';
// Phones are never driven from SimTool: scenarios act on the callbox only.
import { RequirementBadges } from './RequirementBadges';
import { DEFAULT_TRAFFIC, TrafficControls, trafficBlocker, type TrafficSettings } from './TrafficControls';
import {
  attachMobility, listTestScenarios, runDeployThenMobility, sshCredsOf, type TestScenarioRecord,
} from '../integration';

const CUSTOM = '__custom__';
const NO_TEST = '__none__';

const postJson = async (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

interface UeRow { imsi: string; registered: boolean; rat: string; bearers: { ip?: string; apn: string }[] }

/** The callbox's own address on the UE's PDN — the iperf/UDP server side. */
const gatewayFor = (ip?: string) => (ip && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) ? ip.split('.').slice(0, 3).concat('1').join('.') : undefined);

/** Preflight wording the customer can act on, without the API vocabulary. */
const PLAIN: { re: RegExp; text: (c: PreflightCheck) => string }[] = [
  { re: /^eNB remote API$/, text: c => (c.ok ? 'Reached the callbox radio (eNB).' : `Cannot reach the callbox radio: ${c.detail}`) },
  { re: /^MME remote API$/, text: c => (c.ok ? 'Reached the core network (MME).' : `Cannot reach the core network: ${c.detail}`) },
  { re: /^Cells$/, text: c => (c.ok ? `Enough cells are running. ${c.detail}` : `Not enough cells for this scenario. ${c.detail}`) },
  { re: /^UE on MME$/, text: c => (c.ok ? 'The UE is attached to the core.' : `The UE is not usable yet: ${c.detail}`) },
  { re: /^UE on eNB$/, text: c => (c.ok ? 'The UE is connected on the radio.' : `The UE is idle on the radio: ${c.detail}`) },
  { re: /^Carrier aggregation$/, text: c => (c.ok ? `Carrier aggregation is configured. ${c.detail}` : `Carrier aggregation is missing: ${c.detail}`) },
  { re: /^Measurement handover config$/, text: c => (c.ok ? 'Measurement-based handover is enabled in the running config.' : `Measurement-based handover is off: ${c.detail}`) },
  { re: /^Phone$/, text: c => c.detail },
  { re: /^Traffic$/, text: c => c.detail },
];
const plainCheck = (c: PreflightCheck) => PLAIN.find(p => p.re.test(c.name))?.text(c) ?? c.detail;

export function RunPanel({ scenarios, scenarioId, onScenarioChange, onFinished }: {
  scenarios: MobilityScenario[];
  scenarioId: string;
  onScenarioChange: (id: string) => void;
  onFinished?: () => void;
}) {
  const scenario = scenarios.find(s => s.id === scenarioId) ?? null;
  const { systems } = useSystems();
  const [systemId, setSystemId] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [enbPort, setEnbPort] = useState('9001');
  const [mmePort, setMmePort] = useState('9000');
  const system = systems.find(s => String(s.id) === systemId) ?? null;
  const host = systemId === CUSTOM ? customHost.trim() : system?.ip ?? '';
  const hostOk = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);

  useEffect(() => { if (!systemId && systems.length) setSystemId(String(systems[0].id)); }, [systems, systemId]);

  // ─── Cells on the callbox (read-only config_get) ──────────────────────────
  const [cells, setCells] = useState<CellInfo[]>([]);
  const [cellError, setCellError] = useState<string | null>(null);
  const loadCells = useCallback(async () => {
    if (!hostOk) { setCells([]); return; }
    const r = await postJson('/api/scenarios/cells', { host, enbPort: Number(enbPort) || 9001 }).catch(e => ({ success: false, error: e.message }));
    if (r.success) { setCells(r.cells); setCellError(null); }
    else { setCells([]); setCellError(r.error ?? 'Could not read the cells'); }
  }, [host, enbPort, hostOk]);
  useEffect(() => { loadCells(); }, [loadCells]);

  // ─── UEs from the MME ─────────────────────────────────────────────────────
  const [ues, setUes] = useState<UeRow[]>([]);
  const [ueError, setUeError] = useState<string | null>(null);
  const [imsi, setImsi] = useState('');
  const loadUes = useCallback(async () => {
    if (!hostOk) { setUes([]); return; }
    const r = await postJson('/api/traffic/ues', { host, mmePort: Number(mmePort), enbPort: Number(enbPort) }).catch(e => ({ success: false, error: e.message }));
    if (!r.success) { setUeError(r.error ?? 'MME unreachable'); setUes([]); return; }
    setUeError(null);
    setUes(r.ues);
    setImsi(cur => (cur && r.ues.some((u: UeRow) => u.imsi === cur) ? cur : r.ues[0]?.imsi ?? cur));
  }, [host, mmePort, enbPort, hostOk]);
  useEffect(() => { loadUes(); }, [loadUes]);
  const ueIp = ues.find(u => u.imsi === imsi)?.bearers.find(b => b.ip)?.ip;

  // ─── Phones ───────────────────────────────────────────────────────────────

  // ─── Params ───────────────────────────────────────────────────────────────
  const [params, setParams] = useState<Record<string, unknown>>({});
  useEffect(() => { setParams({ ...(scenario?.params ?? {}) }); setChecks(null); }, [scenario?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [strict, setStrict] = useState(false);

  // ─── Traffic ──────────────────────────────────────────────────────────────
  const [traffic, setTraffic] = useState<TrafficSettings>(DEFAULT_TRAFFIC);
  const hasSshLogin = !!system?.username;
  useEffect(() => { if (!hasSshLogin) setTraffic(t => (t.enabled ? { ...t, enabled: false } : t)); }, [hasSshLogin]);
  const trafficJobRef = useRef<string | null>(null);
  const trafficProblem = trafficBlocker(traffic, { hasSshLogin, ueIp });
  const [trafficNote, setTrafficNote] = useState<string | null>(null);
  /** A job this panel started is still running, so offer a manual Stop. */
  const [trafficLive, setTrafficLive] = useState(false);

  const startTraffic = useCallback(async (durationSec: number) => {
    if (!traffic.enabled || !system || !ueIp) return;
    const r = await postJson('/api/traffic/jobs', {
      action: 'start',
      creds: sshCredsOf(system),
      direction: traffic.direction, generator: traffic.generator, protocol: traffic.protocol,
      ueIp, serverIp: gatewayFor(ueIp),
      bitrateMbps: traffic.bitrateMbps, durationSec,
    }).catch(e => ({ success: false, error: e.message }));
    if (r.success && r.job) { trafficJobRef.current = r.job.id; setTrafficLive(true); setTrafficNote(`Traffic running: ${r.job.label}`); }
    else setTrafficNote(`Traffic did not start: ${r.error ?? 'unknown error'} — the run continues without it.`);
  }, [traffic, system, ueIp]);

  const stopTraffic = useCallback(async (note = 'Traffic stopped with the run.') => {
    const id = trafficJobRef.current;
    if (!id) return;
    trafficJobRef.current = null;
    setTrafficLive(false);
    await postJson('/api/traffic/jobs', { action: 'stop', id }).catch(() => {});
    setTrafficNote(note);
  }, []);

  // ─── Test Execution link ──────────────────────────────────────────────────
  const [tests, setTests] = useState<TestScenarioRecord[]>([]);
  const [testId, setTestId] = useState(NO_TEST);
  const [deployFirst, setDeployFirst] = useState(false);
  const [showLink, setShowLink] = useState(false);
  useEffect(() => { listTestScenarios().then(setTests).catch(() => setTests([])); }, []);
  const test = tests.find(t => t.id === testId) ?? null;

  // A cleared number input leaves '' behind; drop those so the scenario's own
  // default is used rather than sending a non-number to the runner.
  const sentParams = () => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined));

  const baseBody = () => ({
    scenarioId, host, imsi,
    enbPort: Number(enbPort) || 9001, mmePort: Number(mmePort) || 9000,
    params: sentParams(), strict,
    systemId: system ? String(system.id) : undefined, systemName: system?.name ?? (systemId === CUSTOM ? host : undefined),
    creds: system?.username ? sshCredsOf(system) : undefined,
    linkedTest: test ? { id: test.id, name: test.name } : undefined,
  });

  // ─── Preflight ────────────────────────────────────────────────────────────
  const [checks, setChecks] = useState<PreflightCheck[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preflight = async () => {
    setBusy('preflight'); setError(null);
    const r = await postJson('/api/scenarios/run', { ...baseBody(), action: 'preflight' }).catch(e => ({ success: false, error: e.message }));
    setBusy(null);
    if (!r.success) { setError(r.error); setChecks(null); return; }
    setChecks(r.checks);
    if (r.cells?.length) setCells(r.cells);
  };

  // ─── Active run ───────────────────────────────────────────────────────────
  const [run, setRun] = useState<RunView | null>(null);
  const eventsRef = useRef(0);
  const cancelRef = useRef({ cancelled: false });
  const [active, setActive] = useState<RunSummary[]>([]);

  const pollingRef = useRef(false);
  const poll = useCallback(async (id: string) => {
    if (pollingRef.current) return; // a slow poll must not append the same events twice
    pollingRef.current = true;
    const r = await fetch(`/api/scenarios/jobs?id=${id}&eventsFrom=${eventsRef.current}`).then(x => x.json()).catch(() => null)
      .finally(() => { pollingRef.current = false; });
    if (!r?.success) return;
    const next = r.run as RunView & { eventsTotal: number };
    setRun(prev => {
      const events = prev && prev.id === id ? [...prev.events, ...next.events] : next.events;
      return { ...next, events };
    });
    eventsRef.current = next.eventsTotal;
    if (next.endedAt) onFinished?.();
  }, [onFinished]);

  useEffect(() => {
    if (!run || run.endedAt) return;
    const t = setInterval(() => poll(run.id), 1000);
    return () => clearInterval(t);
  }, [run?.id, run?.endedAt, poll]); // eslint-disable-line react-hooks/exhaustive-deps

  // Traffic outlives nothing: the moment the run ends — passed, failed,
  // aborted or errored — the generator is stopped.
  useEffect(() => { if (run?.endedAt) void stopTraffic(); }, [run?.endedAt, stopTraffic]);
  useEffect(() => () => { void stopTraffic(); }, [stopTraffic]);

  useEffect(() => {
    const load = () => fetch('/api/scenarios/jobs').then(x => x.json()).then(r => r.success && setActive(r.runs)).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const [deploySteps, setDeploySteps] = useState<{ name: string; status: string; error?: string }[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const summary = useMemo(() => runSummary(scenario, params, cells), [scenario, params, cells]);
  const estimateSec = useMemo(() => {
    const m = /~\s*([\d.]+)\s*(s|min)/.exec(summary);
    if (!m) return 300;
    return Math.round(Number(m[1]) * (m[2] === 'min' ? 60 : 1));
  }, [summary]);

  const start = async () => {
    setError(null); setBusy('start'); eventsRef.current = 0; setRun(null); setDeploySteps([]); setStatus(null); setTrafficNote(null);
    cancelRef.current = { cancelled: false };
    try {
      let started: RunView | null = null;
      if (deployFirst && test && system) {
        started = await runDeployThenMobility({
          test, system, enbPort: Number(enbPort) || undefined, mmePort: Number(mmePort) || undefined,
          mobility: { scenarioId, imsi, params: sentParams() },
          onDeploySteps: s => setDeploySteps(s.map(x => ({ name: x.name, status: x.status, error: x.error }))),
          onStatus: setStatus, signal: cancelRef.current,
        });
        setRun(started);
        eventsRef.current = started.events.length;
      } else {
        const r = await postJson('/api/scenarios/run', { ...baseBody(), action: 'start' });
        if (r.run) { setRun(r.run); eventsRef.current = r.run.events.length; if (r.success) started = r.run; }
        if (!r.success) setError(r.error ?? 'Did not start');
      }
      if (started) {
        // Traffic first, so the first samples land before the first handover.
        if (traffic.enabled && !trafficProblem) await startTraffic(estimateSec + 60);
        poll(started.id);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
      await stopTraffic();
    } finally { setBusy(null); setStatus(null); }
  };

  const stop = async () => {
    cancelRef.current.cancelled = true;
    await stopTraffic();
    if (run && !run.endedAt) await postJson('/api/scenarios/jobs', { action: 'stop', id: run.id });
  };

  /** Answer an operator step (the run waits for the person at the bench). */
  const answerPrompt = async (response: 'continue' | 'skip' | 'abort') => {
    if (!run?.prompt) return;
    await postJson('/api/scenarios/jobs', { action: 'prompt', id: run.id, promptId: run.prompt.id, response });
    poll(run.id);
  };

  const attach = async () => {
    if (!test) return;
    try {
      await attachMobility(test.id, { scenarioId, imsi, params: sentParams() });
      setTests(await listTestScenarios());
      setStatus(`Attached "${scenario?.name}" to test "${test.name}"`);
    } catch (e: any) { setError(e.message); }
  };

  const running = !!run && !run.endedAt;
  const blockers = [
    !scenario && 'Pick a scenario.',
    !hostOk && 'Pick a system or enter a host IP.',
    !/^\d{5,15}$/.test(imsi) && 'Pick the UE (IMSI).',
    deployFirst && !test && 'Pick the test to deploy.',
    deployFirst && !system && 'Deploying needs a saved system with SSH login.',
    trafficProblem && 'Fix the traffic settings (or turn traffic off).',
  ].filter(Boolean) as string[];
  const busyElsewhere = active.find(a => a.host === host && !a.endedAt && a.id !== run?.id);

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        {/* ── Target ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Kicker>Mobility scenario</Kicker>
            <Select value={scenarioId} onValueChange={onScenarioChange} disabled={running}>
              <SelectTrigger><SelectValue placeholder="Pick a scenario" /></SelectTrigger>
              <SelectContent>
                {scenarios.map(s => <SelectItem key={s.id} value={s.id} description={`${s.steps.length} steps · ≥${s.requirements.minCells} cells`}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {scenario && <RequirementBadges r={scenario.requirements} />}
            {scenario && <p className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">{scenario.description}</p>}
          </div>

          <div className="space-y-1">
            <Kicker>System</Kicker>
            <Select value={systemId} onValueChange={setSystemId} disabled={running}>
              <SelectTrigger><SelectValue placeholder="Pick a system" /></SelectTrigger>
              <SelectContent>
                {systems.map(s => <SelectItem key={s.id} value={String(s.id)} description={s.ip}>{s.name}</SelectItem>)}
                <SelectItem value={CUSTOM} description="Any callbox by IP (e.g. a mock)">Custom host…</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-[1fr_70px_70px] gap-1">
              <Input className="num h-8 text-xs" placeholder="host IP" disabled={systemId !== CUSTOM || running} value={systemId === CUSTOM ? customHost : host} onChange={e => setCustomHost(e.target.value)} />
              <Input className="num h-8 text-xs" title="eNB remote API port" value={enbPort} onChange={e => setEnbPort(e.target.value)} disabled={running} />
              <Input className="num h-8 text-xs" title="MME remote API port" value={mmePort} onChange={e => setMmePort(e.target.value)} disabled={running} />
            </div>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {cells.length ? <>{cells.length} cells: {cells.map(c => c.id).join(', ')}</> : cellError ? <span className="text-amber-700 dark:text-amber-400">{cellError}</span> : 'Reading cells…'}
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={loadCells} title="Re-read the cells"><RefreshCw className="h-3 w-3" /></Button>
            </p>
            {busyElsewhere && <p className="text-xs text-amber-700 dark:text-amber-400">Busy: {busyElsewhere.scenarioName} ({busyElsewhere.state})</p>}
          </div>

          <div className="space-y-1">
            <Kicker>UE (IMSI, from the core)</Kicker>
            <div className="flex gap-1">
              <Select value={imsi} onValueChange={setImsi} disabled={!ues.length || running}>
                <SelectTrigger><SelectValue placeholder={ueError ? 'Core unreachable' : 'No UEs attached'} /></SelectTrigger>
                <SelectContent>
                  {ues.map(u => <SelectItem key={u.imsi} value={u.imsi} description={`${u.rat} · ${u.registered ? 'registered' : 'not registered'} · ${u.bearers.map(b => b.ip).filter(Boolean).join(', ')}`}>{u.imsi}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="icon" variant="outline" className="shrink-0" onClick={loadUes} title="Refresh UEs"><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <p className="text-[11px] text-muted-foreground">{ueIp ? <>IP {ueIp} — traffic goes here.</> : 'No IP yet; the UE has to be attached with a bearer.'}</p>

          </div>
        </div>

        {/* ── Parameters ──────────────────────────────────────────────────── */}
        <div className="border-t border-border pt-3">
          <ParamControls scenario={scenario} cells={cells} values={params} onChange={setParams} disabled={running} />
        </div>

        {/* ── Traffic ─────────────────────────────────────────────────────── */}
        <div className="border-t border-border pt-3">
          <TrafficControls
            value={traffic} onChange={setTraffic} hasSshLogin={hasSshLogin} ueIp={ueIp}
            disabled={running}
          />
          {(trafficNote || trafficLive) && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {trafficNote && <p className="text-[11px] text-muted-foreground">{trafficNote}</p>}
              {trafficLive && (
                <Button size="sm" variant="destructive" className="h-7"
                  onClick={() => { void stopTraffic('Traffic stopped.'); }}>
                  <Square className="mr-1 h-3.5 w-3.5" />Stop traffic
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Run bar ─────────────────────────────────────────────────────── */}
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-sm">
            <span className="font-medium">This run: </span>
            {summary}
            {traffic.enabled && !trafficProblem && <> {traffic.bitrateMbps} Mbps {traffic.direction === 'dl' ? 'downlink' : 'uplink'} runs throughout.</>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <Button variant="destructive" onClick={stop}><Square className="mr-2 h-4 w-4" />Stop (undoes everything)</Button>
            ) : (
              <Button size="lg" onClick={start} disabled={!!busy || blockers.length > 0 || !!busyElsewhere}>
                {busy === 'start' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                {deployFirst ? 'Deploy + run' : 'Run scenario'}
              </Button>
            )}
            <Button variant="outline" onClick={preflight} disabled={!!busy || running || blockers.length > 0}>
              {busy === 'preflight' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Check first
            </Button>
            <label className="flex items-center gap-2 text-xs"><Switch checked={strict} onCheckedChange={setStrict} disabled={running} />Refuse to start on any warning</label>
            {blockers.length > 0 && <span className="text-xs text-amber-700 dark:text-amber-400">{blockers[0]}</span>}
            {status && <span className="text-xs text-muted-foreground">{status}</span>}
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertTitle>Not started</AlertTitle><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}

        {run?.prompt && !run.endedAt && (
          <Alert className="border-primary/60 bg-primary/5">
            <AlertTitle>Operator action needed</AlertTitle>
            <AlertDescription className="space-y-2 text-sm">
              <p className="font-medium">{run.prompt.text}</p>
              {run.prompt.detail && <p className="text-xs text-muted-foreground">{run.prompt.detail}</p>}
              <p className="text-[11px] text-muted-foreground">SimTool does not control the phone. No answer within {Math.round(run.prompt.timeoutMs / 1000)} s ends the run INCONCLUSIVE; Skip does too.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => answerPrompt('continue')}>{run.prompt.continueLabel ?? 'Continue'}</Button>
                <Button size="sm" variant="outline" onClick={() => answerPrompt('skip')}>Skip</Button>
                <Button size="sm" variant="ghost" onClick={() => answerPrompt('abort')}>Abort</Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {checks && !run && (
          <div className="space-y-1 rounded border border-border p-2 text-xs">
            <Kicker>Check results</Kicker>
            {checks.map(c => (
              <div key={c.name} className="flex gap-2">
                <Badge variant={c.ok ? 'success' : c.level === 'error' ? 'destructive' : 'warning'} className="h-5 shrink-0">{c.ok ? 'ok' : c.level === 'error' ? 'blocked' : 'warning'}</Badge>
                <span>{plainCheck(c)}</span>
              </div>
            ))}
          </div>
        )}

        {deploySteps.length > 0 && (
          <div className="space-y-0.5 rounded border border-border p-2 text-xs">
            <Kicker>Deploy</Kicker>
            {deploySteps.map((s, i) => (
              <div key={i} className={cn(s.status === 'failure' && 'text-destructive')}>{s.status} — {s.name}{s.error ? `: ${s.error}` : ''}</div>
            ))}
          </div>
        )}

        {/* ── Test Execution link (rarely used; folded away) ──────────────── */}
        <div className="border-t border-border pt-2">
          <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setShowLink(v => !v)}>
            {showLink ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Link2 className="h-3 w-3" />Link this run to a Test Execution scenario{test ? ` — ${test.name}` : ''}
          </button>
          {showLink && (
            <div className="mt-2 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={testId} onValueChange={setTestId} disabled={running}>
                  <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEST}>None</SelectItem>
                    {tests.map(t => <SelectItem key={t.id} value={t.id} description={`${t.topology} · ${t.system?.name ?? 'no system'}${t.mobility ? ` · mobility: ${t.mobility.scenarioId}` : ''}`}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-xs"><Switch checked={deployFirst} disabled={!test || running} onCheckedChange={setDeployFirst} />Deploy its configs first</label>
                <Button size="sm" variant="outline" disabled={!test || !scenario || running} onClick={attach}>Attach scenario to test</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Runs are linked to the test in History; attaching stores <code>mobility</code> on the test record so a test = config + mobility scenario.</p>
            </div>
          )}
        </div>
      </Card>

      {run && (
        <>
          <LiveRunView run={run} live={!run.endedAt} host={host} enbPort={Number(enbPort) || 9001} mmePort={Number(mmePort) || 9000} fallbackCells={cells} />
          <RunDetail run={run} live={!run.endedAt} />
        </>
      )}

      {!run && cells.length > 0 && scenario && (
        <Card className="p-3">
          <LiveCellPreview cells={cells} params={params} />
        </Card>
      )}
    </div>
  );
}

/** Before a run: the cells as they are now, with the scenario's pair marked. */
function LiveCellPreview({ cells, params }: { cells: CellInfo[]; params: Record<string, unknown> }) {
  const pair = Array.isArray(params.pair) ? (params.pair as number[]) : [];
  return (
    <>
      <CellMap cells={cells} hint="Not running — this is the config on the callbox right now." />
      {pair.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          This scenario moves the UE between {pair.map(i => (cells[i] ? cellLabel(cells[i]) : `index ${i}`)).join(' and ')}.
        </p>
      )}
    </>
  );
}

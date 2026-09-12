// Statistics — live KPIs from an Amarisoft remote API, laid out like
// Simnovator's Statistics page: Global / Cell / UE tabs with a time window and
// poll interval, in the Simnovus design language shared with SimQA.
//
// Connection state lives here so all three tabs share one socket.
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Kicker } from '@/components/ui/stat';
import { PlayCircle, StopCircle, AlertCircle, RefreshCcw, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import { useEnbStats } from '../../hooks/useEnbStats';
import { parseMessage, toTimePoint, type ModuleKey, type TimePoint } from './statsModel';
import { GlobalStatsTab } from './GlobalStatsTab';
import { CellStatsTab } from './CellStatsTab';
import { UeStatsTab } from './UeStatsTab';

// Amarisoft's typical remote-API ports; overridable per system.
const MODULES: Array<{ key: ModuleKey; label: string; port: number }> = [
  { key: 'enb', label: 'eNB (LTE)',    port: 9001 },
  { key: 'gnb', label: 'gNB (5G NR)',  port: 9002 },
  { key: 'mme', label: 'MME / EPC',    port: 9000 },
  { key: 'ims', label: 'IMS',          port: 9003 },
  { key: 'ue',  label: 'UE Simulator', port: 9002 },
];
const defaultPortFor = (m: ModuleKey) => MODULES.find(x => x.key === m)?.port ?? 9001;

const WINDOWS = [
  { key: '1m',  label: '1m',  ms: 60_000 },
  { key: '5m',  label: '5m',  ms: 5 * 60_000 },
  { key: '15m', label: '15m', ms: 15 * 60_000 },
  { key: '1h',  label: '1h',  ms: 60 * 60_000 },
] as const;
type WindowKey = (typeof WINDOWS)[number]['key'];

const POLLS = [1000, 2000, 5000];

type TabKey = 'global' | 'cell' | 'ue';

export function EnbMonitoringDashboard() {
  const { systems, loading: systemsLoading } = useSystems();

  // ─── Target ──────────────────────────────────────────────────────────────
  const [selectedSystemId, setSelectedSystemId] = useState<string>('');
  const [module, setModule] = useState<ModuleKey>('enb');
  const [portOverride, setPortOverride] = useState<string>('');

  const selectedSystem = useMemo(
    () => systems.find(s => String(s.id) === selectedSystemId),
    [systems, selectedSystemId],
  );

  // Override beats module default; an empty or invalid override falls back to
  // the default so nobody connects to port 0 by accident.
  const effectivePort = useMemo(() => {
    const n = parseInt(portOverride, 10);
    return Number.isFinite(n) && n > 0 && n < 65536 ? n : defaultPortFor(module);
  }, [portOverride, module]);

  // Quick Run's "View live stats →" hands the target over in sessionStorage.
  // Read once on mount and clear, so a later manual visit starts fresh.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem('simtool_monitor_target');
      if (!raw) return;
      window.sessionStorage.removeItem('simtool_monitor_target');
      const parsed = JSON.parse(raw) as { systemId?: string; module?: ModuleKey };
      if (parsed.systemId) setSelectedSystemId(String(parsed.systemId));
      if (parsed.module && MODULES.some(m => m.key === parsed.module)) {
        setModule(parsed.module as ModuleKey);
      }
    } catch { /* malformed handoff — fall through to defaults */ }
  }, []);

  // Pick the first system once loaded, unless the handoff already chose one.
  useEffect(() => {
    if (!selectedSystemId && systems.length > 0) {
      setSelectedSystemId(String(systems[0].id));
    }
  }, [systems, selectedSystemId]);

  // ─── View settings ───────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabKey>('global');
  const [windowKey, setWindowKey] = useState<WindowKey>('5m');
  const [pollMs, setPollMs] = useState<number>(1000);

  // ─── Samples ─────────────────────────────────────────────────────────────
  const [series, setSeries] = useState<TimePoint[]>([]);
  const [currentStats, setCurrentStats] = useState<any>(null);

  // History for the widest window is kept regardless of the selected one, so
  // widening the window shows data already collected instead of starting over.
  const maxPoints = Math.ceil(WINDOWS[WINDOWS.length - 1].ms / pollMs);

  useEffect(() => {
    setSeries([]);
    setCurrentStats(null);
  }, [selectedSystemId, module, effectivePort]);

  const handleStatsUpdate = useCallback((raw: any) => {
    const parsed = parseMessage(raw);
    if (!parsed) return;
    const point = toTimePoint(parsed);
    setSeries(prev => {
      const next = [...prev, point];
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
    setCurrentStats(parsed);
  }, [maxPoints]);

  const targetIp = selectedSystem?.ip ?? '';
  const { phase, error, isConnected, startMonitoring, stopMonitoring, request } =
    useEnbStats(targetIp, effectivePort, {
      pollInterval: pollMs,
      onStatsUpdate: handleStatsUpdate,
    });

  const windowMs = WINDOWS.find(w => w.key === windowKey)?.ms ?? WINDOWS[1].ms;
  const visible = useMemo(() => {
    const now = Date.now();
    return series.filter(p => now - p.t <= windowMs);
  }, [series, windowMs]);
  const latest = series.length ? series[series.length - 1] : null;

  // ─── No systems yet ──────────────────────────────────────────────────────
  if (!systemsLoading && systems.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader icon={<LineChart />} title="Statistics" />
        <Card accent className="space-y-3 px-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No systems to monitor yet</h2>
          <p className="text-sm text-muted-foreground">
            Add a callbox or other Amarisoft system in Test Systems before you can view its stats.
          </p>
          <Link href="/systems">
            <Button>Go to Test Systems</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const canConnect = !!selectedSystem && phase !== 'connecting';
  const noData = !isConnected && series.length === 0;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<LineChart />}
        title="Statistics"
        subtitle="Live KPIs from the Amarisoft remote API"
        actions={
          <StatusPill
            connected={isConnected}
            connecting={phase === 'connecting'}
            target={selectedSystem ? `${targetIp}:${effectivePort}` : ''}
          />
        }
      />

      {/* ─── Target ─────────────────────────────────────────────────────── */}
      <Card className="p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_120px_auto] md:items-end">
          <div className="space-y-1">
            <Kicker>System</Kicker>
            <Select value={selectedSystemId} onValueChange={setSelectedSystemId} disabled={isConnected}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a system" />
              </SelectTrigger>
              <SelectContent>
                {systems.map(s => (
                  <SelectItem key={s.id} value={String(s.id)} description={s.ip}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Kicker>Module</Kicker>
            <Select value={module} onValueChange={v => setModule(v as ModuleKey)} disabled={isConnected}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map(m => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Kicker>Port</Kicker>
            <Input
              type="number"
              className="num h-9"
              placeholder={String(defaultPortFor(module))}
              value={portOverride}
              onChange={e => setPortOverride(e.target.value)}
              disabled={isConnected}
            />
          </div>

          <div className="flex gap-2">
            {!isConnected ? (
              <Button onClick={startMonitoring} disabled={!canConnect} className="min-w-[128px]">
                {phase === 'connecting' ? (
                  <><RefreshCcw className="mr-2 h-4 w-4 animate-spin" />Connecting…</>
                ) : (
                  <><PlayCircle className="mr-2 h-4 w-4" />Connect</>
                )}
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopMonitoring} className="min-w-[128px]">
                <StopCircle className="mr-2 h-4 w-4" />Disconnect
              </Button>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection problem</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{error.message}</p>
            <p className="text-[11px] opacity-80">
              Common causes: the callbox isn't running, the remote API isn't enabled on this port,
              the host isn't reachable from this browser, or the page is HTTPS but the callbox only
              speaks <code>ws://</code>.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* ─── Global / Cell / UE ─────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={v => setTab(v as TabKey)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <TabsList>
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="cell">Cell</TabsTrigger>
            <TabsTrigger value="ue">UE</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-4 pb-1.5">
            <div className="flex items-center gap-2">
              <Kicker>Window</Kicker>
              <Segmented
                value={windowKey}
                options={WINDOWS.map(w => ({ key: w.key, label: w.label }))}
                onChange={k => setWindowKey(k as WindowKey)}
              />
            </div>
            <div className="flex items-center gap-2" title={isConnected ? 'Disconnect to change the poll interval' : undefined}>
              <Kicker>Poll</Kicker>
              <Select value={String(pollMs)} onValueChange={v => setPollMs(Number(v))} disabled={isConnected}>
                <SelectTrigger className="num h-8 w-[76px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLLS.map(p => (
                    <SelectItem key={p} value={String(p)}>{p / 1000}s</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <TabsContent value="global">
          {noData ? <NotConnected /> : <GlobalStatsTab latest={latest} series={visible} stats={currentStats} module={module} />}
        </TabsContent>

        <TabsContent value="cell">
          {noData ? <NotConnected /> : <CellStatsTab stats={currentStats} series={visible} module={module} />}
        </TabsContent>

        <TabsContent value="ue">
          <UeStatsTab module={module} isConnected={isConnected} active={tab === 'ue'} request={request} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotConnected() {
  return (
    <Card className="p-10 text-center text-sm text-muted-foreground">
      Pick a system and module, then <span className="font-medium text-foreground">Connect</span> to start streaming statistics.
    </Card>
  );
}

function StatusPill({ connected, connecting, target }: { connected: boolean; connecting: boolean; target: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]',
        connected
          ? 'border-brand-teal/30 bg-brand-teal/10 text-brand-teal-600 dark:text-brand-teal-400'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          connected ? 'animate-pulse bg-brand-teal' : connecting ? 'animate-pulse bg-brand-orange' : 'bg-muted-foreground/60',
        )}
      />
      <span className="font-medium">{connected ? 'Live' : connecting ? 'Connecting' : 'Idle'}</span>
      {target ? <span className="num">{target}</span> : null}
    </div>
  );
}

function Segmented({
  value, options, onChange,
}: { value: string; options: Array<{ key: string; label: string }>; onChange: (key: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-input bg-muted p-0.5">
      {options.map(o => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            'h-7 rounded-md px-2.5 font-mono text-[11px] transition-colors',
            value === o.key
              ? 'bg-card text-foreground shadow-sm ring-1 ring-inset ring-border'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

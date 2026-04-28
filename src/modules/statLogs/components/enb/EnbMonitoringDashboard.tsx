// Monitoring dashboard.
//
// Originally hard-coded to a single eNB IP and port 9001. Now lets the user:
//   1. Pick from saved systems (no more typing IPs)
//   2. Pick which Amarisoft module to monitor (eNB / gNB / MME / IMS / UE)
//   3. Override the remote-API port if their setup is non-standard
//
// Connection state is hoisted to this component so the Overview / Performance /
// Detailed tabs all share a single connection — connecting once is enough.
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import {
  PlayCircle,
  StopCircle,
  Signal,
  AlertCircle,
  RefreshCcw,
} from 'lucide-react';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import { useEnbStats } from '../../hooks/useEnbStats';
import { EnbStatsView } from './EnbStatsView';
import { PerformanceView, DetailedStatsView } from './StatsViews';
import { DashboardSettings } from './DashboardComponents';

// ─── Module options + default remote-API ports ──────────────────────────────
// Defaults below are Amarisoft's typical remote-API ports; users can override
// per system if their deployment uses a different port.
type ModuleKey = 'enb' | 'gnb' | 'mme' | 'ims' | 'ue';

const MODULES: Array<{ key: ModuleKey; label: string; port: number }> = [
  { key: 'enb', label: 'eNB (LTE)',         port: 9001 },
  { key: 'gnb', label: 'gNB (5G NR)',       port: 9002 },
  { key: 'mme', label: 'MME / EPC',         port: 9000 },
  { key: 'ims', label: 'IMS',               port: 9003 },
  { key: 'ue',  label: 'UE Simulator',      port: 9002 },
];

const defaultPortFor = (m: ModuleKey) =>
  MODULES.find(x => x.key === m)?.port ?? 9001;

// ─── Time-series data point shape ───────────────────────────────────────────
interface TimeSeriesDataPoint {
  timestamp: number;
  dl_bitrate: number;  // Mbps, summed across cells
  ul_bitrate: number;
  dl_prb: number;      // PRB utilization %, max across cells
  ul_prb: number;
}

/**
 * Pull the headline KPIs out of an Amarisoft `stats` response.
 *
 * Field shape varies by release:
 *   - Modern (current docs): per-cell under `cells["1"].dl_bitrate` (bps),
 *     `cells["1"].ul_bitrate`, `cells["1"].dl_use_avg` (0..1 ratio),
 *     `cells["1"].ul_use_avg`.
 *   - Legacy / wrapper APIs sometimes emit top-level `throughput.dl`
 *     and `prb_utilization.dl`.
 *
 * We prefer per-cell when present and fall back to top-level otherwise so
 * the dashboard works against either shape without configuration.
 */
function aggregateKpis(parsed: any): TimeSeriesDataPoint {
  const ts = parsed?.timestamp ?? Date.now();

  const cells = parsed?.cells && typeof parsed.cells === 'object'
    ? Object.values(parsed.cells as Record<string, any>)
    : [];

  if (cells.length > 0) {
    let dlBps = 0, ulBps = 0, dlUseMax = 0, ulUseMax = 0;
    for (const c of cells as any[]) {
      dlBps += Number(c?.dl_bitrate ?? 0) || 0;
      ulBps += Number(c?.ul_bitrate ?? 0) || 0;
      dlUseMax = Math.max(dlUseMax, Number(c?.dl_use_avg ?? 0) || 0);
      ulUseMax = Math.max(ulUseMax, Number(c?.ul_use_avg ?? 0) || 0);
    }
    return {
      timestamp: ts,
      dl_bitrate: dlBps / 1_000_000,
      ul_bitrate: ulBps / 1_000_000,
      dl_prb: dlUseMax * 100,
      ul_prb: ulUseMax * 100,
    };
  }

  // Legacy top-level fallback.
  return {
    timestamp: ts,
    dl_bitrate: parsed?.throughput?.dl ? parsed.throughput.dl / 1_000_000 : 0,
    ul_bitrate: parsed?.throughput?.ul ? parsed.throughput.ul / 1_000_000 : 0,
    dl_prb: parsed?.prb_utilization?.dl ? parsed.prb_utilization.dl * 100 : 0,
    ul_prb: parsed?.prb_utilization?.ul ? parsed.prb_utilization.ul * 100 : 0,
  };
}

export function EnbMonitoringDashboard() {
  const { systems, loading: systemsLoading } = useSystems();

  // ─── Selection state ─────────────────────────────────────────────────────
  const [selectedSystemId, setSelectedSystemId] = useState<string>('');
  const [module, setModule] = useState<ModuleKey>('enb');
  const [portOverride, setPortOverride] = useState<string>('');

  const selectedSystem = useMemo(
    () => systems.find(s => String(s.id) === selectedSystemId),
    [systems, selectedSystemId],
  );

  // Effective port: override beats module default. Empty/invalid override
  // falls back to the module default so the user can't accidentally connect
  // to port 0.
  const effectivePort = useMemo(() => {
    const n = parseInt(portOverride, 10);
    return Number.isFinite(n) && n > 0 && n < 65536 ? n : defaultPortFor(module);
  }, [portOverride, module]);

  // Pre-select target from sessionStorage if Quick Run handed us one.
  // This is how the "View live stats →" button on the Test Execution page
  // pops the dashboard open already pointed at the system that was just
  // deployed to. Read once on mount, clear immediately so a manual nav
  // back here later doesn't reopen the previous selection.
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
    } catch { /* malformed handoff — fall through to default behavior */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-pick the first system once they finish loading (so the empty state
  // doesn't flash if there's already exactly one saved system). Skip this
  // if the sessionStorage handoff above already set one.
  useEffect(() => {
    if (!selectedSystemId && systems.length > 0) {
      setSelectedSystemId(String(systems[0].id));
    }
  }, [systems, selectedSystemId]);

  // Reset stats when target changes — old timeseries doesn't apply to a new box.
  useEffect(() => {
    setTimeSeriesData([]);
    setCurrentStats(null);
  }, [selectedSystemId, module, effectivePort]);

  // ─── Stats state ─────────────────────────────────────────────────────────
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [currentStats, setCurrentStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [chartPeriod, setChartPeriod] =
    useState<'1min' | '5min' | '15min' | '1hour'>('5min');
  const [settings, setSettings] = useState({
    pollInterval: 1000,
    maxDataPoints: 60,
    showDetailedStats: true,
  });

  const handleStatsUpdate = useCallback(
    (stats: any) => {
      let parsed: any;
      try {
        parsed = typeof stats === 'string' ? JSON.parse(stats) : stats;
      } catch {
        return;
      }

      // Modern Amarisoft (post-2023) returns per-cell aggregates under
      // `cells.<id>` rather than top-level `throughput.*` / `prb_utilization.*`.
      // Sum across cells for the dashboard's headline numbers, with a fallback
      // to the legacy top-level fields so this also works against older
      // builds that we test against.
      const point = aggregateKpis(parsed);
      setTimeSeriesData(prev => [...prev, point].slice(-settings.maxDataPoints));
      setCurrentStats(parsed);
    },
    [settings.maxDataPoints],
  );

  // ─── Connection (hoisted from EnbStatsView so all tabs share it) ─────────
  const targetIp = selectedSystem?.ip ?? '';
  const { phase, error, isConnected, startMonitoring, stopMonitoring } =
    useEnbStats(targetIp, effectivePort, {
      pollInterval: settings.pollInterval,
      onStatsUpdate: handleStatsUpdate,
    });

  const filteredTimeSeriesData = useMemo(() => {
    const now = Date.now();
    const periodMs = {
      '1min': 60_000,
      '5min': 5 * 60_000,
      '15min': 15 * 60_000,
      '1hour': 60 * 60_000,
    }[chartPeriod];
    return timeSeriesData.filter(p => now - p.timestamp <= periodMs);
  }, [timeSeriesData, chartPeriod]);

  // ─── Empty state: no systems saved yet ───────────────────────────────────
  if (!systemsLoading && systems.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <h2 className="text-xl font-semibold">No systems to monitor yet</h2>
          <p className="text-sm text-muted-foreground">
            Add a Callbox or other Amarisoft system in Systems before you can
            view its stats.
          </p>
          <Link href="/systems">
            <Button>Go to Systems</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const canConnect = !!selectedSystem && phase !== 'connecting';

  return (
    <div className="space-y-4">
      {/* ─── Target picker ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_140px_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">System</Label>
              <Select
                value={selectedSystemId}
                onValueChange={setSelectedSystemId}
                disabled={isConnected}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a system" />
                </SelectTrigger>
                <SelectContent>
                  {systems.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} <span className="text-muted-foreground">({s.ip})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Module</Label>
              <Select
                value={module}
                onValueChange={v => setModule(v as ModuleKey)}
                disabled={isConnected}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULES.map(m => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Port <span className="opacity-60">(default {defaultPortFor(module)})</span>
              </Label>
              <Input
                type="number"
                placeholder={String(defaultPortFor(module))}
                value={portOverride}
                onChange={e => setPortOverride(e.target.value)}
                disabled={isConnected}
              />
            </div>

            <div className="flex gap-2">
              {!isConnected ? (
                <Button onClick={startMonitoring} disabled={!canConnect}>
                  {phase === 'connecting' ? (
                    <>
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopMonitoring}>
                  <StopCircle className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              )}
            </div>
          </div>

          {/* Connection status line */}
          {selectedSystem && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {isConnected ? (
                <>
                  <Signal className="w-3.5 h-3.5 text-emerald-500" />
                  Connected to <span className="font-mono">{selectedSystem.name}</span>
                  {' '}({module} on <span className="font-mono">{targetIp}:{effectivePort}</span>)
                </>
              ) : (
                <>
                  Will connect to <span className="font-mono">{targetIp}:{effectivePort}</span>
                  {' '}— pick a module and click Connect.
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection problem</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{error.message}</p>
            <p className="text-[11px] opacity-80">
              Common causes: the callbox isn't running, the remote API isn't
              enabled on this port, the host isn't reachable from this browser,
              or the page is HTTPS but the callbox only speaks <code>ws://</code>.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* ─── Tabs ──────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="detailed">Detailed Stats</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Period:</span>
            <select
              value={chartPeriod}
              onChange={e => setChartPeriod(e.target.value as typeof chartPeriod)}
              className="text-sm border rounded-md px-2 py-1"
            >
              <option value="1min">1 Minute</option>
              <option value="5min">5 Minutes</option>
              <option value="15min">15 Minutes</option>
              <option value="1hour">1 Hour</option>
            </select>
          </div>
        </div>

        <TabsContent value="overview">
          <EnbStatsView
            isConnected={isConnected}
            timeSeriesData={filteredTimeSeriesData}
            currentStats={currentStats}
          />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceView
            timeSeriesData={filteredTimeSeriesData}
            currentStats={currentStats}
          />
        </TabsContent>

        <TabsContent value="detailed">
          <DetailedStatsView
            stats={currentStats}
            showDetailed={settings.showDetailedStats}
          />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardContent className="pt-6">
              <DashboardSettings settings={settings} onSettingsChange={setSettings} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

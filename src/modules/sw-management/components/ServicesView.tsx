// Services — what Amarisoft daemons are running on a target system, what
// version, whether they auto-start at boot, and direct controls to
// stop / start / restart / disable autostart.
//
// All actions go through /api/systems/services which runs systemctl over
// SSH. The action endpoint refuses unknown unit names, so the user can't
// poke arbitrary services on the box.
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import {
  Activity, RefreshCw, Loader2, Play, Square, RotateCw, AlertCircle,
  CheckCircle2, MinusCircle, XCircle, Power, PowerOff,
} from 'lucide-react';
import { SystemSelector } from './SystemSelector';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import type { System } from '@/modules/systems/types';

interface ServiceStatus {
  unit: string;
  label: string;
  components: string[];
  state: 'active' | 'inactive' | 'failed' | 'missing' | 'unknown';
  enabled: boolean;
  version?: string;
  procCount?: number;
}

interface StatusResponse {
  success: boolean;
  error?: string;
  uname?: string;
  services: ServiceStatus[];
}

interface ActionResponse {
  success: boolean;
  error?: string;
  unit: string;
  action: string;
  output?: string;
  newStatus?: ServiceStatus;
}

function credsBody(system: System) {
  return {
    host: system.ip,
    port: system.sshPort ?? 22,
    username: system.username,
    ...(system.authMode === 'privateKey' && system.privateKey
      ? { privateKey: system.privateKey }
      : { password: system.password ?? '' }),
  };
}

export function ServicesView() {
  const { systems } = useSystems();
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const selectedSystem = systems.find(s => String(s.id) === selectedSystemId) || null;

  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<StatusResponse | null>(null);
  // Per-unit "in flight" flag so only the affected row spins.
  const [busyUnits, setBusyUnits] = useState<Set<string>>(new Set());

  const setBusy = (unit: string, on: boolean) => {
    setBusyUnits(prev => {
      const next = new Set(prev);
      if (on) next.add(unit); else next.delete(unit);
      return next;
    });
  };

  const handlePoll = async () => {
    if (!selectedSystem) return;
    setPolling(true);
    setResult(null);
    try {
      const res = await fetch('/api/systems/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credsBody(selectedSystem)),
      });
      const data: StatusResponse = await res.json();
      setResult(data);
      if (!data.success) {
        toast({ title: 'Could not poll', description: data.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Poll failed', variant: 'destructive' });
    } finally {
      setPolling(false);
    }
  };

  const runAction = async (unit: string, action: 'start' | 'stop' | 'restart' | 'enable' | 'disable') => {
    if (!selectedSystem) return;
    setBusy(unit, true);
    try {
      const res = await fetch('/api/systems/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credsBody(selectedSystem), unit, action }),
      });
      const data: ActionResponse = await res.json();
      if (data.success && data.newStatus) {
        // Patch the single row in place so the UI feels responsive.
        setResult(prev => prev ? {
          ...prev,
          services: prev.services.map(s =>
            s.unit === unit ? { ...s, ...data.newStatus, version: s.version } : s,
          ),
        } : prev);
        toast({
          title: `${action} ${unit} OK`,
          description: data.newStatus.state === 'active'
            ? `${data.newStatus.label} is now active${data.newStatus.enabled ? ' (autostart enabled)' : ''}.`
            : `${data.newStatus.label} state: ${data.newStatus.state}${data.newStatus.enabled ? ', autostart enabled' : ''}.`,
        });
      } else {
        toast({
          title: `${action} ${unit} failed`,
          description: data.error || data.output || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Action failed', variant: 'destructive' });
    } finally {
      setBusy(unit, false);
    }
  };

  const installed = result?.services.filter(s => s.state !== 'missing') ?? [];
  const missing = result?.services.filter(s => s.state === 'missing') ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold">Services on the target</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <SystemSelector
              systems={systems}
              selectedId={selectedSystemId}
              onSelect={setSelectedSystemId}
            />
            <Button
              onClick={handlePoll}
              disabled={!selectedSystem || polling}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {polling ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Polling…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Poll status</>
              )}
            </Button>
          </div>
          {result?.uname && (
            <p className="text-[11px] text-muted-foreground font-mono">
              {result.uname}
            </p>
          )}
        </CardContent>
      </Card>

      {result && !result.success && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Poll failed</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}

      {result?.success && (
        <>
          {installed.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Amarisoft services found</AlertTitle>
              <AlertDescription>
                None of the known Amarisoft systemd units are installed on this box.
                Use the Install tab to deploy a package first.
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-3">
                {installed.map(svc => (
                  <ServiceRow
                    key={svc.unit}
                    svc={svc}
                    busy={busyUnits.has(svc.unit)}
                    onAction={(a) => runAction(svc.unit, a)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {missing.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                {missing.length} known unit{missing.length === 1 ? '' : 's'} not installed on this box
              </summary>
              <ul className="mt-1 pl-4 list-disc">
                {missing.map(s => (
                  <li key={s.unit}>
                    <code className="font-mono">{s.unit}</code> — {s.label}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: ServiceStatus['state'] }) {
  switch (state) {
    case 'active':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3 mr-1" /> active
        </Badge>
      );
    case 'inactive':
      return (
        <Badge variant="secondary">
          <MinusCircle className="h-3 w-3 mr-1" /> inactive
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" /> failed
        </Badge>
      );
    case 'missing':
      return <Badge variant="outline">not installed</Badge>;
    default:
      return <Badge variant="outline">unknown</Badge>;
  }
}

function ServiceRow({
  svc, busy, onAction,
}: {
  svc: ServiceStatus;
  busy: boolean;
  onAction: (a: 'start' | 'stop' | 'restart' | 'enable' | 'disable') => void;
}) {
  const isActive = svc.state === 'active';
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{svc.label}</span>
          <code className="text-[11px] font-mono text-muted-foreground">{svc.unit}.service</code>
          <StateBadge state={svc.state} />
          {svc.enabled && (
            <Badge variant="outline" className="text-[10px]">
              <Power className="h-3 w-3 mr-1" /> autostart on
            </Badge>
          )}
          {svc.version && (
            <Badge variant="outline" className="text-[10px]">v{svc.version}</Badge>
          )}
          {(svc.procCount ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px]">{svc.procCount} proc{svc.procCount === 1 ? '' : 's'}</Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isActive ? (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('restart')} className="h-7 text-[11px]">
                {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCw className="h-3 w-3 mr-1" />}
                Restart
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => onAction('stop')} className="h-7 text-[11px]">
                {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Square className="h-3 w-3 mr-1" />}
                Stop
              </Button>
            </>
          ) : (
            <Button size="sm" variant="default" disabled={busy || svc.state === 'missing'} onClick={() => onAction('start')} className="h-7 text-[11px]">
              {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
              Start
            </Button>
          )}
          {svc.enabled ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAction('disable')}
              className="h-7 text-[11px]"
              title="Stop the unit from auto-starting at boot"
            >
              {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <PowerOff className="h-3 w-3 mr-1" />}
              Disable autostart
            </Button>
          ) : (
            svc.state !== 'missing' && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onAction('enable')}
                className="h-7 text-[11px]"
                title="Auto-start at boot"
              >
                <Power className="h-3 w-3 mr-1" /> Enable autostart
              </Button>
            )
          )}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Components: {svc.components.map(c => <code key={c} className="font-mono mr-1">{c}</code>)}
      </div>
    </div>
  );
}

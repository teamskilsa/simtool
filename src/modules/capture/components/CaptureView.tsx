// Capture — record IQ samples, protocol pcaps and logs on a callbox, bring
// the files back to the SimTool host, download or inspect them.
//
//   • IQ (RX/TX)  lteenb `trx_iq_dump` (remote API), fetched over SSH.
//   • Pcap        tcpdump on the callbox over SSH (S1AP/NGAP/GTP), or the
//                 eNB MAC-LTE pcap, which only the lteenb console can start.
//   • Logs        log_get over the remote API, levels raised then restored.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, AlertTriangle, Check, Copy, Download, FileText, Loader2, Play, Radio, RefreshCw, Square, Trash2, Waves, Activity, Terminal,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Kicker } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import type { System } from '@/modules/systems/types';
import {
  DEFAULT_API_PORT, HOST_DISK_RESERVE_BYTES, IQ_MAX_DURATION_MS, IQ_MAX_TOTAL_BYTES, IQ_WARN_BYTES, LOG_LAYERS, LOG_LEVELS,
  LOG_MAX_DURATION_SEC, PCAP_FILTERS, PCAP_MAX_DURATION_SEC, fmtBytes, fmtHz, iqEstimate,
} from '../lib/limits';
import type { CaptureJobView } from '../server/capture.server';
import type { ProbeResult } from '../server/probe';
import type { CaptureSummary } from '../server/store';
import { IqInspectPanel } from './IqInspectPanel';

type Kind = 'iq' | 'pcap' | 'log';
type Component = 'enb' | 'mme' | 'ue';

/** POST JSON; a network failure comes back as { success: false, error }. */
const postJson = async <T extends { success: boolean; error?: string }>(url: string, body: unknown): Promise<T> => {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch (e: any) {
    return { success: false, error: String(e?.message ?? e) } as T;
  }
};

const credsOf = (s: System) => ({
  host: s.ip,
  port: s.sshPort ?? 22,
  username: s.username,
  ...(s.authMode === 'privateKey' && s.privateKey ? { privateKey: s.privateKey } : { password: s.password }),
});
const hasSsh = (s: System | null) => !!s?.username && !!(s.password || s.privateKey);

const STATE_VARIANT: Record<CaptureJobView['state'], 'success' | 'warning' | 'destructive' | 'secondary'> = {
  starting: 'warning', capturing: 'success', ready: 'warning', fetching: 'success', done: 'secondary', failed: 'destructive', stopped: 'secondary', discarded: 'secondary',
};
const TYPE_ICON: Record<Kind, JSX.Element> = {
  iq: <Waves className="h-3.5 w-3.5" />, pcap: <Activity className="h-3.5 w-3.5" />, log: <FileText className="h-3.5 w-3.5" />,
};

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: React.ReactNode; disabled?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1">
      {options.map(o => (
        <Button key={o.value} size="sm" variant={value === o.value ? 'default' : 'outline'} className="flex-1" disabled={o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export function CaptureView() {
  const { systems, loading: systemsLoading } = useSystems();
  const [systemId, setSystemId] = useState('');
  const system = systems.find(s => String(s.id) === systemId) ?? null;
  useEffect(() => {
    if (!systemId && systems.length > 0) setSystemId(String(systems[0].id));
  }, [systems, systemId]);

  const [kind, setKind] = useState<Kind>('iq');

  // ─── Jobs + saved captures ──────────────────────────────────────────────
  const [jobs, setJobs] = useState<CaptureJobView[]>([]);
  const [captures, setCaptures] = useState<CaptureSummary[]>([]);
  const [hostFree, setHostFree] = useState<number | null>(null);
  const refreshJobs = useCallback(async () => {
    const r = await fetch('/api/capture/jobs').then(x => x.json()).catch(() => null);
    if (r?.success) setJobs(r.jobs);
  }, []);
  const refreshCaptures = useCallback(async () => {
    const r = await fetch('/api/capture/files').then(x => x.json()).catch(() => null);
    if (r?.success) { setCaptures(r.captures); setHostFree(r.hostFreeBytes); }
  }, []);
  const anyLive = jobs.some(j => ['starting', 'capturing', 'fetching'].includes(j.state));
  useEffect(() => {
    refreshJobs();
    refreshCaptures();
  }, [refreshJobs, refreshCaptures]);
  useEffect(() => {
    const t = setInterval(refreshJobs, anyLive ? 700 : 3000);
    return () => clearInterval(t);
  }, [refreshJobs, anyLive]);
  // A job finishing adds a saved capture.
  const doneKey = jobs.filter(j => j.state === 'done').map(j => j.id).join(',');
  useEffect(() => { refreshCaptures(); }, [doneKey, refreshCaptures]);

  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const start = async (body: Record<string, unknown>) => {
    if (!system) return;
    setStarting(true);
    setStartError(null);
    const r = await postJson<{ success: boolean; error?: string }>('/api/capture/jobs', {
      action: 'start', creds: credsOf(system), systemName: system.name, ...body,
    });
    if (!r.success) setStartError(r.error ?? 'Could not start the capture');
    setStarting(false);
    refreshJobs();
  };
  const [jobErrors, setJobErrors] = useState<Record<string, string>>({});
  const jobAction = async (id: string, action: 'stop' | 'fetch' | 'discard') => {
    const r = await postJson<{ success: boolean; error?: string }>('/api/capture/jobs', { action, id });
    setJobErrors(e => ({ ...e, [id]: r.success ? '' : r.error ?? `${action} failed` }));
    refreshJobs();
    refreshCaptures();
  };

  const [inspectId, setInspectId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CaptureSummary | null>(null);
  const deleteCapture = async (c: CaptureSummary) => {
    await fetch(`/api/capture/files?id=${c.id}`, { method: 'DELETE' }).catch(() => {});
    if (inspectId === c.id) setInspectId(null);
    refreshCaptures();
  };
  const inspecting = captures.find(c => c.id === inspectId) ?? null;

  if (!systemsLoading && systems.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader icon={<Radio />} title="Capture" />
        <Card accent className="px-6 py-10 text-center text-sm text-muted-foreground">
          Add a callbox in Test Systems before capturing.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Radio />}
        title="Capture"
        subtitle="Record IQ samples, protocol pcaps and logs on a callbox and bring them back"
        actions={anyLive ? <Badge variant="success">{jobs.filter(j => ['starting', 'capturing', 'fetching'].includes(j.state)).length} running</Badge> : undefined}
      />

      {/* ─── Target + type ──────────────────────────────────────────────── */}
      <Card className="p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.4fr] md:items-end">
          <div className="space-y-1">
            <Kicker>System</Kicker>
            <Select value={systemId} onValueChange={setSystemId}>
              <SelectTrigger><SelectValue placeholder="Pick a system" /></SelectTrigger>
              <SelectContent>
                {systems.map(s => (
                  <SelectItem key={s.id} value={String(s.id)} description={`${s.ip}${hasSsh(s) ? ' · SSH login saved' : ' · no SSH login'}`}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Kicker>Capture type</Kicker>
            <Segmented value={kind} onChange={setKind} options={[
              { value: 'iq', label: <><Waves className="mr-1 h-4 w-4" />IQ samples</> },
              { value: 'pcap', label: <><Activity className="mr-1 h-4 w-4" />Protocol pcap</> },
              { value: 'log', label: <><FileText className="mr-1 h-4 w-4" />Logs</> },
            ]} />
          </div>
        </div>
        {system && !hasSsh(system) && kind !== 'log' && (
          <Alert className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{system.name} has no SSH login</AlertTitle>
            <AlertDescription className="text-xs">
              IQ and pcap files are written on the callbox and copied back over SSH. Add the username and password (or key) for {system.ip} in
              Test Systems. Log capture works without it — it only uses the remote API.
            </AlertDescription>
          </Alert>
        )}
      </Card>

      {system && kind === 'iq' && <IqForm key={`iq-${system.id}`} system={system} hostFree={hostFree} starting={starting} onStart={start} />}
      {system && kind === 'pcap' && <PcapForm system={system} starting={starting} onStart={start} />}
      {system && kind === 'log' && <LogForm key={`log-${system.id}`} system={system} starting={starting} onStart={start} />}
      {startError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Capture not started</AlertTitle>
          <AlertDescription className="text-xs">{startError}</AlertDescription>
        </Alert>
      )}

      {/* ─── Jobs ───────────────────────────────────────────────────────── */}
      {jobs.length > 0 && (
        <Card className="divide-y divide-border">
          {jobs.map(j => <JobRow key={j.id} job={j} error={jobErrors[j.id]} onAction={jobAction} />)}
        </Card>
      )}

      {/* ─── Saved captures ─────────────────────────────────────────────── */}
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Kicker>Saved captures · data/captures</Kicker>
          <div className="flex items-center gap-2">
            {hostFree !== null && (
              <span className={cn('text-xs', hostFree < HOST_DISK_RESERVE_BYTES * 2 ? 'text-destructive' : 'text-muted-foreground')}>
                {fmtBytes(hostFree)} free on SimTool host
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={refreshCaptures}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        {captures.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No captures yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Capture</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Files</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {captures.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap text-xs">{new Date(c.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={c.state === 'complete' ? 'secondary' : 'warning'} className="gap-1">
                      {TYPE_ICON[c.type]}{c.type.toUpperCase()}{c.state !== 'complete' ? ` · ${c.state}` : ''}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{c.system.name}<span className="block text-muted-foreground">{c.system.host}</span></TableCell>
                  <TableCell className="max-w-[280px] text-xs">
                    {c.label}
                    {c.iq && (
                      <span className="block text-muted-foreground">
                        {Object.entries(c.iq.sampleRates).map(([p, r]) => `port ${p} ${(r / 1e6).toFixed(2)} Msps`).join(' · ')}
                        {c.iq.cells.length ? ` · ${c.iq.cells.map(x => x.label ?? `${x.rat.toUpperCase()} B${x.band ?? '?'}`).join(', ')}` : ''}
                      </span>
                    )}
                    {c.notes.length > 0 && <span className="block text-amber-700 dark:text-amber-400">{c.notes[0]}</span>}
                  </TableCell>
                  <TableCell className="num whitespace-nowrap text-right text-xs">{fmtBytes(c.totalBytes)}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col gap-0.5">
                      {c.files.map(f => (
                        <a key={f.name} className="inline-flex items-center gap-1 text-primary hover:underline"
                          href={`/api/capture/download?id=${c.id}&file=${encodeURIComponent(f.name)}`} download>
                          <Download className="h-3 w-3" />{f.name}
                          <span className="text-muted-foreground">{fmtBytes(f.bytes)}</span>
                        </a>
                      ))}
                      <a className="inline-flex items-center gap-1 text-muted-foreground hover:underline" href={`/api/capture/download?id=${c.id}&file=manifest.json`} download>
                        <Download className="h-3 w-3" />manifest.json
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {c.type === 'iq' && c.files.some(f => f.kind === 'iq' && f.bytes > 0) && (
                      <Button size="sm" variant={inspectId === c.id ? 'default' : 'outline'} className="mr-1 h-7" onClick={() => setInspectId(inspectId === c.id ? null : c.id)}>
                        <Waves className="mr-1 h-3.5 w-3.5" />Inspect
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setConfirmDelete(c)} aria-label="Delete capture">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {inspecting && <IqInspectPanel key={inspecting.id} capture={inspecting} onClose={() => setInspectId(null)} />}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={o => { if (!o) setConfirmDelete(null); }}
        title="Delete capture?"
        description={confirmDelete ? `${confirmDelete.label} (${fmtBytes(confirmDelete.totalBytes)}) will be removed from the SimTool host.` : ''}
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => { if (confirmDelete) deleteCapture(confirmDelete); setConfirmDelete(null); }}
      />
    </div>
  );
}

// ─── IQ form ─────────────────────────────────────────────────────────────────

function useProbe(host: string | undefined, apiPort: number) {
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!host) return;
    setLoading(true);
    const r = await postJson<{ success: boolean; error?: string; probe?: ProbeResult }>('/api/capture/probe', { host, apiPort });
    setProbe(r.success ? r.probe ?? null : null);
    setError(r.success ? null : r.error ?? 'Remote API unreachable');
    setLoading(false);
  }, [host, apiPort]);
  // Debounced: the port field changes on every keystroke.
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [load]);
  return { probe, error, loading, reload: load };
}

function IqForm({ system, hostFree, starting, onStart }: { system: System; hostFree: number | null; starting: boolean; onStart: (b: Record<string, unknown>) => void }) {
  const [apiPortText, setApiPortText] = useState(String(DEFAULT_API_PORT.enb));
  const apiPort = Number(apiPortText) || DEFAULT_API_PORT.enb;
  const { probe, error, loading, reload } = useProbe(system.ip, apiPort);
  const [selected, setSelected] = useState<number[]>([]);
  const [rx, setRx] = useState(true);
  const [tx, setTx] = useState(false);
  const [durationText, setDurationText] = useState('100');
  const [autoFetch, setAutoFetch] = useState(true);

  const ports = probe?.ports ?? [];
  useEffect(() => {
    if (ports.length && !selected.some(p => ports.some(x => x.port === p))) setSelected([ports[0].port]);
  }, [probe]); // eslint-disable-line react-hooks/exhaustive-deps

  const directions = [...(rx ? ['rx' as const] : []), ...(tx ? ['tx' as const] : [])];
  const durationMs = Math.round(Number(durationText));
  const est = iqEstimate(ports, selected, directions, Number.isFinite(durationMs) ? durationMs : 0);
  const estimated = ports.some(p => selected.includes(p.port) && p.sampleRateSource === 'estimate');

  const blockers: string[] = [];
  if (!hasSsh(system)) blockers.push('No SSH login for this system — files could not be fetched.');
  if (!probe) blockers.push(error ? `Remote API: ${error}` : 'Loading RF ports…');
  if (probe && ports.length === 0) blockers.push(`No RF ports on ${system.ip}:${apiPort} (${probe.type}) — IQ dump needs the eNB/gNB (9001) or UE simulator (9002).`);
  if (selected.length === 0) blockers.push('Pick at least one RF port.');
  if (directions.length === 0) blockers.push('Pick RX, TX or both.');
  if (!(durationMs >= 1 && durationMs <= IQ_MAX_DURATION_MS)) blockers.push(`Duration must be 1–${IQ_MAX_DURATION_MS} ms (trx_iq_dump maximum).`);
  else if (est.bytes > IQ_MAX_TOTAL_BYTES) blockers.push(`~${fmtBytes(est.bytes)} is over the ${fmtBytes(IQ_MAX_TOTAL_BYTES)} limit — use ${est.maxDurationMs} ms or less.`);
  else if (hostFree !== null && hostFree - est.bytes < HOST_DISK_RESERVE_BYTES) blockers.push(`Not enough space on the SimTool host (${fmtBytes(hostFree)} free).`);

  return (
    <Card className="space-y-3 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr]">
        <div className="space-y-1">
          <Kicker>Remote API port</Kicker>
          <Input className="num h-9" value={apiPortText} onChange={e => setApiPortText(e.target.value.replace(/\D/g, '').slice(0, 5))} />
          <p className="text-[10px] text-muted-foreground">9001 eNB/gNB · 9002 UE sim</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Kicker>RF ports {probe ? `· ${probe.name ?? probe.type}${probe.version ? ` ${probe.version}` : ''}` : ''}</Kicker>
            <Button variant="ghost" size="sm" className="h-6" onClick={reload} disabled={loading}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            {ports.map(p => {
              const on = selected.includes(p.port);
              return (
                <label key={p.port} className={cn('flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs', on ? 'border-primary bg-primary/5' : 'border-border')}>
                  <Checkbox checked={on} onCheckedChange={v => setSelected(s => (v ? [...new Set([...s, p.port])] : s.filter(x => x !== p.port)))} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="font-medium">Port {p.port}</span>{' '}
                    <span className="text-muted-foreground">
                      {(p.sampleRate / 1e6).toFixed(2)} Msps{p.sampleRateSource === 'estimate' ? ' (est.)' : ''} · {p.rxChannels.length} RX / {p.txChannels.length} TX ch
                    </span>
                    {p.cells.map(c => (
                      <span key={`${c.rat}-${c.id}`} className="block text-muted-foreground">
                        {c.label ?? `${c.rat === 'nr' ? 'NR' : c.rat === 'nbiot' ? 'NB-IoT' : 'LTE'} cell ${c.id}`}
                        {c.band !== undefined && !(c.label ?? '').includes(String(c.band)) ? ` · ${c.rat === 'nr' ? 'n' : 'B'}${c.band}` : ''}
                        {c.pci !== undefined ? ` · PCI ${c.pci}` : ''}{c.dlFreqHz ? ` · DL ${fmtHz(c.dlFreqHz)}` : ''}
                      </span>
                    ))}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
        <div className="space-y-1">
          <Kicker>Direction</Kicker>
          <div className="flex gap-1">
            <Button size="sm" variant={rx ? 'default' : 'outline'} className="flex-1" onClick={() => setRx(!rx)}>RX (uplink in)</Button>
            <Button size="sm" variant={tx ? 'default' : 'outline'} className="flex-1" onClick={() => setTx(!tx)}>TX (downlink out)</Button>
          </div>
        </div>
        <div className="space-y-1">
          <Kicker>Duration ms (max {Math.min(IQ_MAX_DURATION_MS, est.maxDurationMs)})</Kicker>
          <Input type="number" min={1} max={IQ_MAX_DURATION_MS} className="num h-9" value={durationText} onChange={e => setDurationText(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={autoFetch} onCheckedChange={v => setAutoFetch(!!v)} />
          Fetch automatically when under {fmtBytes(IQ_WARN_BYTES)}
        </label>
      </div>

      <div className={cn('rounded-md border p-2 text-xs',
        est.bytes > IQ_MAX_TOTAL_BYTES ? 'border-destructive/50 text-destructive'
          : est.bytes > IQ_WARN_BYTES ? 'border-amber-500/50 text-amber-700 dark:text-amber-400' : 'border-border text-muted-foreground')}>
        {est.bytes > IQ_WARN_BYTES && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
        {estimated ? 'Estimated' : 'Expected'} size <b>{fmtBytes(est.bytes)}</b> in {est.channels} file(s)
        {' '}(sample rate × 8 bytes × channels × duration){estimated ? '; the real rate comes back from trx_iq_dump' : ''}.
        {est.bytes > IQ_WARN_BYTES && est.bytes <= IQ_MAX_TOTAL_BYTES && ' Large: the job will wait for you to press Fetch.'}
        {' '}Written to /tmp on the callbox first (often RAM-backed), then copied over SSH and deleted there.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => onStart({ type: 'iq', apiPort, rfPorts: selected, directions, durationMs, autoFetch })}
          disabled={starting || blockers.length > 0} className="min-w-[140px]">
          {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Capture IQ
        </Button>
        {blockers.length > 0 && <span className="text-xs text-muted-foreground">{blockers[0]}</span>}
      </div>
    </Card>
  );
}

// ─── Pcap form ───────────────────────────────────────────────────────────────

function PcapForm({ system, starting, onStart }: { system: System; starting: boolean; onStart: (b: Record<string, unknown>) => void }) {
  const [method, setMethod] = useState<'tcpdump' | 'console'>('tcpdump');
  const [filter, setFilter] = useState('control');
  const [iface, setIface] = useState('any');
  const [seconds, setSeconds] = useState('30');
  const secs = Math.round(Number(seconds));
  const blockers: string[] = [];
  if (!hasSsh(system)) blockers.push('No SSH login for this system.');
  if (!(secs >= 1 && secs <= PCAP_MAX_DURATION_SEC)) blockers.push(`Seconds must be 1–${PCAP_MAX_DURATION_SEC}.`);
  if (method === 'tcpdump' && !/^[A-Za-z0-9._-]{1,15}$/.test(iface)) blockers.push('Invalid interface name.');

  return (
    <Card className="space-y-3 p-3">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No pcap in the remote API</AlertTitle>
        <AlertDescription className="text-xs">
          The 2026-09-11 docs have no remote API message for pcap. The eNB MAC-LTE pcap (Wireshark DLT 147, <code>mac-lte-framed</code>, LTE cells only)
          can only be started from the config file or the lteenb console <code>pcap</code> command; ltemme documents no pcap at all.
          So SimTool offers tcpdump on the callbox for S1AP/NGAP/GTP, or fetches a console pcap you start yourself.
        </AlertDescription>
      </Alert>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1.2fr_100px_100px] md:items-end">
        <div className="space-y-1">
          <Kicker>Method</Kicker>
          <Segmented value={method} onChange={setMethod} options={[
            { value: 'tcpdump', label: 'tcpdump on callbox' },
            { value: 'console', label: <><Terminal className="mr-1 h-4 w-4" />eNB console pcap</> },
          ]} />
        </div>
        {method === 'tcpdump' ? (
          <>
            <div className="space-y-1">
              <Kicker>Traffic</Kicker>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PCAP_FILTERS).map(([k, f]) => (
                    <SelectItem key={k} value={k} description={`${f.filter || 'no filter'} · ${f.hint}`}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Kicker>Interface</Kicker>
              <Input className="num h-9" value={iface} onChange={e => setIface(e.target.value.trim())} />
            </div>
          </>
        ) : <div className="text-xs text-muted-foreground md:col-span-2">SimTool gives you the console command with a file name it can fetch and clean up.</div>}
        <div className="space-y-1">
          <Kicker>Seconds</Kicker>
          <Input type="number" min={1} max={PCAP_MAX_DURATION_SEC} className="num h-9" value={seconds} onChange={e => setSeconds(e.target.value)} />
        </div>
      </div>
      {method === 'tcpdump' && (
        <p className="text-xs text-muted-foreground">
          Runs <code>timeout {secs || '?'} tcpdump -i {iface} -U -s 0 -w /tmp/simtool-pcap-&lt;id&gt;.pcap {PCAP_FILTERS[filter]?.filter}</code> as root (or with passwordless sudo),
          then copies the file back and deletes it on the box.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => onStart({ type: 'pcap', method, filter, iface, durationSec: secs })} disabled={starting || blockers.length > 0} className="min-w-[140px]">
          {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {method === 'tcpdump' ? 'Start pcap' : 'Prepare console pcap'}
        </Button>
        {blockers.length > 0 && <span className="text-xs text-muted-foreground">{blockers[0]}</span>}
      </div>
    </Card>
  );
}

// ─── Log form ────────────────────────────────────────────────────────────────

const DEFAULT_LAYERS: Record<Component, string[]> = { enb: ['rrc', 's1ap', 'ngap'], mme: ['nas', 's1ap', 'ngap'], ue: ['rrc', 'nas'] };

function LogForm({ system, starting, onStart }: { system: System; starting: boolean; onStart: (b: Record<string, unknown>) => void }) {
  const [component, setComponent] = useState<Component>('enb');
  const [apiPortText, setApiPortText] = useState(String(DEFAULT_API_PORT.enb));
  const apiPort = Number(apiPortText) || DEFAULT_API_PORT[component];
  const { probe, error, loading, reload } = useProbe(system.ip, apiPort);
  const [layers, setLayers] = useState<Record<string, string>>(() => Object.fromEntries(DEFAULT_LAYERS.enb.map(l => [l, 'debug'])));
  const [seconds, setSeconds] = useState('30');
  const secs = Math.round(Number(seconds));

  const pickComponent = (c: Component) => {
    setComponent(c);
    setApiPortText(String(DEFAULT_API_PORT[c]));
    setLayers(Object.fromEntries(DEFAULT_LAYERS[c].map(l => [l, 'debug'])));
  };
  const expectedType = { enb: 'ENB', mme: 'MME', ue: 'UE' }[component];
  const mismatch = probe && probe.type !== expectedType;
  const blockers = useMemo(() => {
    const out: string[] = [];
    if (!probe) out.push(error ? `Remote API: ${error}` : 'Connecting…');
    if (Object.keys(layers).length === 0) out.push('Pick at least one layer.');
    if (!(secs >= 1 && secs <= LOG_MAX_DURATION_SEC)) out.push(`Seconds must be 1–${LOG_MAX_DURATION_SEC}.`);
    return out;
  }, [probe, error, layers, secs]);

  return (
    <Card className="space-y-3 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_120px_100px] md:items-end">
        <div className="space-y-1">
          <Kicker>Component</Kicker>
          <Segmented value={component} onChange={pickComponent} options={[
            { value: 'enb', label: 'eNB / gNB' }, { value: 'mme', label: 'MME / AMF' }, { value: 'ue', label: 'UE sim' },
          ]} />
        </div>
        <div className="space-y-1">
          <Kicker>Remote API port</Kicker>
          <Input className="num h-9" value={apiPortText} onChange={e => setApiPortText(e.target.value.replace(/\D/g, '').slice(0, 5))} />
        </div>
        <div className="space-y-1">
          <Kicker>Seconds</Kicker>
          <Input type="number" min={1} max={LOG_MAX_DURATION_SEC} className="num h-9" value={seconds} onChange={e => setSeconds(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Kicker>
          Layers and level {probe ? `· ${probe.name ?? probe.type}` : ''}{probe?.logsLocked ? ' · log config LOCKED' : ''}
        </Kicker>
        <Button variant="ghost" size="sm" className="h-6" onClick={reload} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {mismatch && <p className="text-xs text-amber-700 dark:text-amber-400">Port {apiPort} answers as {probe!.type}, not {expectedType}.</p>}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        {LOG_LAYERS[component].map(l => {
          const on = l in layers;
          const current = probe?.logLayers[l];
          return (
            <div key={l} className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs', on ? 'border-primary bg-primary/5' : 'border-border')}>
              <Checkbox checked={on} onCheckedChange={v => setLayers(s => {
                const n = { ...s };
                if (v) n[l] = 'debug'; else delete n[l];
                return n;
              })} />
              <span className="font-mono">{l}</span>
              {on ? (
                <select className="ml-auto rounded border border-input bg-background px-1 py-0.5 text-[11px]" value={layers[l]}
                  onChange={e => setLayers(s => ({ ...s, [l]: e.target.value }))} aria-label={`${l} level`}>
                  {LOG_LEVELS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : current ? <span className="ml-auto text-[10px] text-muted-foreground">{current}</span> : null}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Layers set higher than their current level are raised with <code>config_set</code> for the capture and put back afterwards (also on Stop or error).
        Logs are pulled with <code>log_get</code> and written to capture.log on the SimTool host.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => onStart({ type: 'log', component, apiPort, layers, durationSec: secs })} disabled={starting || blockers.length > 0} className="min-w-[140px]">
          {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Capture logs
        </Button>
        {blockers.length > 0 && <span className="text-xs text-muted-foreground">{blockers[0]}</span>}
      </div>
    </Card>
  );
}

// ─── Job row ─────────────────────────────────────────────────────────────────

function JobRow({ job: j, error, onAction }: { job: CaptureJobView; error?: string; onAction: (id: string, a: 'stop' | 'fetch' | 'discard') => void }) {
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const capturing = j.state === 'capturing' || j.state === 'starting';
  useEffect(() => {
    if (!capturing) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [capturing]);

  const progress = j.state === 'fetching' && j.totalBytes ? (j.fetchedBytes ?? 0) / j.totalBytes
    : j.state === 'capturing' && j.captureEndsAt ? 1 - Math.max(0, j.captureEndsAt - now) / Math.max(1, j.captureEndsAt - j.startedAt)
      : null;

  return (
    <div className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATE_VARIANT[j.state]}>{j.state === 'ready' ? 'waiting for fetch' : j.state}</Badge>
        <span className="inline-flex items-center gap-1 text-sm font-medium">{TYPE_ICON[j.type]}{j.label}</span>
        <span className="text-xs text-muted-foreground">{j.system.name} · {new Date(j.startedAt).toLocaleTimeString()}</span>
        <div className="ml-auto flex gap-1">
          {j.state === 'ready' && (
            <Button size="sm" className="h-7" onClick={() => onAction(j.id, 'fetch')}>
              <Download className="mr-1 h-3.5 w-3.5" />Fetch{j.totalBytes ? ` ${fmtBytes(j.totalBytes)}` : ''}
            </Button>
          )}
          {j.state === 'ready' && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => onAction(j.id, 'discard')}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />Discard
            </Button>
          )}
          {capturing && (
            <Button size="sm" variant="destructive" className="h-7" onClick={() => onAction(j.id, 'stop')}>
              <Square className="mr-1 h-3.5 w-3.5" />Stop
            </Button>
          )}
        </div>
      </div>
      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.min(100, Math.max(0, progress * 100)).toFixed(1)}%` }} />
        </div>
      )}
      {j.consoleCommand && j.state === 'ready' && (
        <div className="flex items-center gap-2 rounded-md border border-dashed p-2 text-xs">
          <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>In the lteenb console (e.g. <code>screen -x lte</code>, ENB window) run</span>
          <code className="rounded bg-muted px-1.5 py-0.5">{j.consoleCommand}</code>
          <Button size="sm" variant="ghost" className="h-6" onClick={() => { navigator.clipboard?.writeText(j.consoleCommand!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <span className="text-muted-foreground">then Fetch once it has finished.</span>
        </div>
      )}
      {j.remoteFiles.length > 0 && j.remoteFiles.some(f => f.bytes !== null) && (
        <p className="text-xs text-muted-foreground">
          On the box: {j.remoteFiles.map(f => `${f.path.replace('/tmp/', '')} ${f.bytes === null ? '—' : fmtBytes(f.bytes)}`).join(' · ')}
          {j.state === 'fetching' && j.totalBytes ? ` · fetched ${fmtBytes(j.fetchedBytes ?? 0)} of ${fmtBytes(j.totalBytes)}` : ''}
        </p>
      )}
      {j.error && <p className="text-xs text-destructive">{j.error}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {j.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-400">{w}</p>)}
      {/* Finished jobs keep their output behind a toggle so the list stays short. */}
      <details open={!['done', 'stopped', 'discarded'].includes(j.state)}>
        <summary className="cursor-pointer text-[11px] text-muted-foreground">Output</summary>
        <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-snug">
          <span className="text-muted-foreground">$ {j.command}{'\n'}</span>
          {j.output.slice(-10).join('\n') || 'waiting…'}
        </pre>
      </details>
    </div>
  );
}

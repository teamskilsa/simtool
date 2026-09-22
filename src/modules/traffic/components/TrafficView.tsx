// Traffic — push downlink or uplink user-plane traffic to a real UE attached
// to a callbox, and watch the throughput the core measures for it.
//
// Generators:
//   • Callbox → UE (UDP): iperf on the callbox over SSH. Nothing is needed on
//     the phone; downlink only.
//   • Phone iperf3: iperf3 on a USB-connected Android phone, driven over adb,
//     against an iperf3 server SimTool starts on the callbox. Uplink or
//     downlink (reverse), TCP or UDP.
// Two throughput views, whichever generator produced the traffic:
//   • Air — lteenb's per-UE bitrate: what the radio actually delivered.
//   • Core — the MME's per-bearer byte counters: what the core forwarded. For
//     a UDP blast this is the offered load and can exceed the cell's capacity.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Play, Square, RefreshCw, Loader2, AlertCircle, Smartphone, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { Kicker, Stat } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import type { System } from '@/modules/systems/types';
import { TimeSeriesChart } from '@/modules/statLogs/components/enb/StatsCharts';
import { fmtRate } from '@/modules/statLogs/components/enb/statsModel';
import type { JobView, PhoneInfo, RadioSnapshot, RadioUe, UeInfo } from '../server/traffic.server';

type Direction = 'dl' | 'ul';
type Generator = 'callbox' | 'phone';
type Protocol = 'udp' | 'tcp';

const HISTORY = 120; // samples kept for the chart (~2 minutes at 1 Hz)

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
};

const credsOf = (s: System) => ({
  host: s.ip,
  port: s.sshPort ?? 22,
  username: s.username,
  ...(s.authMode === 'privateKey' && s.privateKey ? { privateKey: s.privateKey } : { password: s.password }),
});
const hasSsh = (s: System | null) => !!s?.username && !!(s.password || s.privateKey);

/** Callbox address on a UE's PDN: Amarisoft hands the first host address of
 *  the pool's /24 to its tun interface (e.g. UE 192.168.2.2 → 192.168.2.1). */
const gatewayFor = (ueIp: string) => ueIp.split('.').slice(0, 3).concat('1').join('.');

/** Idle UEs carry a few hundred bps: show bps/kbps/Mbps rather than "0.00 Mbps". */
const rate = (mbps: number) => { const r = fmtRate(mbps); return `${r.value} ${r.unit}`; };

/** The eNB entry for the UE that owns `ip`, joined on mme_ue_id. Falls back to
 *  the only radio UE when there is exactly one and it can't be matched. */
const radioUeFor = (radio: RadioSnapshot | null | undefined, ues: UeInfo[], ip: string): RadioUe | undefined => {
  if (!radio?.ues?.length) return undefined;
  const owner = ues.find(u => u.bearers.some(b => b.ip === ip));
  const hit = owner?.mmeUeId !== undefined ? radio.ues.find(r => r.mmeUeId === owner.mmeUeId) : undefined;
  return hit ?? (radio.ues.length === 1 ? radio.ues[0] : undefined);
};

export function TrafficView() {
  const { systems, loading: systemsLoading } = useSystems();
  const [systemId, setSystemId] = useState('');
  const system = systems.find(s => String(s.id) === systemId) ?? null;

  useEffect(() => {
    if (!systemId && systems.length > 0) setSystemId(String(systems[0].id));
  }, [systems, systemId]);

  // ─── UEs + measured throughput ───────────────────────────────────────────
  const [ues, setUes] = useState<UeInfo[]>([]);
  const [ueError, setUeError] = useState<string | null>(null);
  const [ueIp, setUeIp] = useState('');
  const [samples, setSamples] = useState<{ t: number; airDl: number; airUl: number; coreDl: number; coreUl: number }[]>([]);
  const [radio, setRadio] = useState<RadioSnapshot | null>(null);
  const lastRef = useRef<{ at: number; ip: string; dl: number; ul: number } | null>(null);

  const pollUes = useCallback(async () => {
    if (!system) return;
    const r = await postJson<{ success: boolean; at: number; ues: UeInfo[]; radio?: RadioSnapshot | null; error?: string }>(
      '/api/traffic/ues', { host: system.ip },
    ).catch(e => ({ success: false, at: Date.now(), ues: [] as UeInfo[], radio: null, error: String(e?.message ?? e) }));
    if (!r.success) { setUeError(r.error ?? 'MME unreachable'); return; }
    setUeError(null);
    setUes(r.ues);
    setRadio(r.radio ?? null);

    const bearer = r.ues.flatMap(u => u.bearers).find(b => b.ip === ueIp);
    if (!bearer) { lastRef.current = null; return; }
    const prev = lastRef.current;
    lastRef.current = { at: r.at, ip: ueIp, dl: bearer.dlBytes, ul: bearer.ulBytes };
    if (prev && prev.ip === ueIp && r.at > prev.at) {
      const secs = (r.at - prev.at) / 1000;
      // Counters reset when the UE re-attaches; don't plot a negative spike.
      const coreDl = Math.max(0, bearer.dlBytes - prev.dl) * 8 / 1e6 / secs;
      const coreUl = Math.max(0, bearer.ulBytes - prev.ul) * 8 / 1e6 / secs;
      // This UE's own radio bitrate when the eNB entry can be matched to it;
      // otherwise the eNB total, which is still what the air carried.
      const own = radioUeFor(r.radio, r.ues, ueIp);
      const airDl = ((own ?? r.radio)?.dlBps ?? 0) / 1e6;
      const airUl = ((own ?? r.radio)?.ulBps ?? 0) / 1e6;
      setSamples(s => [...s, { t: r.at, airDl, airUl, coreDl, coreUl }].slice(-HISTORY));
    }
  }, [system, ueIp]);

  useEffect(() => {
    setSamples([]);
    lastRef.current = null;
    if (!system) return;
    pollUes();
    const t = setInterval(pollUes, 1000);
    return () => clearInterval(t);
  }, [system, pollUes]);

  // Pick the first data bearer (skip IMS / emergency) once UEs show up.
  useEffect(() => {
    if (ueIp && ues.some(u => u.bearers.some(b => b.ip === ueIp))) return;
    const first = ues.flatMap(u => u.bearers).find(b => b.ip && !/^(ims|sos)$/i.test(b.apn));
    if (first?.ip) setUeIp(first.ip);
  }, [ues, ueIp]);

  // ─── Phones ──────────────────────────────────────────────────────────────
  const [phones, setPhones] = useState<PhoneInfo[]>([]);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSerial, setPhoneSerial] = useState('');
  const [iperf3Path, setIperf3Path] = useState('/data/local/tmp/iperf3');
  const [phonesLoading, setPhonesLoading] = useState(false);

  const refreshPhones = useCallback(async () => {
    setPhonesLoading(true);
    const r = await fetch('/api/traffic/phones').then(x => x.json())
      .catch(e => ({ success: false, phones: [], error: e.message }));
    setPhones(r.phones ?? []);
    setPhoneError(r.success ? null : r.error);
    if (r.iperf3Path) setIperf3Path(r.iperf3Path);
    if (!phoneSerial && r.phones?.[0]) setPhoneSerial(r.phones[0].serial);
    setPhonesLoading(false);
  }, [phoneSerial]);

  useEffect(() => { refreshPhones(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const phone = phones.find(p => p.serial === phoneSerial) ?? null;

  // ─── Generator form ──────────────────────────────────────────────────────
  const [direction, setDirection] = useState<Direction>('dl');
  const [generator, setGenerator] = useState<Generator>('callbox');
  const [protocol, setProtocol] = useState<Protocol>('udp');
  const [bitrate, setBitrate] = useState('20');
  const [duration, setDuration] = useState('30');
  const [serverIpOverride, setServerIpOverride] = useState('');
  const serverIp = serverIpOverride || (ueIp ? gatewayFor(ueIp) : '');

  // Uplink and TCP both need an endpoint on the phone.
  useEffect(() => { if (direction === 'ul') setGenerator('phone'); }, [direction]);
  useEffect(() => { if (generator === 'callbox') setProtocol('udp'); }, [generator]);

  // ─── Jobs ────────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const refreshJobs = useCallback(async () => {
    const r = await fetch('/api/traffic/jobs').then(x => x.json()).catch(() => null);
    if (r?.success) setJobs(r.jobs);
  }, []);
  useEffect(() => {
    refreshJobs();
    const t = setInterval(refreshJobs, 1000);
    return () => clearInterval(t);
  }, [refreshJobs]);

  const blockers = useMemo(() => {
    const out: string[] = [];
    if (!system) out.push('Pick a system.');
    else if (!hasSsh(system)) out.push('This system has no SSH login saved — add it in Test Systems.');
    if (!ueIp) out.push('No UE selected — attach a phone to the callbox first.');
    if (generator === 'phone') {
      if (!phone) out.push('No phone connected over USB.');
      else if (!phone.hasIperf3) out.push(`iperf3 is not on the phone yet (expected at ${iperf3Path}).`);
    }
    return out;
  }, [system, ueIp, generator, phone, iperf3Path]);

  const start = async () => {
    if (!system) return;
    setStarting(true);
    setStartError(null);
    const r = await postJson<{ success: boolean; job?: JobView; error?: string }>('/api/traffic/jobs', {
      action: 'start',
      creds: credsOf(system),
      direction, generator, protocol,
      ueIp, serverIp, phoneSerial,
      bitrateMbps: Number(bitrate),
      durationSec: Number(duration),
    }).catch(e => ({ success: false, error: e.message }));
    if (!r.success) setStartError(r.error ?? 'Could not start traffic');
    setStarting(false);
    refreshJobs();
  };

  /** Stop every job AND sweep the box for traffic processes the app lost track
   *  of — e.g. a job whose stop never reached the callbox, which would otherwise
   *  keep blasting the UE with nothing in the UI to stop it. */
  const [stoppingAll, setStoppingAll] = useState(false);
  const [stopAllNote, setStopAllNote] = useState<string | null>(null);
  const stopAll = async () => {
    setStoppingAll(true);
    setStopAllNote(null);
    const r = await postJson<{ success: boolean; stopped?: string[]; remainingOnBox?: number; error?: string }>(
      '/api/traffic/jobs',
      { action: 'stop_all', creds: system ? credsOf(system) : undefined, phoneSerials: phones.map(p => p.serial) },
    );
    setStoppingAll(false);
    setStopAllNote(r.success
      ? `Stopped ${r.stopped?.length ?? 0} job(s)${r.remainingOnBox ? `; ${r.remainingOnBox} iperf process(es) still on the box` : '; nothing left running on the callbox'}`
      : `Could not stop everything: ${r.error}`);
    refreshJobs();
  };

  const stop = async (id: string) => {
    await postJson('/api/traffic/jobs', { action: 'stop', id }).catch(() => {});
    refreshJobs();
  };

  const running = jobs.filter(j => j.state === 'running' || j.state === 'starting');
  const latest = samples.at(-1);
  const peak = samples.reduce((m, s) => ({ dl: Math.max(m.dl, s.airDl), ul: Math.max(m.ul, s.airUl) }), { dl: 0, ul: 0 });
  const radioUe = radioUeFor(radio, ues, ueIp);
  const airNote = radioUe ? 'this UE, over the air (eNB)'
    : radio && radio.ueCount > 1 ? `all ${radio.ueCount} UEs on the eNB` : 'over the air (eNB)';

  if (!systemsLoading && systems.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader icon={<Gauge />} title="Traffic" />
        <Card accent className="px-6 py-10 text-center text-sm text-muted-foreground">
          Add a callbox in Test Systems before generating traffic.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Gauge />}
        title="Traffic"
        subtitle="Push downlink or uplink traffic to a UE and watch what the core carries"
        actions={
          <div className="flex items-center gap-2">
            {running.length > 0 && <Badge variant="success">{running.length} running</Badge>}
            <Button size="sm" variant="destructive" onClick={stopAll} disabled={stoppingAll}>
              {stoppingAll ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Square className="mr-1 h-4 w-4" />}
              Stop all traffic
            </Button>
          </div>
        }
      />

      {stopAllNote && <p className="text-xs text-muted-foreground">{stopAllNote}</p>}

      {/* ─── Target ──────────────────────────────────────────────────────── */}
      <Card className="p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr] md:items-end">
          <div className="space-y-1">
            <Kicker>System</Kicker>
            <Select value={systemId} onValueChange={setSystemId}>
              <SelectTrigger><SelectValue placeholder="Pick a system" /></SelectTrigger>
              <SelectContent>
                {systems.map(s => (
                  <SelectItem key={s.id} value={String(s.id)} description={s.ip}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Kicker>UE (from the MME)</Kicker>
            <Select value={ueIp} onValueChange={setUeIp} disabled={ues.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={ueError ? 'MME unreachable' : 'No UEs attached'} />
              </SelectTrigger>
              <SelectContent>
                {ues.flatMap(u => u.bearers.filter(b => b.ip).map(b => (
                  <SelectItem key={`${u.imsi}-${b.ip}`} value={b.ip!} description={`${u.imsi} · ${u.rat} · APN ${b.apn}`}>
                    {b.ip}
                  </SelectItem>
                )))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {ueError && (
          <p className="mt-2 text-xs text-destructive">MME remote API: {ueError}</p>
        )}
      </Card>

      {/* ─── Measured throughput ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="DL air" value={latest ? rate(latest.airDl) : '—'}
          hint={latest ? `peak ${rate(peak.dl)} · core ${rate(latest.coreDl)}` : airNote} />
        <Stat label="UL air" value={latest ? rate(latest.airUl) : '—'}
          hint={latest ? `peak ${rate(peak.ul)} · core ${rate(latest.coreUl)}` : airNote} />
        <Stat label="DL MCS / CQI" value={radioUe?.dlMcs !== undefined ? `${radioUe.dlMcs.toFixed(1)} / ${radioUe.cqi ?? '—'}` : '—'}
          hint={radioUe?.cellId !== undefined
            ? `PCell ${radioUe.cellId}${radioUe.scellIds.length ? ` (+SCell ${radioUe.scellIds.join(', ')})` : ''} · rank ${radioUe.ri ?? '—'}`
            : radio && radio.ueCount > 0 ? 'UE not matched on the eNB' : 'no UE connected on the eNB'} />
        <Stat label="DL retx" value={radioUe?.dlRetxPct !== undefined ? radioUe.dlRetxPct.toFixed(1) : '—'} unit="%"
          tone={radioUe?.dlRetxPct !== undefined && radioUe.dlRetxPct > 10 && radioUe.dlTx >= 50 ? 'warn' : 'default'}
          hint={radioUe ? `${radioUe.dlTx} DL TBs, all cells` : radio ? `${radio.ueCount} UE${radio.ueCount === 1 ? '' : 's'} connected on the eNB` : 'eNB remote API unreachable'} />
      </div>
      <TimeSeriesChart
        title={`Throughput for ${ueIp || 'UE'} — air (eNB) vs core (MME)`}
        unit="Mbps"
        rate
        data={samples}
        series={[
          { key: 'airDl', label: 'DL air' },
          { key: 'airUl', label: 'UL air' },
          { key: 'coreDl', label: 'DL core (offered)' },
          { key: 'coreUl', label: 'UL core' },
        ]}
        digits={2}
      />

      {/* ─── Generator ───────────────────────────────────────────────────── */}
      <Card className="space-y-3 p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Kicker>Direction</Kicker>
            <div className="flex gap-1">
              {(['dl', 'ul'] as const).map(d => (
                <Button key={d} size="sm" variant={direction === d ? 'default' : 'outline'} className="flex-1" onClick={() => setDirection(d)}>
                  {d === 'dl' ? <ArrowDown className="mr-1 h-4 w-4" /> : <ArrowUp className="mr-1 h-4 w-4" />}
                  {d === 'dl' ? 'Downlink' : 'Uplink'}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Kicker>Generator</Kicker>
            <Select value={generator} onValueChange={v => setGenerator(v as Generator)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="callbox" disabled={direction === 'ul'} description="UDP from the callbox; nothing needed on the phone">
                  Callbox → UE
                </SelectItem>
                <SelectItem value="phone" description="iperf3 on a USB phone; uplink or downlink">
                  Phone iperf3
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Kicker>Protocol</Kicker>
            <div className="flex gap-1">
              {(['udp', 'tcp'] as const).map(p => (
                <Button key={p} size="sm" variant={protocol === p ? 'default' : 'outline'} className="flex-1"
                  disabled={p === 'tcp' && generator === 'callbox'} onClick={() => setProtocol(p)}>
                  {p.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Kicker>{protocol === 'tcp' ? 'Cap Mbps' : 'Rate Mbps'}</Kicker>
              <Input type="number" min={0.1} className="num h-9" value={bitrate} onChange={e => setBitrate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Kicker>Seconds</Kicker>
              <Input type="number" min={1} max={3600} className="num h-9" value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
          </div>
        </div>

        {generator === 'phone' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-1">
              <Kicker>Phone (USB)</Kicker>
              <Select value={phoneSerial} onValueChange={setPhoneSerial} disabled={phones.length === 0}>
                <SelectTrigger><SelectValue placeholder={phoneError ?? 'No phone connected'} /></SelectTrigger>
                <SelectContent>
                  {phones.map(p => (
                    <SelectItem key={p.serial} value={p.serial}
                      description={`${p.serial} · ${p.state !== 'device' ? p.state : p.hasIperf3 ? 'iperf3 ready' : 'iperf3 missing'}`}>
                      <Smartphone className="mr-1 inline h-3.5 w-3.5" />{p.model || p.serial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Kicker>iperf3 server (callbox on the UE's PDN)</Kicker>
              <Input className="num h-9" placeholder={serverIp || '192.168.2.1'} value={serverIpOverride}
                onChange={e => setServerIpOverride(e.target.value.trim())} />
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={refreshPhones} disabled={phonesLoading}>
              <RefreshCw className={cn('mr-1 h-4 w-4', phonesLoading && 'animate-spin')} />Phones
            </Button>
          </div>
        )}

        {generator === 'phone' && phone && !phone.hasIperf3 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>iperf3 isn't on {phone.model || phone.serial}</AlertTitle>
            <AlertDescription className="text-xs">
              Push an Android arm64 iperf3 build to the phone once, then press Phones:
              <code className="mt-1 block">adb -s {phone.serial} push iperf3 {iperf3Path} &amp;&amp; adb -s {phone.serial} shell chmod 755 {iperf3Path}</code>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={start} disabled={starting || blockers.length > 0} className="min-w-[140px]">
            {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Start {direction === 'dl' ? 'downlink' : 'uplink'}
          </Button>
          {blockers.length > 0 && <span className="text-xs text-muted-foreground">{blockers[0]}</span>}
          {startError && <span className="text-xs text-destructive">{startError}</span>}
        </div>
      </Card>

      {/* ─── Jobs ────────────────────────────────────────────────────────── */}
      {jobs.length > 0 && (
        <Card className="divide-y divide-border">
          {jobs.map(j => {
            const live = j.state === 'running' || j.state === 'starting';
            return (
              <div key={j.id} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={live ? 'success' : j.state === 'failed' ? 'destructive' : 'secondary'}>{j.state}</Badge>
                  <span className="text-sm font-medium">{j.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(j.startedAt).toLocaleTimeString()} · {j.durationSec}s
                  </span>
                  {live && (
                    <Button size="sm" variant="destructive" className="ml-auto h-7" onClick={() => stop(j.id)}>
                      <Square className="mr-1 h-3.5 w-3.5" />Stop
                    </Button>
                  )}
                </div>
                {j.error && <p className="text-xs text-destructive">{j.error}</p>}
                <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-snug">
                  <span className="text-muted-foreground">$ {j.command}{'\n'}</span>
                  {j.output.slice(-15).join('\n') || 'waiting for output…'}
                </pre>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

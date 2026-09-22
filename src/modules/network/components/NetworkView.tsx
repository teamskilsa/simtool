// Network — occasional setup tools, kept out of the everyday workflow:
//   • Find callboxes: scan the networks this SimTool host is on and add a
//     box to Test Systems in one click, instead of typing its IP.
//   • Callbox ports: see a system's ethernet ports and set a port's IPv4
//     address. Changes are guarded by a NetworkManager rollback timer.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Network, Radar, Plus, Check, Loader2, RefreshCw, AlertCircle, Undo2, ShieldCheck, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { Kicker } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import type { System } from '@/modules/systems/types';
import type { FoundBox, ScanResult } from '../server/discovery.server';
import type { NetPort } from '../server/ports.server';

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

export function NetworkView() {
  // One hook instance for both panels, so a box added by the scan shows up
  // in the ports picker straight away.
  const { systems, addSystem } = useSystems();
  return (
    <div className="space-y-4">
      <PageHeader icon={<Network />} title="Network" subtitle="Find callboxes on the network and manage their ports" />
      <FindCallboxes systems={systems} addSystem={addSystem} />
      <CallboxPorts systems={systems} />
    </div>
  );
}

// ─── Find callboxes ──────────────────────────────────────────────────────────
function FindCallboxes({ systems, addSystem }: {
  systems: System[];
  addSystem: ReturnType<typeof useSystems>['addSystem'];
}) {
  const [linkLocal, setLinkLocal] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    const r = await postJson<ScanResult & { success: boolean; error?: string }>('/api/network/discover', { linkLocal });
    if (r.success) setResult(r); else setError(r.error ?? 'Scan failed');
    setScanning(false);
  };

  const added = (b: FoundBox) => systems.some(s => s.ip === b.address);

  const add = async (b: FoundBox) => {
    const types = b.banners.map(x => x.type).filter(Boolean).join('+');
    await addSystem({ name: `${b.product ?? 'Callbox'} ${b.address}`, ip: b.address, type: 'Callbox', status: 'running' });
    toast({ title: 'Added to Test Systems', description: `${b.address}${types ? ` (${types})` : ''} — open Test Systems to add its SSH login.` });
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">Find callboxes</h2>
          <p className="text-xs text-muted-foreground">
            Scans every private network this computer is on (up to 254 addresses each) for the Amarisoft remote API.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={linkLocal} onCheckedChange={v => setLinkLocal(v === true)} />
          Also search direct cables (IPv6)
        </label>
        <Button onClick={scan} disabled={scanning} className="min-w-[128px]">
          {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
          {scanning ? 'Scanning…' : 'Scan network'}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <>
          <p className="text-xs text-muted-foreground">
            Scanned {result.scanned.map(s => `${s.cidr} on ${s.iface}`).join(', ') || 'no private networks'}
            {result.linkLocalIfaces.length > 0 && ` · direct cable on ${result.linkLocalIfaces.join(', ')}`}
            {' '}in {(result.ms / 1000).toFixed(1)} s.
          </p>
          {result.found.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No callboxes answered. Check the cable, and that the box's IP is on one of the networks above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Running</TableHead>
                  <TableHead>SimTool agent</TableHead>
                  <TableHead>Seen on</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.found.map(b => (
                  <TableRow key={b.address}>
                    <TableCell className="num">{b.address}</TableCell>
                    <TableCell>{b.product ?? '—'} <span className="text-xs text-muted-foreground">{b.version}</span></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {b.banners.length === 0 && <span className="text-xs text-muted-foreground">nothing on 9000/9001</span>}
                        {b.banners.map(x => <Badge key={x.port} variant="secondary">{x.type} :{x.port}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>{b.agent ? <Badge variant="success">installed</Badge> : <span className="text-xs text-muted-foreground">not installed</span>}</TableCell>
                    <TableCell className="text-xs">{b.iface}</TableCell>
                    <TableCell className="text-right">
                      {b.family !== 'ipv4' ? (
                        <span className="text-xs text-muted-foreground">Direct cable only — give the box an IPv4 on this network to add it</span>
                      ) : added(b) ? (
                        <Badge variant="outline"><Check className="mr-1 h-3 w-3" />In Test Systems</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => add(b)}><Plus className="mr-1 h-4 w-4" />Add</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Callbox ports ───────────────────────────────────────────────────────────
interface Pending { checkpoint: string; rollbackAt: number; device: string }

function CallboxPorts({ systems }: { systems: System[] }) {
  const [systemId, setSystemId] = useState('');
  const system = systems.find(s => String(s.id) === systemId) ?? null;
  useEffect(() => { if (!systemId && systems.length) setSystemId(String(systems[0].id)); }, [systems, systemId]);

  const [ports, setPorts] = useState<NetPort[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [method, setMethod] = useState<'manual' | 'auto'>('manual');
  const [address, setAddress] = useState('');
  const [prefix, setPrefix] = useState('24');
  const [gateway, setGateway] = useState('');
  const [applying, setApplying] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [pending]);
  const secondsLeft = pending ? Math.max(0, Math.ceil((pending.rollbackAt - now) / 1000)) : 0;

  const load = async () => {
    if (!system) return;
    setLoading(true);
    setError(null);
    const r = await postJson<{ success: boolean; ports?: NetPort[]; error?: string }>('/api/network/ports', { action: 'list', creds: credsOf(system) });
    if (r.success) setPorts(r.ports ?? []); else setError(r.error ?? 'Could not read ports');
    setLoading(false);
  };

  useEffect(() => { setPorts(null); setError(null); setEditing(null); setPending(null); }, [systemId]);

  const startEdit = (p: NetPort) => {
    setEditing(p.device);
    const [addr, pfx] = (p.ipv4[0] ?? '').split('/');
    setMethod(p.method === 'auto' ? 'auto' : 'manual');
    setAddress(addr ?? '');
    setPrefix(pfx ?? '24');
    setGateway(p.gateway && p.gateway !== '--' ? p.gateway : '');
  };

  const apply = async () => {
    if (!system || !editing) return;
    setApplying(true);
    const r = await postJson<{ success: boolean; checkpoint?: string; rollbackAt?: number; ports?: NetPort[]; error?: string }>(
      '/api/network/ports',
      { action: 'set', creds: credsOf(system), device: editing, method, address, prefix: Number(prefix), gateway, rollbackSec: 90 },
    );
    setApplying(false);
    if (!r.success) {
      toast({ title: 'Nothing changed', description: r.error, variant: 'destructive' });
      return;
    }
    setPorts(r.ports ?? null);
    setPending({ checkpoint: r.checkpoint!, rollbackAt: r.rollbackAt!, device: editing });
    setEditing(null);
  };

  const finish = async (keep: boolean) => {
    if (!system || !pending) return;
    const r = await postJson<{ success: boolean; ports?: NetPort[]; error?: string }>(
      '/api/network/ports', { action: 'commit', creds: credsOf(system), checkpoint: pending.checkpoint, keep },
    );
    if (r.success) {
      setPorts(r.ports ?? null);
      toast({ title: keep ? `Kept the new address on ${pending.device}` : `Restored ${pending.device}` });
    } else {
      toast({ title: keep ? 'Could not keep the change' : 'Could not roll back now', description: `${r.error} — NetworkManager still restores it when the timer runs out.`, variant: 'destructive' });
    }
    setPending(null);
  };

  // Once the timer is up NetworkManager has already restored the port.
  useEffect(() => {
    if (pending && secondsLeft === 0) {
      toast({ title: `${pending.device} rolled back`, description: 'The change wasn’t kept in time, so NetworkManager restored the previous address.' });
      setPending(null);
      load();
    }
  }, [secondsLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const editingPort = useMemo(() => ports?.find(p => p.device === editing) ?? null, [ports, editing]);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">Callbox ports</h2>
          <p className="text-xs text-muted-foreground">Ethernet ports on a system, read over SSH with NetworkManager.</p>
        </div>
        <div className="w-64 space-y-1">
          <Kicker>System</Kicker>
          <Select value={systemId} onValueChange={setSystemId}>
            <SelectTrigger><SelectValue placeholder="Pick a system" /></SelectTrigger>
            <SelectContent>
              {systems.map(s => <SelectItem key={s.id} value={String(s.id)} description={s.ip}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={load} disabled={!hasSsh(system) || loading || !!pending}>
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />{ports ? 'Refresh' : 'Show ports'}
        </Button>
      </div>

      {system && !hasSsh(system) && (
        <p className="text-xs text-muted-foreground">This system has no SSH login saved — add it in Test Systems to see its ports.</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {pending && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Keep the new address on {pending.device}?</AlertTitle>
          <AlertDescription className="space-y-2 text-xs">
            <p>If you do nothing, NetworkManager restores the previous settings in <span className="num font-semibold">{secondsLeft}s</span>.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => finish(true)}><Check className="mr-1 h-4 w-4" />Keep</Button>
              <Button size="sm" variant="outline" onClick={() => finish(false)}><Undo2 className="mr-1 h-4 w-4" />Roll back now</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {ports && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Port</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>IPv4</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>MAC</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ports.map(p => (
              <TableRow key={p.device}>
                <TableCell>
                  <div className="font-medium">{p.device}</div>
                  <div className="text-xs text-muted-foreground">{p.connection || 'no profile'}</div>
                </TableCell>
                <TableCell>
                  {p.carrier
                    ? <Badge variant="success">up{p.speedMbps ? ` · ${p.speedMbps >= 1000 ? `${p.speedMbps / 1000}G` : `${p.speedMbps}M`}` : ''}</Badge>
                    : <Badge variant="secondary">no cable</Badge>}
                </TableCell>
                <TableCell className="num text-xs">{p.ipv4.join(', ') || '—'}{p.gateway && p.gateway !== '--' ? <div className="text-muted-foreground">gw {p.gateway}</div> : null}</TableCell>
                <TableCell className="text-xs">{p.method === 'auto' ? 'DHCP' : p.method || '—'}</TableCell>
                <TableCell className="num text-xs">{p.mac}</TableCell>
                <TableCell className="text-right">
                  {p.inUse ? (
                    <span className="text-xs text-muted-foreground">SimTool is connected through this port</span>
                  ) : (
                    <Button size="sm" variant="outline" disabled={!!pending} onClick={() => startEdit(p)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />Set IP
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editingPort && (
        <Card className="space-y-3 border-dashed p-3">
          <div className="text-sm font-medium">Set IPv4 on {editingPort.device}</div>
          <div className="flex gap-1">
            {(['manual', 'auto'] as const).map(m => (
              <Button key={m} size="sm" variant={method === m ? 'default' : 'outline'} onClick={() => setMethod(m)}>
                {m === 'manual' ? 'Static' : 'DHCP'}
              </Button>
            ))}
          </div>
          {method === 'manual' && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_80px_2fr]">
              <div className="space-y-1"><Kicker>Address</Kicker><Input className="num h-9" placeholder="192.168.10.80" value={address} onChange={e => setAddress(e.target.value.trim())} /></div>
              <div className="space-y-1"><Kicker>Prefix</Kicker><Input type="number" min={1} max={32} className="num h-9" value={prefix} onChange={e => setPrefix(e.target.value)} /></div>
              <div className="space-y-1"><Kicker>Gateway (optional)</Kicker><Input className="num h-9" value={gateway} onChange={e => setGateway(e.target.value.trim())} /></div>
            </div>
          )}
          {!editingPort.carrier && (
            <p className="text-xs text-muted-foreground">No cable on this port: the setting is saved and takes effect when one is plugged in.</p>
          )}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              If Amarisoft uses this port (S1/NG, GTP, or the remote API), update <code>gtp_addr</code>, <code>mme_addr</code>/<code>amf_addr</code> and <code>com_addr</code> in its configs afterwards — that needs an lte restart.
            </AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button onClick={apply} disabled={applying || (method === 'manual' && !address)}>
              {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Apply with 90 s rollback
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Card>
      )}
    </Card>
  );
}

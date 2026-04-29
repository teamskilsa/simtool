// Poll License Server — query a remote `ltelicense` server's WebSocket
// remote API and list every license it has issued. Useful for picking a
// license to deploy: the user sees what's actually available before
// configuring the server-mode deploy.
//
// Address history is cached in localStorage so reconnecting to a
// previously-used server is one click. The "Use this license" button on
// each row hands the address+tag back to the Licenses tab via
// sessionStorage so the deploy form can land pre-filled.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import {
  Server, Search, Loader2, AlertCircle, History, X, ArrowRight, Filter,
} from 'lucide-react';
import { useCachedAddresses } from '../hooks/useCachedAddresses';

interface LicenseEntry {
  uid?: string;
  products?: string;
  origin?: string;
  tag?: string;
  max?: number;
  version?: string;
  connections?: Array<{ name?: string; address?: string; lifetime?: number; product?: string }>;
  shared_params?: Record<string, unknown>;
}

interface PollResponse {
  success: boolean;
  error?: string;
  serverAddress: string;
  licenses?: LicenseEntry[];
  ms?: number;
}

interface LicensePollViewProps {
  /** Called when user clicks "Use this license" — caller wires this to
   *  the Licenses tab's deploy form (server-mode addr + tag). */
  onUseLicense?: (addr: string, tag: string) => void;
}

export function LicensePollView({ onUseLicense }: LicensePollViewProps) {
  const { addresses: cachedAddresses, remember, forget } = useCachedAddresses('simtool_license_servers');

  const [serverAddr, setServerAddr] = useState('');
  const [password, setPassword] = useState('');
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<PollResponse | null>(null);

  // Filters
  const [productFilter, setProductFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');

  // On first load, prefill with the most-recent saved address so the
  // user lands on a one-click poll after opening the tab.
  useEffect(() => {
    if (!serverAddr && cachedAddresses.length > 0) setServerAddr(cachedAddresses[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const splitHostPort = (s: string): { host: string; port: number } => {
    const trimmed = s.trim().replace(/^wss?:\/\//, '');
    const m = trimmed.match(/^([^:/]+)(?::(\d+))?/);
    if (!m) return { host: trimmed, port: 9006 };
    return { host: m[1], port: m[2] ? parseInt(m[2], 10) : 9006 };
  };

  const handlePoll = async () => {
    if (!serverAddr.trim()) return;
    setPolling(true);
    setResult(null);
    try {
      const { host, port } = splitHostPort(serverAddr);
      const res = await fetch('/api/systems/license-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host, port,
          password: password || undefined,
          full: true,
          timeoutMs: 8000,
        }),
      });
      const data: PollResponse = await res.json();
      setResult(data);
      if (data.success) {
        remember(`${host}:${port}`);
        toast({
          title: 'Polled license server',
          description: `${data.licenses?.length ?? 0} license entr${(data.licenses?.length ?? 0) === 1 ? 'y' : 'ies'} returned in ${data.ms ?? '?'}ms.`,
        });
      } else {
        toast({ title: 'Poll failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Poll failed', variant: 'destructive' });
    } finally {
      setPolling(false);
    }
  };

  // Derive filter options from the polled licenses.
  const allProducts = useMemo(() => {
    const set = new Set<string>();
    for (const lic of result?.licenses ?? []) {
      for (const p of (lic.products ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
        set.add(p);
      }
    }
    return Array.from(set).sort();
  }, [result]);
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const lic of result?.licenses ?? []) {
      if (lic.tag) set.add(lic.tag);
    }
    return Array.from(set).sort();
  }, [result]);

  const filtered = (result?.licenses ?? []).filter(lic => {
    if (productFilter) {
      const prods = (lic.products ?? '').split(',').map(s => s.trim());
      if (!prods.includes(productFilter)) return false;
    }
    if (tagFilter && lic.tag !== tagFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold">Poll License Server</h3>
            <Badge variant="outline" className="text-[10px]">WebSocket</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Server address (<code className="font-mono">host[:port]</code>, default port 9006)
              </Label>
              <div className="flex gap-1.5">
                <Input
                  className="flex-1 h-9"
                  placeholder="192.168.0.11:9006"
                  value={serverAddr}
                  onChange={e => setServerAddr(e.target.value)}
                />
                {cachedAddresses.length > 0 && (
                  <Select
                    value=""
                    onValueChange={(v) => { if (v) setServerAddr(v); }}
                  >
                    <SelectTrigger className="w-[42px] h-9 px-2" title="Recently used">
                      <History className="h-3.5 w-3.5" />
                    </SelectTrigger>
                    <SelectContent>
                      {cachedAddresses.map(a => (
                        <SelectItem key={a} value={a}>
                          <span className="flex items-center justify-between gap-2 w-full">
                            <span className="font-mono text-sm">{a}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {/* Show the cached entries inline so the user can also click
                  to remove ones they don't want anymore. */}
              {cachedAddresses.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {cachedAddresses.slice(0, 6).map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setServerAddr(a)}
                      className="group inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-muted hover:bg-muted/70"
                    >
                      {a}
                      <X
                        className="h-3 w-3 opacity-40 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); forget(a); }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Password (optional)</Label>
              <Input
                className="h-9"
                type="password"
                placeholder="leave blank for unsecured"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <Button
              onClick={handlePoll}
              disabled={!serverAddr.trim() || polling}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {polling ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Polling…</>
              ) : (
                <><Search className="h-4 w-4 mr-2" /> Poll</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Poll failed</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{result.error}</p>
            <p className="text-[11px] opacity-80">
              Check that <code className="font-mono">ltelicense</code> is running on the target,
              the port (default 9006) is reachable from this server, and the password (if any) is
              correct.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Empty / results */}
      {result?.success && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Available licenses</h4>
                <Badge variant="secondary">{filtered.length} of {result.licenses?.length ?? 0}</Badge>
                {result.ms != null && (
                  <span className="text-[11px] text-muted-foreground">{result.ms}ms</span>
                )}
              </div>

              {/* Filters */}
              {(allProducts.length > 0 || allTags.length > 0) && (
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={productFilter || '__all__'} onValueChange={v => setProductFilter(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-7 w-[150px] text-xs">
                      <SelectValue placeholder="All products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All products</SelectItem>
                      {allProducts.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={tagFilter || '__all__'} onValueChange={v => setTagFilter(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-7 w-[150px] text-xs">
                      <SelectValue placeholder="All tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All tags</SelectItem>
                      {allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {(result.licenses?.length ?? 0) === 0
                  ? 'Server reported no licenses.'
                  : 'No licenses match the current filters.'}
              </p>
            ) : (
              <div className="space-y-2">
                {filtered.map((lic, i) => (
                  <LicenseRow
                    key={lic.uid || i}
                    lic={lic}
                    onUse={() => {
                      if (!onUseLicense) return;
                      onUseLicense(result.serverAddress, lic.tag || '');
                      toast({
                        title: 'Sent to deploy form',
                        description: `Switch to the Licenses tab — server addr + tag are pre-filled.`,
                      });
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LicenseRow({ lic, onUse }: { lic: LicenseEntry; onUse: () => void }) {
  const products = (lic.products ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const inUse = lic.connections?.length ?? 0;
  const hasMax = typeof lic.max === 'number';
  return (
    <div className="border rounded-md p-3 bg-muted/20 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {products.map(p => (
            <Badge key={p} variant="default" className="text-[10px] uppercase">{p}</Badge>
          ))}
          {lic.tag && (
            <Badge variant="outline" className="text-[10px] font-mono">tag: {lic.tag}</Badge>
          )}
          {hasMax && (
            <Badge variant="secondary" className="text-[10px]">{inUse}/{lic.max} in use</Badge>
          )}
          {lic.version && (
            <Badge variant="outline" className="text-[10px]">v{lic.version}</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onUse} className="h-7 text-[11px]">
          Use this <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
      {lic.uid && (
        <div className="text-[11px] font-mono text-muted-foreground break-all">
          uid: {lic.uid}
          {lic.origin && <> · origin: {lic.origin}</>}
        </div>
      )}
      {(lic.connections?.length ?? 0) > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {lic.connections!.length} active connection{lic.connections!.length === 1 ? '' : 's'}
          </summary>
          <div className="mt-1 space-y-0.5 pl-3 border-l border-muted">
            {lic.connections!.map((c, i) => (
              <div key={i} className="font-mono">
                {c.product ?? '?'} — {c.name ?? '?'} @ {c.address ?? '?'}
                {typeof c.lifetime === 'number' && (
                  <span className="opacity-60"> · {Math.round(c.lifetime / 1000)}s</span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

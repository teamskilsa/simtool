// Amarisoft installer form — 3-step flow:
//   1. Source: pick a tar (remote path or upload)
//   2. Detect: inspect the tar → auto-fill available components, TRX drivers, arch
//   3. Customize + Install: toggle what to install, run install.sh non-interactively
import { useState } from 'react';
import {
  Upload, FolderOpen, Search, Loader2, Package, Radio, Cpu, Sparkles, AlertTriangle, Info, Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '@/components/ui/file-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { System } from '@/modules/systems/types';
import type { DetectionResult, SystemState, TargetArch } from '../types/detection';
import { listTarGzEntries } from '../lib/clientTarInspect';

type SoftwareSource = 'upload' | 'remote-path';

interface InstallFormProps {
  system: System | null;
  isInstalling: boolean;
  onInstall: (opts: BuildInstallOptions) => void;
}

export interface BuildInstallOptions {
  source: SoftwareSource;
  remotePath?: string;
  file?: File;
  installScript?: string;
  components: Record<string, boolean>;
  trxDriver?: string;
  targetArch?: TargetArch;
  mimo: boolean;
  nat: boolean;
  ipv6: boolean;
  autostart: boolean;
  licenseUpdate: boolean;
}

const SERVICE_IDS = new Set(['enb', 'mme', 'ims', 'simserver', 'ue', 'mbmsgw', 'n3iwf', 'license', 'probe', 'scan', 'sat', 'monitor']);

/** Selections that reproduce what the target runs now (null when unknown). */
export function selectionsFromSystem(result: DetectionResult): {
  components: Record<string, boolean>;
  trx?: string;
  mimo?: boolean;
  autostart?: boolean;
  nat?: boolean;
  ipv6?: boolean;
  licenseUpdate?: boolean;
} | null {
  const st = result.systemState;
  if (!st?.ok) return null;
  const components: Record<string, boolean> = {};
  for (const c of result.components) {
    if (!c.available) continue;
    const cs = st.components.find(x => x.id === c.id);
    if (!cs || (cs.installed === null && !cs.active)) { components[c.id] = c.defaultOn; continue; }
    components[c.id] = cs.active || cs.installed === true;
  }
  // The service wrapper must come along whenever it runs anything today.
  if ('ots' in components && st.components.some(x => SERVICE_IDS.has(x.id) && x.active)) components.ots = true;

  const trx = st.recommendedTrx && result.trxDrivers.some(t => t.id === st.recommendedTrx) ? st.recommendedTrx : undefined;
  // Only push new keys when a current key would block the new release.
  const blocking = !!result.version && st.licenses.some(l => l.maxVersion && l.maxVersion < result.version!);
  const licenseUpdate = st.licenses.length ? blocking : undefined;
  return {
    components,
    trx,
    mimo: st.mimo,
    autostart: st.autostart ?? undefined,
    nat: st.nat ?? undefined,
    ipv6: st.ipv6 ?? undefined,
    licenseUpdate,
  };
}

function CurrentHint({ now, selected }: { now: boolean | null | undefined; selected: boolean }) {
  if (now === null || now === undefined) return null;
  const differs = now !== selected;
  return (
    <span className={`ml-2 text-[11px] ${differs ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
      {differs ? `⚠ currently ${now ? 'on' : 'off'}` : `currently ${now ? 'on' : 'off'}`}
    </span>
  );
}

/** Human-readable list of what this install changes on the target. */
function installImpact(st: SystemState | undefined, detection: DetectionResult, sel: {
  components: Record<string, boolean>; trxDriver: string; mimo: boolean; autostart: boolean; nat: boolean; ipv6: boolean; licenseUpdate: boolean;
}, labelOf: (id: string) => string): Array<{ level: 'danger' | 'warn' | 'info'; text: string }> {
  const out: Array<{ level: 'danger' | 'warn' | 'info'; text: string }> = [];
  if (!st?.ok) {
    out.push({ level: 'warn', text: `Current state of the target is unknown${st?.error ? ` (${st.error})` : ''}. Nothing below was checked against the box.` });
  } else {
    out.push({ level: 'info', text: `Upgrade ${st.installedVersion ?? 'unknown version'} → ${detection.version ?? 'unknown'} on ${st.hostname ?? 'target'}. Old versions stay on disk (--no-clean).` });
  }
  if (sel.components.ots) out.push({ level: 'warn', text: 'install.sh stops the LTE service during the install; SimTool restarts it afterwards. Live cells and UEs will drop.' });
  if (sel.components.enb && sel.trxDriver === 'sdr') {
    out.push({ level: 'warn', text: 'trx_sdr install rebuilds the SDR kernel module (needs kernel-devel for the running kernel) and checks/upgrades the FPGA firmware on every SDR board.' });
  }
  for (const w of st?.warnings ?? []) out.push(w);
  if (st?.ok) {
    const dropped = st.components.filter(c => c.active && SERVICE_IDS.has(c.id) && detection.components.some(d => d.id === c.id && d.available) && !sel.components[c.id]);
    if (dropped.length) out.push({ level: 'danger', text: `Running now but unchecked — they will no longer be started by the service: ${dropped.map(c => labelOf(c.id)).join(', ')}.` });
    if (sel.components.enb && st.rfDriver && st.recommendedTrx && sel.trxDriver !== st.recommendedTrx) {
      out.push({ level: 'danger', text: `TRX "${sel.trxDriver}" differs from what the eNB uses now (rf_driver "${st.rfDriver}", ${st.sdrBoards} SDR board function(s)). The eNB will not find its radios.` });
    }
    if (st.autostart !== null && st.autostart !== sel.autostart) out.push({ level: sel.autostart ? 'warn' : 'danger', text: `lte.service will be ${sel.autostart ? 'enabled' : 'DISABLED'} at boot (currently ${st.autostart ? 'enabled' : 'disabled'}).` });
    if (st.nat !== null && st.nat !== sel.nat) out.push({ level: 'warn', text: `NAT for IPv4 changes: ${st.nat ? 'on' : 'off'} → ${sel.nat ? 'on' : 'off'}.` });
    if (st.ipv6 !== null && st.ipv6 !== sel.ipv6) out.push({ level: 'danger', text: `IPv6 changes: ${st.ipv6 ? 'on' : 'off'} → ${sel.ipv6 ? 'on' : 'off'} (MME/MBMS gateway init option -6).` });
  }
  if (sel.licenseUpdate && detection.licenses > 0) {
    const cur = st?.licenses.length
      ? ` Current keys: ${st.licenses.map(l => `${l.path.split('/').pop()} (uid ${l.licenseUid ?? '?'}, up to ${l.maxVersion ?? '?'})`).join(', ')}.`
      : '';
    out.push({ level: 'warn', text: `License update is ON: install.sh replaces every key in ${st?.licenseDir ?? '~/.amarisoft/'} whose license_uid (or host_id) matches one of the ${detection.licenses} package keys, and deletes duplicate-uid keys. Keys for other hosts are ignored.${cur}` });
  }
  return out;
}

export function InstallForm({ system, isInstalling, onInstall }: InstallFormProps) {
  // Step 1: Source
  const [source, setSource] = useState<SoftwareSource>('remote-path');
  const [remotePath, setRemotePath] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Step 2: Detection
  const [detecting, setDetecting] = useState(false);
  const [detectStatus, setDetectStatus] = useState('');
  const [detection, setDetection] = useState<DetectionResult | null>(null);

  // Step 3: Customize
  const [componentsOn, setComponentsOn] = useState<Record<string, boolean>>({});
  const [trxDriver, setTrxDriver] = useState<string>('');
  const [targetArch, setTargetArch] = useState<TargetArch>('unknown');
  const [mimo, setMimo] = useState(true);
  const [nat, setNat] = useState(true);
  const [ipv6, setIpv6] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [licenseUpdate, setLicenseUpdate] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canDetect = !!system && !isInstalling && !detecting &&
    ((source === 'remote-path' && remotePath.trim()) || (source === 'upload' && file));

  // Explain why Detect is disabled. Used as both a tooltip on the
  // disabled button and an inline hint underneath it. Without this the
  // button just sits silently in a faded-purple state and clicks do
  // nothing — users (rightly) report "auto-detect didn't work".
  const detectBlockedReason: string | null = (() => {
    if (!system) return 'Pick a target system above to detect its arch.';
    if (source === 'remote-path' && !remotePath.trim()) return 'Enter the remote tar path first.';
    if (source === 'upload' && !file) return 'Drop a tar.gz file above first.';
    if (isInstalling) return 'Wait for the current install to finish.';
    return null;
  })();

  const handleDetect = async () => {
    if (!system) return;
    setDetecting(true);
    setDetection(null);
    try {
      // Build the request body — remote-path mode sends tarPath (server scans
      // via SSH), upload mode sends pre-parsed entries (client scans locally).
      const creds = {
        host: system.ip,
        username: system.username,
        password: system.password,
        privateKey: system.authMode === 'privateKey' ? system.privateKey : undefined,
      };

      let body: any = { ...creds };
      if (source === 'upload' && file) {
        try {
          setDetectStatus(`Reading ${file.name}…`);
          const entries = await listTarGzEntries(file, {
            timeoutMs: 90_000,
            onProgress: (n) => setDetectStatus(`Scanned ${n} entries…`),
          });
          if (entries.length === 0) {
            toast({ title: 'Empty archive', description: 'No entries found in the tar.gz', variant: 'destructive' });
            setDetecting(false);
            setDetectStatus('');
            return;
          }
          body.entries = entries;
        } catch (e: any) {
          toast({
            title: 'Local inspection failed',
            description: e?.message || 'Could not read tar.gz contents',
            variant: 'destructive',
          });
          setDetecting(false);
          setDetectStatus('');
          return;
        }
      } else {
        body.tarPath = remotePath.trim();
      }

      setDetectStatus('Contacting target system…');

      const res = await fetch('/api/systems/sw-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result: DetectionResult = await res.json();
      if (!result.success) {
        toast({ title: 'Detection failed', description: result.error || 'Unknown error', variant: 'destructive' });
        setDetecting(false);
        return;
      }

      setDetection(result);

      // Pre-select from what the target runs now; package defaults otherwise.
      const fromSystem = selectionsFromSystem(result);
      const defaults: Record<string, boolean> = {};
      for (const c of result.components) {
        if (c.available) defaults[c.id] = c.defaultOn;
      }
      setComponentsOn(fromSystem ? fromSystem.components : defaults);

      // TRX: the frontend the box uses; else sdr if packaged; else first one
      const preferredTrx = (fromSystem?.trx && result.trxDrivers.find(t => t.id === fromSystem.trx))
        || result.trxDrivers.find(t => t.id === 'sdr') || result.trxDrivers[0];
      setTrxDriver(preferredTrx ? preferredTrx.id : '');
      setMimo(fromSystem?.mimo ?? true);
      setAutostart(fromSystem?.autostart ?? false);
      setNat(fromSystem?.nat ?? true);
      setIpv6(fromSystem?.ipv6 ?? false);
      setLicenseUpdate(fromSystem?.licenseUpdate ?? true);
      if (result.systemState && !result.systemState.ok) {
        toast({ title: 'Current system state unknown', description: result.systemState.error || 'Could not read the target', variant: 'destructive' });
      }

      // Set target arch based on detected system arch
      setTargetArch(result.targetArch !== 'unknown' ? result.targetArch : 'linux');

      toast({
        title: 'Package detected',
        description: `Amarisoft ${result.version || 'unknown'} • ${result.components.filter(c => c.available).length} components • target: ${result.targetArch}`,
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Inspection failed', variant: 'destructive' });
    } finally {
      setDetecting(false);
      setDetectStatus('');
    }
  };

  const labelOf = (id: string) => detection?.components.find(c => c.id === id)?.label ?? id;
  const st = detection?.systemState;
  const stOk = st?.ok ? st : undefined;
  const compState = (id: string) => stOk?.components.find(c => c.id === id);
  const impact = detection
    ? installImpact(st, detection, { components: componentsOn, trxDriver, mimo, autostart, nat, ipv6, licenseUpdate }, labelOf)
    : [];

  const handleInstall = () => {
    setConfirmOpen(false);
    onInstall({
      source,
      remotePath: source === 'remote-path' ? remotePath.trim() : undefined,
      file: source === 'upload' ? file || undefined : undefined,
      installScript: detection?.installScript,
      components: componentsOn,
      trxDriver: trxDriver || undefined,
      targetArch: targetArch !== 'unknown' ? targetArch : undefined,
      mimo, nat, ipv6, autostart, licenseUpdate,
    });
  };

  const atLeastOne = Object.values(componentsOn).some(v => v);
  const canInstall = !!system && !isInstalling && atLeastOne &&
    ((source === 'remote-path' && remotePath.trim()) || (source === 'upload' && file));

  return (
    <div className="space-y-6">
      {/* ── Step 1: Source ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 items-center justify-center text-xs font-semibold">1</span>
          <Label className="text-sm font-semibold">Package Source</Label>
        </div>

        <RadioGroup value={source} onValueChange={v => { setSource(v as SoftwareSource); setDetection(null); }} className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="remote-path" id="src-remote" />
            <Label htmlFor="src-remote" className="flex items-center gap-1.5 cursor-pointer">
              <FolderOpen className="h-4 w-4" /> Remote Path
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="upload" id="src-upload" />
            <Label htmlFor="src-upload" className="flex items-center gap-1.5 cursor-pointer">
              <Upload className="h-4 w-4" /> Upload File
            </Label>
          </div>
        </RadioGroup>

        {source === 'remote-path' && (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Input
                placeholder="/tmp/amarisoft.2026-04-22.tar.gz"
                value={remotePath}
                onChange={e => { setRemotePath(e.target.value); setDetection(null); }}
                className="flex-1"
              />
              <Button
                onClick={handleDetect}
                disabled={!canDetect}
                title={detectBlockedReason ?? 'Inspect the tar and auto-fill the install form'}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {detecting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {detectStatus || 'Detecting…'}</>
                  : <><Search className="h-4 w-4 mr-2" /> Detect</>
                }
              </Button>
            </div>
            {detectBlockedReason && !detecting && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                ⚠ {detectBlockedReason}
              </p>
            )}
          </div>
        )}

        {source === 'upload' && (
          <>
            <FileUpload
              onDrop={files => { setFile(files[0] || null); setDetection(null); }}
              accept={{ 'application/gzip': ['.tar.gz', '.tgz'], 'application/x-tar': ['.tar'] }}
              maxFiles={1}
            >
              <div className="py-3">
                <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-1 text-sm font-medium">{file ? file.name : 'Drop Amarisoft tar.gz here, or click'}</p>
                {file && <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>}
              </div>
            </FileUpload>
            {file && (
              <div className="space-y-1.5">
                <Button
                  onClick={handleDetect}
                  disabled={!canDetect}
                  title={detectBlockedReason ?? 'Inspect the tar and auto-fill the install form'}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {detecting
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {detectStatus || 'Detecting…'}</>
                    : <><Search className="h-4 w-4 mr-2" /> Detect</>
                  }
                </Button>
                {detectBlockedReason && !detecting && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    ⚠ {detectBlockedReason}
                  </p>
                )}
              </div>
            )}
            <Alert className="bg-indigo-50/50 border-indigo-200">
              <AlertDescription className="text-xs">
                The tar is inspected locally in your browser (no upload needed). Arch is read from the target system.
              </AlertDescription>
            </Alert>
          </>
        )}
      </section>

      {/* ── Step 2: Detection results ───────────────────────────────────── */}
      {detection && (
        <section className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-semibold text-indigo-900">Detected:</span>
            <Badge variant="outline" className="bg-white">Amarisoft {detection.version}</Badge>
            <Badge variant="outline" className="bg-white">Target: {detection.targetArch}</Badge>
            <Badge variant="outline" className="bg-white">{detection.components.filter(c => c.available).length} components</Badge>
            <Badge variant="outline" className="bg-white">{detection.trxDrivers.length} TRX driver{detection.trxDrivers.length === 1 ? '' : 's'}</Badge>
            {detection.licenses > 0 && (
              <Badge variant="outline" className="bg-white">{detection.licenses} license file{detection.licenses === 1 ? '' : 's'}</Badge>
            )}
          </div>
          {detection.warning && <p className="text-xs text-amber-700 dark:text-amber-400">⚠ {detection.warning}</p>}
        </section>
      )}

      {/* ── Current state of the target ─────────────────────────────────── */}
      {detection && st && (
        <section className={`space-y-2 rounded-lg border p-4 ${stOk ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50/40'}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <Server className="h-4 w-4 text-emerald-700" />
            <span className="text-sm font-semibold">On {stOk?.hostname || system?.name || 'target'}:</span>
            {stOk ? (
              <span className="text-sm" data-testid="version-transition">
                currently installed <b>{stOk.installedVersion ?? 'unknown'}</b> → installing <b>{detection.version ?? 'unknown'}</b>
              </span>
            ) : (
              <span className="text-sm text-amber-800">current state unknown — {st.error}</span>
            )}
            <Badge variant="outline" className="bg-white text-[10px]">read via {st.via}</Badge>
          </div>
          {stOk && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>
                Service runs: {stOk.components.filter(c => c.active && SERVICE_IDS.has(c.id)).map(c => labelOf(c.id)).join(', ') || 'nothing'}
                {' · '}TRX: {stOk.rfDriver ?? 'unknown'}{stOk.sdrBoards ? ` (${stOk.sdrBoards} SDR PCIe)` : ''}
                {stOk.uhdPresent === false ? ' · no UHD' : stOk.uhdPresent ? ' · UHD present' : ''}
                {stOk.nAntennaDl ? ` · antennas DL ${stOk.nAntennaDl} / UL ${stOk.nAntennaUl ?? '?'}` : ''}
              </div>
              {stOk.licenses.length > 0 && (
                <div>Licenses: {stOk.licenses.map(l => `${l.path.split('/').pop()} (≤ ${l.maxVersion ?? '?'})`).join(', ')}</div>
              )}
              <details className="pt-1">
                <summary className="cursor-pointer">Evidence ({stOk.evidence.length})</summary>
                <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
                  {stOk.evidence.map((e, i) => (
                    <li key={i}><b>{e.key}</b> {e.source}: {e.detail}{e.inferred ? ' (inferred)' : ''}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
          {(stOk?.warnings ?? []).filter(w => w.level !== 'info').map((w, i) => (
            <p key={i} className={`text-xs flex gap-1.5 ${w.level === 'danger' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {w.text}
            </p>
          ))}
        </section>
      )}

      {/* ── Step 3: Customize (only after detection) ────────────────────── */}
      {detection && (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 items-center justify-center text-xs font-semibold">2</span>
              <Label className="text-sm font-semibold">Components</Label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2 rounded-md border p-3">
              {(detection?.components || []).filter(c => c.available).map(comp => (
                <label key={comp.id} className="flex items-start gap-2 py-1 cursor-pointer" title={comp.description}>
                  <Checkbox
                    checked={componentsOn[comp.id] ?? false}
                    onCheckedChange={v => setComponentsOn(s => ({ ...s, [comp.id]: Boolean(v) }))}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {comp.label}
                      {compState(comp.id)?.active && SERVICE_IDS.has(comp.id) && (
                        <span className="ml-1.5 rounded bg-emerald-100 px-1 text-[10px] font-normal text-emerald-800">running</span>
                      )}
                      {compState(comp.id)?.installed && !(compState(comp.id)?.active && SERVICE_IDS.has(comp.id)) && (
                        <span className="ml-1.5 rounded bg-slate-100 px-1 text-[10px] font-normal text-slate-700">installed</span>
                      )}
                      {stOk && (componentsOn[comp.id] ?? false) !== !!(compState(comp.id)?.active || compState(comp.id)?.installed) && (
                        <span className="ml-1.5 text-[10px] font-normal text-amber-700">⚠ changes</span>
                      )}
                    </div>
                    {comp.description && <div className="text-xs text-muted-foreground">{comp.description}</div>}
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* ── Step 3b: TRX driver (eNB/gNB *or* UE simulator) ─────────────
                Both lteenb (radio access) and lteue (UE simulator) talk
                to the same TRX layer — SDR, Split 7.2, IP loopback,
                etc. Earlier this section gated on enb only, so a
                UE-only build (where enb isn't even available) never
                showed the picker. Now: any radio-touching component
                enabled → render. */}
          {(componentsOn.enb || componentsOn.ue) && (detection?.trxDrivers.length ?? 0) > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 items-center justify-center text-xs font-semibold">3</span>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Radio className="w-4 h-4" /> TRX Radio Frontend
                  <span className="text-[11px] font-normal text-muted-foreground">
                    (used by {[componentsOn.enb && 'eNB/gNB', componentsOn.ue && 'UE'].filter(Boolean).join(' + ')})
                  </span>
                </Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select value={trxDriver} onValueChange={setTrxDriver}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {detection?.trxDrivers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-3">
                  <Switch checked={mimo} onCheckedChange={setMimo} />
                  <Label>MIMO</Label>
                  <CurrentHint now={stOk?.mimo} selected={mimo} />
                </div>
              </div>
              {stOk && (
                <p className={`text-[11px] ${stOk.recommendedTrx && trxDriver !== stOk.recommendedTrx ? 'text-red-700 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                  {stOk.recommendedTrx && trxDriver !== stOk.recommendedTrx ? '⚠ ' : ''}
                  System uses rf_driver “{stOk.rfDriver ?? 'unknown'}”
                  {` · ${stOk.sdrBoards} Amarisoft SDR PCIe function(s)`}
                  {stOk.uhdPresent === false ? ' · no UHD software/devices found' : stOk.uhdPresent ? ' · UHD present' : ''}
                  {stOk.recommendedTrx ? ` → recommended: ${stOk.recommendedTrx}` : ''}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                The MIMO switch only edits the new release&apos;s stock enb.default.cfg (N_ANTENNA_DL=2); it does not touch your own eNB config.
              </p>
            </section>
          )}

          {/* ── Step 3c: Network & Service ──────────────────────────────── */}
          <section className="space-y-3 rounded-md border p-3">
            <Label className="text-sm font-semibold flex items-center gap-1.5"><Cpu className="w-4 h-4" /> Network &amp; Service</Label>

            {detection?.targetArch && detection.targetArch !== 'unknown' && (
              <div className="flex items-center gap-2">
                <Label className="text-sm w-32">Target Architecture</Label>
                <Select value={targetArch} onValueChange={v => setTargetArch(v as TargetArch)}>
                  <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linux">linux (x86_64)</SelectItem>
                    <SelectItem value="aarch64">aarch64 (ARM64)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">System reports: {detection.targetArch}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-sm">Start LTE service on boot (autostart)<CurrentHint now={stOk?.autostart} selected={autostart} /></Label>
              <Switch checked={autostart} onCheckedChange={setAutostart} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">NAT for IPv4<CurrentHint now={stOk?.nat} selected={nat} /></Label>
              <Switch checked={nat} onCheckedChange={setNat} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Enable IPv6<CurrentHint now={stOk?.ipv6} selected={ipv6} /></Label>
              <Switch checked={ipv6} onCheckedChange={setIpv6} />
            </div>
            {detection && detection.licenses > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    Update licenses ({detection.licenses} keys in package)
                  </Label>
                  <Switch checked={licenseUpdate} onCheckedChange={setLicenseUpdate} />
                </div>
                <p className={`text-[11px] ${licenseUpdate ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                  {licenseUpdate ? '⚠ ' : ''}Overwrites keys in {stOk?.licenseDir ?? '~/.amarisoft/'} that share a license_uid/host_id with a package key and deletes duplicates
                  {stOk?.licenses.length ? ` (on the box now: ${stOk.licenses.map(l => `${l.path.split('/').pop()} ≤ ${l.maxVersion ?? '?'}`).join(', ')})` : ''}.
                </p>
              </div>
            )}
          </section>

          {/* ── Install button ──────────────────────────────────────────── */}
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!canInstall}
            size="lg"
            className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            <Package className="w-4 h-4 mr-2" />
            {isInstalling ? 'Installing...' : 'Install Software'}
          </Button>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Install Amarisoft {detection.version} on {system?.name ?? 'target'}?</DialogTitle>
                <DialogDescription>Review what this install changes on the system.</DialogDescription>
              </DialogHeader>
              <ul className="space-y-2 max-h-[55vh] overflow-y-auto text-sm">
                {impact.map((w, i) => (
                  <li key={i} className={`flex gap-2 ${w.level === 'danger' ? 'text-red-700 dark:text-red-400' : w.level === 'warn' ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>
                    {w.level === 'info' ? <Info className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                    <span>{w.text}</span>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleInstall}
                  className={impact.some(w => w.level === 'danger') ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}
                >
                  {impact.some(w => w.level === 'danger') ? 'Install anyway' : 'Install'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

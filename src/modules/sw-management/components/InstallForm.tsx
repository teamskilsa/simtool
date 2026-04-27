// Amarisoft installer form — 3-step flow:
//   1. Source: pick a tar (remote path or upload)
//   2. Detect: inspect the tar → auto-fill available components, TRX drivers, arch
//   3. Customize + Install: toggle what to install, run install.sh non-interactively
import { useState } from 'react';
import {
  Upload, FolderOpen, Search, CheckCircle2, XCircle, Loader2, Package, Radio, Cpu, Sparkles,
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
import type { System } from '@/modules/systems/types';
import type { DetectionResult, TargetArch } from '../types/detection';
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

  const canDetect = !!system && !isInstalling && !detecting &&
    ((source === 'remote-path' && remotePath.trim()) || (source === 'upload' && file));

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

      // Initialize component selection from the "defaultOn" flags
      const defaults: Record<string, boolean> = {};
      for (const c of result.components) {
        if (c.available) defaults[c.id] = c.defaultOn;
      }
      setComponentsOn(defaults);

      // Pick default TRX — sdr if available, otherwise first one
      const preferredTrx = result.trxDrivers.find(t => t.id === 'sdr') || result.trxDrivers[0];
      if (preferredTrx) setTrxDriver(preferredTrx.id);

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

  const handleInstall = () => {
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
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {detecting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {detectStatus || 'Detecting…'}</>
                : <><Search className="h-4 w-4 mr-2" /> Detect</>
              }
            </Button>
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
              <Button
                onClick={handleDetect}
                disabled={!canDetect}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {detecting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {detectStatus || 'Detecting…'}</>
                : <><Search className="h-4 w-4 mr-2" /> Detect</>
              }
              </Button>
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
                    <div className="text-sm font-medium">{comp.label}</div>
                    {comp.description && <div className="text-xs text-muted-foreground">{comp.description}</div>}
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* ── Step 3b: gNB TRX driver ─────────────────────────────────── */}
          {componentsOn.enb && (detection?.trxDrivers.length ?? 0) > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 items-center justify-center text-xs font-semibold">3</span>
                <Label className="text-sm font-semibold flex items-center gap-1.5"><Radio className="w-4 h-4" /> TRX Radio Frontend</Label>
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
                </div>
              </div>
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
              <Label className="text-sm">Start LTE service on boot (autostart)</Label>
              <Switch checked={autostart} onCheckedChange={setAutostart} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">NAT for IPv4</Label>
              <Switch checked={nat} onCheckedChange={setNat} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Enable IPv6</Label>
              <Switch checked={ipv6} onCheckedChange={setIpv6} />
            </div>
            {detection && detection.licenses > 0 && (
              <div className="flex items-center justify-between">
                <Label className="text-sm">
                  Update licenses ({detection.licenses} found)
                </Label>
                <Switch checked={licenseUpdate} onCheckedChange={setLicenseUpdate} />
              </div>
            )}
          </section>

          {/* ── Install button ──────────────────────────────────────────── */}
          <Button
            onClick={handleInstall}
            disabled={!canInstall}
            size="lg"
            className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            <Package className="w-4 h-4 mr-2" />
            {isInstalling ? 'Installing...' : 'Install Software'}
          </Button>
        </>
      )}
    </div>
  );
}

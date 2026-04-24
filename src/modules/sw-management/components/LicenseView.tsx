'use client';

import { useState } from 'react';
import { Key, Search, Upload, Server, Usb, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '@/components/ui/file-upload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { SystemSelector } from './SystemSelector';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import type { System } from '@/modules/systems/types';

type DeployMode = 'system' | 'server' | 'dongle';

interface LicenseInfo {
  path: string;
  product: string;
  fields: Record<string, string>;
}
interface ServerConfig {
  path: string;
  serverAddr: string;
  tag: string;
}
interface CheckResult {
  success: boolean;
  error?: string;
  searchedDirs: { dir: string; exists: boolean }[];
  licenses: LicenseInfo[];
  serverConfigs: ServerConfig[];
  found: boolean;
}
interface DeployStep {
  name: string;
  ok: boolean;
  detail?: string;
}
interface DeployResult {
  success: boolean;
  error?: string;
  steps: DeployStep[];
}

function systemToCreds(system: System, formData: FormData) {
  formData.append('host', system.ip);
  formData.append('username', system.username || '');
  if (system.authMode === 'privateKey' && system.privateKey) {
    formData.append('privateKey', system.privateKey);
  } else {
    formData.append('password', system.password || '');
  }
}

export function LicenseView() {
  const { systems } = useSystems();
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const selectedSystem = systems.find((s) => String(s.id) === selectedSystemId) || null;

  // Check state
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  // Deploy state
  const [deployMode, setDeployMode] = useState<DeployMode>('system');
  const [targetDir, setTargetDir] = useState('/root/.simnovus');
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [serverAddr, setServerAddr] = useState('');
  const [serverTag, setServerTag] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);

  const handleCheck = async () => {
    if (!selectedSystem) return;
    setIsChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch('/api/systems/license-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: selectedSystem.ip,
          username: selectedSystem.username,
          password: selectedSystem.password,
          privateKey: selectedSystem.authMode === 'privateKey' ? selectedSystem.privateKey : undefined,
        }),
      });
      const data: CheckResult = await res.json();
      setCheckResult(data);
      if (!data.success) {
        toast({ title: 'License Check Failed', description: data.error || 'Unknown error', variant: 'destructive' });
      } else if (!data.found) {
        toast({ title: 'No License Found', description: 'No license files or server configs on target.' });
      } else {
        toast({ title: 'License Found', description: `${data.licenses.length} key file(s), ${data.serverConfigs.length} server config(s).` });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Check failed', variant: 'destructive' });
    } finally {
      setIsChecking(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedSystem) return;
    setIsDeploying(true);
    setDeployResult(null);
    try {
      const formData = new FormData();
      systemToCreds(selectedSystem, formData);
      formData.append('mode', deployMode);
      formData.append('targetDir', targetDir);
      if (deployMode === 'system' && licenseFile) formData.append('file', licenseFile);
      if (deployMode === 'server') {
        formData.append('serverAddr', serverAddr);
        formData.append('tag', serverTag);
      }

      const res = await fetch('/api/systems/license-deploy', { method: 'POST', body: formData });
      const data: DeployResult = await res.json();
      setDeployResult(data);
      toast({
        title: data.success ? 'License Deployed' : 'Deploy Failed',
        description: data.error || (data.success ? 'License installed.' : 'Check step details.'),
        variant: data.success ? 'default' : 'destructive',
      });
      // Auto-refresh check after successful deploy
      if (data.success) await handleCheck();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Deploy failed', variant: 'destructive' });
    } finally {
      setIsDeploying(false);
    }
  };

  const canDeploy =
    selectedSystem &&
    !isDeploying &&
    (
      (deployMode === 'system' && licenseFile !== null) ||
      (deployMode === 'server' && serverAddr.trim() && serverTag.trim()) ||
      deployMode === 'dongle'
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Check + Deploy controls */}
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold">Check License</h3>
          </div>
          <SystemSelector systems={systems} selectedId={selectedSystemId} onSelect={setSelectedSystemId} />
          <Button
            onClick={handleCheck}
            disabled={!selectedSystem || isChecking}
            className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {isChecking ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…</>
            ) : (
              <><Search className="h-4 w-4 mr-2" /> Check for License</>
            )}
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold">Deploy License</h3>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Mode</Label>
            <RadioGroup value={deployMode} onValueChange={(v) => setDeployMode(v as DeployMode)} className="grid grid-cols-3 gap-2">
              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer hover:border-indigo-500 ${deployMode === 'system' ? 'border-indigo-500 bg-indigo-50' : ''}`}>
                <RadioGroupItem value="system" />
                <Upload className="h-4 w-4" />
                <span className="text-sm">System</span>
              </label>
              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer hover:border-indigo-500 ${deployMode === 'server' ? 'border-indigo-500 bg-indigo-50' : ''}`}>
                <RadioGroupItem value="server" />
                <Server className="h-4 w-4" />
                <span className="text-sm">Server</span>
              </label>
              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer hover:border-indigo-500 ${deployMode === 'dongle' ? 'border-indigo-500 bg-indigo-50' : ''}`}>
                <RadioGroupItem value="dongle" />
                <Usb className="h-4 w-4" />
                <span className="text-sm">Dongle</span>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Target Directory</Label>
            <Select value={targetDir} onValueChange={setTargetDir}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="/root/.simnovus">/root/.simnovus</SelectItem>
                <SelectItem value="/root/.amarisoft">/root/.amarisoft</SelectItem>
                <SelectItem value="/mnt/.simnovus">/mnt/.simnovus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {deployMode === 'system' && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">License Key File (.key)</Label>
              <FileUpload
                onDrop={(files) => setLicenseFile(files[0] || null)}
                accept={{ 'application/octet-stream': ['.key'] }}
                maxFiles={1}
              >
                <div className="py-3">
                  <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-1 text-sm font-medium">
                    {licenseFile ? licenseFile.name : 'Drop .key file here'}
                  </p>
                  {licenseFile && (
                    <p className="text-xs text-muted-foreground mt-0.5">{licenseFile.size} bytes</p>
                  )}
                </div>
              </FileUpload>
            </div>
          )}

          {deployMode === 'server' && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Server Address (ip:port)</Label>
                <Input className="h-8" placeholder="192.168.0.11:9051" value={serverAddr} onChange={(e) => setServerAddr(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tag</Label>
                <Input className="h-8" placeholder="pre-1000-ue" value={serverTag} onChange={(e) => setServerTag(e.target.value)} />
              </div>
            </div>
          )}

          {deployMode === 'dongle' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Dongle mode: a USB license dongle must already be plugged in. Clicking Deploy will detect and report it.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleDeploy}
            disabled={!canDeploy}
            className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {isDeploying ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deploying…</>
            ) : (
              'Deploy License'
            )}
          </Button>
        </div>
      </div>

      {/* Right: Check results + Deploy results */}
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Key className="h-5 w-5 text-indigo-600" /> License Status
          </h3>

          {!checkResult && !isChecking && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Select a system and click "Check for License" to view status.
            </p>
          )}

          {isChecking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Scanning directories…
            </div>
          )}

          {checkResult && (
            <div className="space-y-3">
              {/* Searched dirs */}
              <div className="text-xs space-y-1">
                {checkResult.searchedDirs.map((d) => (
                  <div key={d.dir} className="flex items-center gap-2">
                    {d.exists ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-muted-foreground" />
                    )}
                    <code className="text-muted-foreground">{d.dir}</code>
                    {!d.exists && <span className="text-muted-foreground">(not found)</span>}
                  </div>
                ))}
              </div>

              {/* License keys found */}
              {checkResult.licenses.map((lic, i) => (
                <div key={i} className="border rounded-md p-3 bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{lic.product.toUpperCase()}</span>
                    <code className="text-xs text-muted-foreground">{lic.path}</code>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {Object.entries(lic.fields).map(([k, v]) => (
                      <div key={k} className="truncate">
                        <span className="text-muted-foreground">{k}:</span>{' '}
                        <span className="font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Server configs */}
              {checkResult.serverConfigs.map((sc, i) => (
                <div key={i} className="border rounded-md p-3 bg-indigo-50 space-y-1">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium text-sm">License Server</span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div><span className="text-muted-foreground">Path:</span> <code>{sc.path}</code></div>
                    <div><span className="text-muted-foreground">Server:</span> <code>{sc.serverAddr}</code></div>
                    <div><span className="text-muted-foreground">Tag:</span> <code>{sc.tag}</code></div>
                  </div>
                </div>
              ))}

              {checkResult.found === false && checkResult.success && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No license found</AlertTitle>
                  <AlertDescription className="text-xs">
                    Use the Deploy panel on the left to install a license.
                  </AlertDescription>
                </Alert>
              )}

              {!checkResult.success && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Check Failed</AlertTitle>
                  <AlertDescription className="text-xs">{checkResult.error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Deploy result */}
        {deployResult && (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <h3 className="font-semibold text-sm">Deploy Result</h3>
            <Alert variant={deployResult.success ? 'default' : 'destructive'}>
              <AlertDescription className="text-xs">
                {deployResult.error || (deployResult.success ? 'License deployed successfully.' : 'Deploy failed.')}
              </AlertDescription>
            </Alert>
            <div className="space-y-1">
              {deployResult.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {s.ok ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium">{s.name.replace(/-/g, ' ')}</span>
                    {s.detail && <span className="text-muted-foreground"> — <code className="break-all">{s.detail}</code></span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

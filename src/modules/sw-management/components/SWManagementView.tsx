'use client';

import { useState } from 'react';
import { Package, Download, Key, Server, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import { SystemSelector } from './SystemSelector';
import { InstallForm, type BuildInstallOptions } from './InstallForm';
import { InstallProgress } from './InstallProgress';
import { LicenseView } from './LicenseView';
import { LicensePollView } from './LicensePollView';
import { ServicesView } from './ServicesView';
import type { InstallResult } from '../types';

export function SWManagementView() {
  const { systems } = useSystems();
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [result, setResult] = useState<InstallResult | null>(null);
  const [activeTab, setActiveTab] = useState('install');

  const selectedSystem = systems.find((s) => String(s.id) === selectedSystemId) || null;

  const handleInstall = async (opts: BuildInstallOptions) => {
    if (!selectedSystem) return;
    setIsInstalling(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('host', selectedSystem.ip);
      formData.append('username', selectedSystem.username || '');
      if (selectedSystem.authMode === 'privateKey' && selectedSystem.privateKey) {
        formData.append('privateKey', selectedSystem.privateKey);
      } else {
        formData.append('password', selectedSystem.password || '');
      }

      formData.append('source', opts.source);
      if (opts.remotePath) formData.append('remotePath', opts.remotePath);
      if (opts.file) formData.append('file', opts.file);
      if (opts.installScript) formData.append('installScript', opts.installScript);

      // Component selections — prefixed with comp_ so the server can pick them up
      for (const [id, on] of Object.entries(opts.components)) {
        formData.append(`comp_${id}`, String(on));
      }
      if (opts.trxDriver) formData.append('trxDriver', opts.trxDriver);
      if (opts.targetArch) formData.append('targetArch', opts.targetArch);

      formData.append('mimo', String(opts.mimo));
      formData.append('nat', String(opts.nat));
      formData.append('ipv6', String(opts.ipv6));
      formData.append('autostart', String(opts.autostart));
      formData.append('licenseUpdate', String(opts.licenseUpdate));

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 15 * 60 * 1000); // 15 min

      const response = await fetch('/api/systems/sw-install', {
        method: 'POST',
        body: formData,
        signal: ac.signal,
      });
      clearTimeout(timer);

      const data: InstallResult = await response.json();
      setResult(data);

      toast({
        title: data.success ? 'Installation Successful' : 'Installation Failed',
        description: data.error || (data.success
          ? `Amarisoft software installed on ${selectedSystem.name}`
          : 'Check the step details and install log below.'),
        variant: data.success ? 'default' : 'destructive',
      });
    } catch (err: any) {
      const errorMsg = err?.name === 'AbortError'
        ? 'Installation timed out after 15 minutes'
        : err?.message || 'Installation failed';
      setResult({ success: false, steps: [], error: errorMsg });
      toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-8 w-8 text-indigo-600" />
        <div>
          <h2 className="text-2xl font-semibold">SW Management</h2>
          <p className="text-sm text-muted-foreground">
            Auto-detect & install Amarisoft software · manage licenses on remote systems
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-fit grid-cols-4">
          <TabsTrigger value="install" className="flex items-center gap-2 px-6">
            <Download className="h-4 w-4" /> Install
          </TabsTrigger>
          <TabsTrigger value="license" className="flex items-center gap-2 px-6">
            <Key className="h-4 w-4" /> Licenses
          </TabsTrigger>
          <TabsTrigger value="poll-license" className="flex items-center gap-2 px-6">
            <Server className="h-4 w-4" /> Poll License Server
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2 px-6">
            <Activity className="h-4 w-4" /> Services
          </TabsTrigger>
        </TabsList>

        <TabsContent value="install">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Install Software</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <SystemSelector
                  systems={systems}
                  selectedId={selectedSystemId}
                  onSelect={setSelectedSystemId}
                />
                <InstallForm
                  system={selectedSystem}
                  isInstalling={isInstalling}
                  onInstall={handleInstall}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Installation Progress</CardTitle>
              </CardHeader>
              <CardContent>
                {!isInstalling && !result && (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Select a system, detect the package, then install to see progress here.
                  </p>
                )}
                <InstallProgress result={result} isInstalling={isInstalling} systemName={selectedSystem?.name} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="license">
          <LicenseView />
        </TabsContent>

        <TabsContent value="poll-license">
          <LicensePollView
            onUseLicense={(addr, tag) => {
              // Poll → Deploy handoff. Stash the picked server in
              // sessionStorage; LicenseView's mount effect reads it and
              // pre-fills the deploy form. Then jump tabs.
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(
                  'simtool_license_deploy_target',
                  JSON.stringify({ addr, tag }),
                );
              }
              setActiveTab('license');
            }}
          />
        </TabsContent>

        <TabsContent value="services">
          <ServicesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

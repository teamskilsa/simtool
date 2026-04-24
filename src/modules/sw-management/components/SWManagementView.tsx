'use client';

import { useState } from 'react';
import { Package, Download, Key } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import { SystemSelector } from './SystemSelector';
import { InstallForm } from './InstallForm';
import { InstallProgress } from './InstallProgress';
import { LicenseView } from './LicenseView';
import type { InstallResult, InstallComponents, SoftwareSource, TrxDriver } from '../types';

export function SWManagementView() {
  const { systems } = useSystems();
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [result, setResult] = useState<InstallResult | null>(null);

  const selectedSystem = systems.find((s) => String(s.id) === selectedSystemId) || null;

  const handleInstall = async (opts: {
    source: SoftwareSource;
    remotePath?: string;
    file?: File;
    components: InstallComponents;
    trxDriver: TrxDriver;
    mimo: boolean;
    useNat: boolean;
    useIPv6: boolean;
    ruIpAddress?: string;
  }) => {
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

      for (const [key, value] of Object.entries(opts.components)) {
        formData.append(key, String(value));
      }
      formData.append('trxDriver', opts.trxDriver);
      formData.append('mimo', String(opts.mimo));
      formData.append('useNat', String(opts.useNat));
      formData.append('useIPv6', String(opts.useIPv6));
      if (opts.ruIpAddress) formData.append('ruIpAddress', opts.ruIpAddress);

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10 * 60 * 1000);

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
        ? 'Installation timed out after 10 minutes'
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
          <p className="text-sm text-muted-foreground">Install software and manage licenses on remote systems</p>
        </div>
      </div>

      <Tabs defaultValue="install" className="w-full">
        <TabsList className="grid w-fit grid-cols-2">
          <TabsTrigger value="install" className="flex items-center gap-2 px-6">
            <Download className="h-4 w-4" /> Install
          </TabsTrigger>
          <TabsTrigger value="license" className="flex items-center gap-2 px-6">
            <Key className="h-4 w-4" /> License
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
                  hasSystem={!!selectedSystem}
                  systemType={selectedSystem?.type}
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
                    Select a system and start an installation to see progress here.
                  </p>
                )}
                <InstallProgress result={result} isInstalling={isInstalling} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="license">
          <LicenseView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

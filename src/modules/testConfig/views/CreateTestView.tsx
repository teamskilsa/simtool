// Create Config — multi-RAT config builder: NR / LTE / NB-IoT / CAT-M / Core
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Copy, Download, Eye, EyeOff, FolderOpen, Radio, Shield, Wifi, Signal, RotateCcw } from 'lucide-react';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  ConfigBuilder, CoreConfigBuilder, LTEConfigBuilder, NSAConfigBuilder,
  DEFAULT_NR_FORM, DEFAULT_LTE_FORM, DEFAULT_NSA_FORM,
  generateNRConfig, generateCoreConfig, generateLTEConfig, generateNSAConfig,
  embedBuilderMeta, extractBuilderMeta,
  importCfgToBuilder, extractReferencedFiles,
} from '../components/ConfigBuilder';
import { configsService } from '../services/configs.service';
import { useConfigContext } from '../context';
import type { NRFormState, LTEFormState, NSAFormState } from '../components/ConfigBuilder';
import type { ConfigItem } from '../types';

type ConfigType = 'nr' | 'lte' | 'nbiot' | 'catm' | 'core' | 'nsa';

const RAT_OPTIONS: { id: ConfigType; label: string; icon: any; description: string }[] = [
  { id: 'nr',    label: 'NR (5G)',    icon: Radio,  description: 'gNB SA' },
  { id: 'lte',   label: 'LTE',       icon: Wifi,   description: 'eNB' },
  { id: 'nsa',   label: 'NSA',       icon: Radio,  description: 'EN-DC LTE+NR' },
  { id: 'nbiot', label: 'NB-IoT',    icon: Signal, description: 'IoT' },
  { id: 'catm',  label: 'CAT-M',     icon: Signal, description: 'eMTC' },
  { id: 'core',  label: 'Core',      icon: Shield, description: 'MME/AMF' },
];

export const CreateTestView: React.FC = () => {
  const { configs, loadConfigs } = useConfigContext();
  const [configType, setConfigType] = useState<ConfigType>('nr');
  const [configName, setConfigName] = useState('gnb-config');
  const [nrForm, setNrForm] = useState<NRFormState>({ ...DEFAULT_NR_FORM });
  const [lteForm, setLteForm] = useState<LTEFormState>({ ...DEFAULT_LTE_FORM });
  const [nsaForm, setNsaForm] = useState<NSAFormState>({ ...DEFAULT_NSA_FORM });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // The most recently loaded config's raw content. Used to extract external
  // references (drb.cfg, sib*.asn, rf_driver includes) that the form-level
  // generators don't track, so the Dependencies panel can show them.
  const [loadedSourceContent, setLoadedSourceContent] = useState<string>('');

  const handleNrChange = (key: string, value: any) => setNrForm(prev => ({ ...prev, [key]: value }));
  const handleLteChange = (key: string, value: any) => setLteForm(prev => ({ ...prev, [key]: value }));
  const handleNsaChange = (key: 'lteForm' | 'nrForm', value: any) =>
    setNsaForm(prev => ({ ...prev, [key]: value }));

  const handleTypeChange = (type: ConfigType) => {
    setConfigType(type);
    const nameMap: Record<ConfigType, string> = {
      nr: 'gnb-config', lte: 'enb-config', nsa: 'enb-nsa-config',
      nbiot: 'nbiot-config', catm: 'catm-config', core: 'mme-config',
    };
    setConfigName(nameMap[type]);
  };

  // Generate config output based on type
  const configOutput = useMemo(() => {
    switch (configType) {
      case 'nr': return generateNRConfig(nrForm);
      case 'lte': return generateLTEConfig(lteForm, 'lte');
      case 'nsa': return generateNSAConfig(nsaForm);
      case 'nbiot': return generateLTEConfig(lteForm, 'nbiot');
      case 'catm': return generateLTEConfig(lteForm, 'catm');
      case 'core': return generateCoreConfig(nrForm);
    }
  }, [configType, nrForm, lteForm, nsaForm]);

  // External files referenced by this config (drb.cfg, sib*.asn, includes).
  // Merge refs from the live builder output AND the original imported source —
  // the generators only emit what's in form state (drb_config), but the
  // imported source may also have `include` and SIB filenames that we want
  // to surface so the user knows what auxiliary files need to ship together.
  const referencedFiles = useMemo(() => {
    const fromOutput = extractReferencedFiles(configOutput || '');
    const fromSource = extractReferencedFiles(loadedSourceContent);
    const seen = new Set<string>();
    const merged = [];
    for (const r of [...fromOutput, ...fromSource]) {
      if (seen.has(r.filename)) continue;
      seen.add(r.filename);
      merged.push(r);
    }
    return merged;
  }, [configOutput, loadedSourceContent]);
  const availableFilenames = useMemo(() => configs.map((c: ConfigItem) => c.name), [configs]);

  const moduleType = (() => {
    switch (configType) {
      case 'nr': return nrForm.fr2 ? 'gnb' : 'enb';
      case 'lte': case 'nbiot': case 'catm': case 'nsa': return 'enb';
      case 'core': return 'mme';
    }
  })();

  const handleCopy = () => {
    navigator.clipboard.writeText(configOutput);
    toast({ title: 'Copied' });
  };

  const handleDownload = () => {
    const fileName = configName.endsWith('.cfg') ? configName : `${configName}.cfg`;
    const blob = new Blob([configOutput], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: fileName });
  };

  const handleSave = async () => {
    if (!configName.trim()) return;
    setSaving(true);
    try {
      const fileName = configName.endsWith('.cfg') ? configName : `${configName}.cfg`;
      // Embed builder metadata at the top so this config can be loaded back into the form
      const form =
        configType === 'nsa' ? nsaForm :
        (configType === 'lte' || configType === 'nbiot' || configType === 'catm') ? lteForm :
        nrForm;
      const contentWithMeta = embedBuilderMeta(configOutput, { type: configType, form });

      await configsService.importConfig({
        id: `${moduleType}-${Date.now()}`,
        name: fileName,
        module: moduleType as any,
        content: contentWithMeta,
        path: `/root/${moduleType === 'mme' ? 'mme' : 'enb'}/config/${fileName}`,
        createdBy: 'admin',
        createdAt: new Date(),
        modifiedAt: new Date(),
        size: contentWithMeta.length,
      }, 'admin');
      await loadConfigs();
      // Build → Run handoff. The user just saved a config; the obvious
      // next step is to deploy it. The toast carries an action that
      // hands a hint to QuickRunPanel via sessionStorage and switches
      // sections, so they don't have to navigate manually + re-pick.
      const goDeploy = () => {
        if (typeof window === 'undefined') return;
        try {
          window.sessionStorage.setItem(
            'simtool_quickrun_target',
            JSON.stringify({ module: moduleType, configName: fileName }),
          );
        } catch { /* sessionStorage unavailable — user can pick manually */ }
        window.dispatchEvent(
          new CustomEvent('simtool:navigate', { detail: { section: 'test-execution' } }),
        );
      };
      toast({
        title: 'Saved',
        description: `${fileName} saved. Ready to deploy?`,
        action: (
          <ToastAction altText="Deploy now" onClick={goDeploy}>
            Deploy now →
          </ToastAction>
        ),
      });
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err?.message || 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const savedConfigs = configs.filter((c: ConfigItem) =>
    configType === 'core' ? c.module === 'mme' : ['enb', 'gnb'].includes(c.module)
  );

  // CreateTestView mounts with a fresh ConfigProvider (per-section), whose
  // initial configs[] comes from localStorage and is usually empty. Trigger an
  // API fetch on mount so configs populate from the server (where imported
  // .cfg files actually live).
  useEffect(() => {
    loadConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the user clicked "Edit in Builder" from Test Configurations, auto-load
  // that config once the configs array has been populated by the fetch above.
  useEffect(() => {
    const pendingId = typeof window !== 'undefined' ? sessionStorage.getItem('simtool_load_config_id') : null;
    if (!pendingId || configs.length === 0) return;
    const target = configs.find((c: ConfigItem) => c.id === pendingId);
    if (target) {
      sessionStorage.removeItem('simtool_load_config_id');
      handleLoadConfig(pendingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs]);

  const handleLoadConfig = (configId: string) => {
    const config = configs.find((c: ConfigItem) => c.id === configId);
    if (!config || !config.content) {
      toast({ title: 'Load Failed', description: 'Config content unavailable', variant: 'destructive' });
      return;
    }

    const meta = extractBuilderMeta(config.content);
    setConfigName(config.name.replace(/\.cfg$/, ''));
    // Snapshot the source so the Dependencies panel can show includes / SIBs
    // that won't survive the form-state round-trip on its own.
    setLoadedSourceContent(config.content);

    const applyForm = (type: ConfigType, form: any) => {
      setConfigType(type);
      if (type === 'nsa') {
        setNsaForm({
          lteForm: { ...DEFAULT_LTE_FORM, ...(form?.lteForm ?? {}) },
          nrForm:  { ...DEFAULT_NR_FORM,  ...(form?.nrForm  ?? {}) },
        });
      } else if (type === 'lte' || type === 'nbiot' || type === 'catm') {
        setLteForm({ ...DEFAULT_LTE_FORM, ...(form as LTEFormState) });
      } else {
        setNrForm({ ...DEFAULT_NR_FORM, ...(form as NRFormState) });
      }
    };

    if (meta) {
      // Fast path: builder metadata present → restore form state directly
      applyForm(meta.type, meta.form);
      toast({ title: 'Loaded into Builder', description: `${config.name} — edit the blocks, then Save.` });
      return;
    }

    // Fallback: parse the raw Amarisoft .cfg and reverse-engineer form state
    const imported = importCfgToBuilder(config.content, config.name);
    if (imported) {
      applyForm(imported.type, imported.form);
      const warnSuffix = imported.warnings.length > 0
        ? ` — ${imported.warnings.length} note${imported.warnings.length === 1 ? '' : 's'}; review before saving`
        : '';
      toast({
        title: 'Imported into Builder',
        description: `Parsed ${config.name} as ${imported.type.toUpperCase()}${warnSuffix}. Edit and re-save to embed builder metadata.`,
      });
      return;
    }

    // Could not parse — fall back to read-only preview
    setShowPreview(true);
    toast({
      title: 'Loaded (View Only)',
      description: `${config.name} couldn't be parsed into the builder. Preview only.`,
      variant: 'destructive',
    });
  };

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Create Config</h2>
            <p className="text-sm text-muted-foreground">
              Visual Amarisoft config builder
            </p>
          </div>
          {/* RAT dropdown */}
          <div className="ml-2 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">RAT:</span>
            <Select value={configType} onValueChange={(v) => handleTypeChange(v as ConfigType)}>
              <SelectTrigger className="h-9 w-44 text-sm bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RAT_OPTIONS.map(rat => {
                  const Icon = rat.icon;
                  return (
                    <SelectItem key={rat.id} value={rat.id}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{rat.label}</span>
                        <span className="text-[10px] text-gray-500">({rat.description})</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {savedConfigs.length > 0 && (
            <Select onValueChange={handleLoadConfig}>
              <SelectTrigger className="h-8 w-36 text-xs bg-white">
                <FolderOpen className="w-3.5 h-3.5 mr-1" />
                <SelectValue placeholder="Load config" />
              </SelectTrigger>
              <SelectContent>
                {savedConfigs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input
            className="h-8 w-40 text-sm"
            value={configName}
            onChange={e => setConfigName(e.target.value)}
            placeholder="config-name"
          />
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="text-xs">{showPreview ? 'Hide' : 'Preview'}</span>
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={handleCopy}><Copy className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="outline" className="h-8" onClick={handleDownload}><Download className="w-3.5 h-3.5" /></Button>
          <Button size="sm" className="h-8 bg-indigo-600 text-white hover:bg-indigo-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>


      {/* Builder + optional live preview as resizable split */}
      {showPreview ? (
        <ResizablePanel
          className="rounded-lg border border-gray-200 bg-white"
          defaultSplit={55}
          leftClassName="p-4"
          rightClassName="bg-gray-950 rounded-r-lg"
          left={
            <>
              {configType === 'nr' && <ConfigBuilder form={nrForm} onChange={handleNrChange} dependencies={referencedFiles} availableFiles={availableFilenames} />}
              {(configType === 'lte' || configType === 'nbiot' || configType === 'catm') && (
                <LTEConfigBuilder form={lteForm} onChange={handleLteChange} ratMode={configType} dependencies={referencedFiles} availableFiles={availableFilenames} />
              )}
              {configType === 'nsa' && <NSAConfigBuilder form={nsaForm} onChange={handleNsaChange} dependencies={referencedFiles} availableFiles={availableFilenames} />}
              {configType === 'core' && <CoreConfigBuilder form={nrForm} onChange={handleNrChange} />}
            </>
          }
          right={
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900 rounded-tr-lg">
                <span className="text-xs font-mono text-gray-400">
                  {configType === 'core' ? 'mme.cfg' : configType === 'nsa' ? 'enb-nsa.cfg' : 'enb.cfg'}
                </span>
                <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">
                  {RAT_OPTIONS.find(r => r.id === configType)?.description}
                </Badge>
              </div>
              <pre className="flex-1 p-3 text-[11px] font-mono text-gray-300 overflow-auto leading-relaxed">
                {configOutput}
              </pre>
            </div>
          }
        />
      ) : (
        <Card>
          <CardContent className="pt-4">
            {configType === 'nr' && (
              <ConfigBuilder
                form={nrForm} onChange={handleNrChange}
                dependencies={referencedFiles} availableFiles={availableFilenames}
              />
            )}
            {(configType === 'lte' || configType === 'nbiot' || configType === 'catm') && (
              <LTEConfigBuilder
                form={lteForm} onChange={handleLteChange} ratMode={configType}
                dependencies={referencedFiles} availableFiles={availableFilenames}
              />
            )}
            {configType === 'nsa' && (
              <NSAConfigBuilder
                form={nsaForm} onChange={handleNsaChange}
                dependencies={referencedFiles} availableFiles={availableFilenames}
              />
            )}
            {configType === 'core' && <CoreConfigBuilder form={nrForm} onChange={handleNrChange} />}
          </CardContent>
        </Card>
      )}

    </div>
  );
};

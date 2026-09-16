// modules/coreNet/views/CoreNetView.tsx
//
// The Core network workflow, built the same way as the UE-SIM wizard so the
// two read as one product:
//
//   My Cores (list) ──New / Open──▶ Editing Core Config: <name>
//                                   ┌ (1) Network » … (5) Settings ┐
//                                   │ step form   │ Overview / mme.cfg │
//                                   └─────────────┴────────────────────┘
//
// The editable configuration lives in localStorage; Save also writes the
// generated mme.cfg to the server-side config store under module 'mme' so it
// shows up in Test Configurations and can be deployed. When the subscriber
// database is kept in its own file, that second artefact is saved beside it.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Copy, Database, Download, Eye, EyeOff, FileCode2,
  FolderOpen, LayoutPanelLeft, Plus, Save, Trash2, Upload, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { useUser } from '@/modules/users/context/user-context';
import { configsService } from '@/modules/testConfig/services/configs.service';

import { StepBar } from '../config/components/StepBar';
import { NetworkStep } from '../config/components/steps/NetworkStep';
import { PdnStep } from '../config/components/steps/PdnStep';
import { SubscriberStep } from '../config/components/steps/SubscriberStep';
import { ImsStep } from '../config/components/steps/ImsStep';
import { SettingsStep } from '../config/components/steps/SettingsStep';
import { CoreOverview } from '../config/components/CoreOverview';

import { STEPS, type CoreConfig, type StepKey } from '../config/types';
import { makeCoreConfig } from '../config/defaults';
import { plmnString, poolCapacity, totalSubscribers } from '../config/derive';
import {
  extractCoreConfig, generateMmeCfg, generateUeDbFile, validateCoreConfig,
} from '../config/generateMmeCfg';
import { coreConfigStore } from '../config/coreConfigStore';

const TH = 'h-8 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';

type Mode = { kind: 'list' } | { kind: 'edit'; cfg: CoreConfig; dirty: boolean };

/** Which step an issue message belongs to, from its prefix. */
function stepOfIssue(msg: string): StepKey {
  if (/^Network/.test(msg)) return 'network';
  if (/^PDN/.test(msg)) return 'pdn';
  if (/^Subscriber/.test(msg)) return 'subscriber';
  if (/^IMS/.test(msg)) return 'ims';
  return 'settings';
}

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function CoreNetView() {
  const { user } = useUser();
  const userId = user?.id ?? 'admin';

  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [list, setList] = useState<CoreConfig[]>([]);
  const refreshList = useCallback(() => setList(coreConfigStore.list()), []);
  useEffect(() => { refreshList(); }, [refreshList]);

  const startNew = () => setMode({ kind: 'edit', cfg: makeCoreConfig(coreConfigStore.uniqueName('untitled')), dirty: false });
  const open = (id: string) => {
    const cfg = coreConfigStore.get(id);
    if (cfg) setMode({ kind: 'edit', cfg, dirty: false });
  };
  const duplicate = (id: string) => {
    const src = coreConfigStore.get(id);
    if (!src) return;
    const fresh = makeCoreConfig(coreConfigStore.uniqueName(src.settings.configName));
    const dup: CoreConfig = {
      ...JSON.parse(JSON.stringify(src)),
      id: fresh.id, createdAt: fresh.createdAt, modifiedAt: fresh.modifiedAt,
      settings: { ...src.settings, configName: fresh.settings.configName },
    };
    coreConfigStore.upsert(dup);
    refreshList();
    toast({ title: 'Duplicated', description: dup.settings.configName });
  };
  const remove = (id: string) => {
    const cfg = coreConfigStore.get(id);
    if (!cfg) return;
    if (!confirm(`Delete core configuration "${cfg.settings.configName}"? The saved mme.cfg under Test Configurations is kept.`)) return;
    coreConfigStore.remove(id);
    refreshList();
  };
  const importCfg = async (file: File) => {
    const text = await file.text();
    const cfg = extractCoreConfig(text);
    if (!cfg) {
      toast({
        title: 'Not a simtool core configuration',
        description: `${file.name} has no embedded configuration header. Only an mme.cfg generated here can be reopened.`,
        variant: 'destructive',
      });
      return;
    }
    const fresh = makeCoreConfig();
    const imported: CoreConfig = { ...cfg, id: fresh.id, createdAt: fresh.createdAt, modifiedAt: fresh.modifiedAt };
    imported.settings.configName = coreConfigStore.uniqueName(imported.settings.configName || file.name.replace(/\.cfg$/i, ''));
    setMode({ kind: 'edit', cfg: imported, dirty: true });
    toast({ title: 'Imported', description: `${file.name} opened in the editor.` });
  };

  const header = (
    <PageHeader
      icon={<Database />}
      title="Core Network"
      subtitle="Configure the EPC / 5G core and generate mme.cfg"
    />
  );

  if (mode.kind === 'list') {
    return (
      <div className="space-y-4">
        {header}
        <CoreList
          items={list}
          onNew={startNew}
          onOpen={open}
          onDuplicate={duplicate}
          onDelete={remove}
          onImport={importCfg}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <Editor
        key={mode.cfg.id}
        initial={mode.cfg}
        initialDirty={mode.dirty}
        userId={userId}
        onClose={() => { refreshList(); setMode({ kind: 'list' }); }}
      />
    </div>
  );
}

// ── My Cores ──────────────────────────────────────────────────────────────

function CoreList({ items, onNew, onOpen, onDuplicate, onDelete, onImport }: {
  items: CoreConfig[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: (f: File) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {items.length === 0 ? 'No core configurations yet.' : `${items.length} configuration${items.length === 1 ? '' : 's'}`}
        </div>
        <div className="flex items-center gap-1.5">
          <label className="inline-flex">
            <input
              type="file" accept=".cfg,text/plain" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }}
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <span><Upload className="w-3.5 h-3.5 mr-1" /> Import mme.cfg</span>
            </Button>
          </label>
          <Button size="sm" className="h-8 text-xs" onClick={onNew}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New Core Config
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <button
          type="button" onClick={onNew}
          className="w-full rounded-md border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          Create your first core configuration — Network → PDN → Subscribers → IMS → Settings, then save as mme.cfg.
        </button>
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>Name</TableHead>
                <TableHead className={TH}>Core</TableHead>
                <TableHead className={TH}>PLMN</TableHead>
                <TableHead className={TH}>Subscribers</TableHead>
                <TableHead className={TH}>APNs</TableHead>
                <TableHead className={TH}>IMS</TableHead>
                <TableHead className={TH}>Modified</TableHead>
                <TableHead className={`${TH} text-right`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => onOpen(c.id)}>
                  <TableCell className="text-sm font-medium text-foreground">
                    {c.settings.configName}
                    {c.settings.description && (
                      <div className="text-[11px] text-muted-foreground truncate max-w-[320px]">{c.settings.description}</div>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{c.network.coreType}</Badge></TableCell>
                  <TableCell className="text-xs font-mono">{plmnString(c.network.mcc, c.network.mnc)}</TableCell>
                  <TableCell className="text-xs">{totalSubscribers(c)}</TableCell>
                  <TableCell className="text-xs">{c.pdn.pdns.length} · {c.pdn.pdns.map(p => p.apn).slice(0, 3).join(', ')}</TableCell>
                  <TableCell className="text-xs">{c.ims.enabled ? 'on' : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(c.modifiedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpen(c.id)}><FolderOpen className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" title="Duplicate" onClick={() => onDuplicate(c.id)}><Copy className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" title="Delete" onClick={() => onDelete(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────

function Editor({ initial, initialDirty, userId, onClose }: {
  initial: CoreConfig;
  initialDirty: boolean;
  userId: string;
  onClose: () => void;
}) {
  const [cfg, setCfg] = useState<CoreConfig>(initial);
  const [dirty, setDirty] = useState(initialDirty);
  const [step, setStep] = useState<StepKey>('network');
  const [activePdn, setActivePdn] = useState(0);
  const [activeRange, setActiveRange] = useState(0);
  const [panel, setPanel] = useState<'overview' | 'cfg'>('overview');
  const [showPanel, setShowPanel] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = useCallback((patch: Partial<CoreConfig>) => {
    setCfg(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const issues = useMemo(() => validateCoreConfig(cfg), [cfg]);
  const problems = useMemo(() => {
    const out: Partial<Record<StepKey, number>> = {};
    for (const m of issues) { const k = stepOfIssue(m); out[k] = (out[k] ?? 0) + 1; }
    return out;
  }, [issues]);

  const cfgText = useMemo(() => generateMmeCfg(cfg), [cfg]);
  const dbText = useMemo(() => (cfg.subscriber.separateFile ? generateUeDbFile(cfg) : null), [cfg]);
  const subscriberCount = useMemo(() => totalSubscribers(cfg), [cfg]);

  const stepIdx = STEPS.findIndex(s => s.key === step);
  const fileName = `${(cfg.settings.configName || 'mme').trim().replace(/[^\w.-]+/g, '_')}.cfg`;

  const handleSave = async () => {
    if (issues.length > 0) {
      setStep(stepOfIssue(issues[0]));
      toast({
        title: `Can't save — ${issues.length} issue${issues.length === 1 ? '' : 's'}`,
        description: issues.slice(0, 5).map(i => `• ${i}`).join('\n') + (issues.length > 5 ? `\n…and ${issues.length - 5} more` : ''),
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const stored = coreConfigStore.upsert(cfg);
      setCfg(stored);
      setDirty(false);
      const content = generateMmeCfg(stored);
      await configsService.importConfig({
        id: `mme-${stored.id}`,
        name: fileName,
        module: 'mme',
        content,
        path: `/root/mme/config/${fileName}`,
        size: content.length,
      }, userId);
      if (stored.subscriber.separateFile) {
        const db = generateUeDbFile(stored);
        await configsService.importConfig({
          id: `uedb-${stored.id}`,
          name: stored.subscriber.includeFilename,
          module: 'ue_db',
          content: db,
          path: `/root/mme/config/${stored.subscriber.includeFilename}`,
          size: db.length,
        }, userId);
      }
      toast({
        title: 'Saved',
        description: stored.subscriber.separateFile
          ? `${fileName} and ${stored.subscriber.includeFilename} saved to Test Configurations.`
          : `${fileName} saved to Test Configurations (module MME).`,
      });
    } catch (err: any) {
      toast({ title: 'Saved locally only', description: err?.message || 'Could not write the mme.cfg to the config store.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (dirty && !confirm('Discard unsaved changes to this core configuration?')) return;
    onClose();
  };

  const body = (() => {
    switch (step) {
      case 'network':
        return <NetworkStep data={cfg.network} onChange={network => update({ network })} />;
      case 'pdn':
        return (
          <PdnStep
            data={cfg.pdn}
            activeIdx={Math.min(activePdn, cfg.pdn.pdns.length - 1)}
            onActiveChange={setActivePdn}
            onChange={pdn => update({ pdn })}
            subscriberCount={subscriberCount}
            coreType={cfg.network.coreType}
          />
        );
      case 'subscriber':
        return (
          <SubscriberStep
            data={cfg.subscriber}
            network={cfg.network}
            activeIdx={Math.min(activeRange, cfg.subscriber.ranges.length - 1)}
            onActiveChange={setActiveRange}
            onChange={subscriber => update({ subscriber })}
          />
        );
      case 'ims':
        return <ImsStep data={cfg.ims} onChange={ims => update({ ims })} />;
      case 'settings':
        return <SettingsStep data={cfg.settings} onChange={settings => update({ settings })} issues={issues} />;
    }
  })();

  const form = (
    <div className="space-y-4 min-w-0">
      <StepBar active={step} onSelect={setStep} problems={problems} />
      <div className="rounded-md border border-border bg-card p-4 min-w-0">{body}</div>
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={stepIdx === 0} onClick={() => setStep(STEPS[stepIdx - 1].key)}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {stepIdx > 0 ? STEPS[stepIdx - 1].label : 'Back'}
        </Button>
        {stepIdx < STEPS.length - 1 ? (
          <Button size="sm" className="h-8 text-xs" onClick={() => setStep(STEPS[stepIdx + 1].key)}>
            {STEPS[stepIdx + 1].label} <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        ) : (
          <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving…' : 'Save Core Config'}
          </Button>
        )}
      </div>
    </div>
  );

  const side = (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <button
            type="button" onClick={() => setPanel('overview')}
            className={`px-2.5 py-1 text-xs rounded ${panel === 'overview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutPanelLeft className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Overview
          </button>
          <button
            type="button" onClick={() => setPanel('cfg')}
            className={`px-2.5 py-1 text-xs rounded ${panel === 'cfg' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <FileCode2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />mme.cfg
          </button>
        </div>
        {panel === 'cfg' && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" title="Copy" onClick={() => { navigator.clipboard.writeText(cfgText); toast({ title: 'Copied' }); }}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" title="Download mme.cfg" onClick={() => download('mme.cfg', cfgText)}>
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
      {panel === 'overview' ? (
        <CoreOverview cfg={cfg} />
      ) : (
        <div className="space-y-2">
          <pre className="rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-snug font-mono overflow-auto max-h-[70vh] whitespace-pre">
            {cfgText}
          </pre>
          {dbText && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {cfg.subscriber.includeFilename} — {subscriberCount} subscribers
                </span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => download(cfg.subscriber.includeFilename, dbText)}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </div>
              <pre className="rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-snug font-mono overflow-auto max-h-[30vh] whitespace-pre">
                {dbText.length > 4000 ? dbText.slice(0, 4000) + '\n… truncated for display; the download holds every subscriber.' : dbText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const defaultApn = cfg.pdn.pdns[0];
  const capacity = defaultApn ? poolCapacity(defaultApn) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border border-border bg-card px-4 py-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground">
            {coreConfigStore.get(cfg.id) ? 'Editing Core Config:' : 'Creating Core Config:'}
          </span>
          <span className="text-sm font-semibold text-primary truncate">{cfg.settings.configName || 'untitled'}</span>
          <span className="hidden lg:inline text-xs text-muted-foreground">
            {plmnString(cfg.network.mcc, cfg.network.mnc)} · {subscriberCount} subscribers{capacity != null ? ` · ${capacity} addresses` : ''}
          </span>
          {dirty && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">unsaved</Badge>}
          {issues.length > 0 && <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">{issues.length} issue{issues.length === 1 ? '' : 's'}</Badge>}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm" variant="outline" className="h-8 gap-1"
            onClick={() => setShowPanel(v => !v)}
            title={showPanel ? 'Hide the overview and mme.cfg panel' : 'Show the overview and the generated mme.cfg'}
          >
            {showPanel ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="text-xs">{showPanel ? 'Hide' : 'Preview'}</span>
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => download('mme.cfg', cfgText)}>
            <Download className="w-3.5 h-3.5 mr-1" /> mme.cfg
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleClose}>
            <X className="w-3.5 h-3.5 mr-1" /> Close
          </Button>
        </div>
      </div>

      {showPanel ? (
        <ResizablePanel left={form} right={side} defaultSplit={58} minSplit={35} maxSplit={75} />
      ) : (
        form
      )}
    </div>
  );
}

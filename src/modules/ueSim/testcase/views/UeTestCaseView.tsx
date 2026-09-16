// modules/ueSim/testcase/views/UeTestCaseView.tsx
//
// The UE-SIM test-case workflow, Simnovator style:
//
//   My Tests (list)  ──New / Open──▶  Creating Test Case: <name>
//                                     ┌ (1) Cell » (2) Subscriber » … (6) Settings ┐
//                                     │ step form            │ Overview / ue.cfg   │
//                                     └──────────────────────┴─────────────────────┘
//
// State: one UeTestCase object; each step edits its slice. The right-hand
// panel is derived on every keystroke, so the customer-facing overview and
// the generated ue.cfg are always the truth of the form.
//
// Persistence: the test case (editable source) lives in localStorage via
// testCaseStore; Save also pushes the generated ue.cfg to the server-side
// config store (module 'ue') so it appears under Test Configurations and
// can be deployed with the rest of the run.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Copy, Download, Eye, EyeOff, FileCode2, FolderOpen, LayoutPanelLeft,
  Plus, Save, Trash2, Upload, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { useUser } from '@/modules/users/context/user-context';
import { configsService } from '@/modules/testConfig/services/configs.service';

import { StepBar } from '../components/StepBar';
import { CellStep } from '../components/steps/CellStep';
import { SubscriberStep } from '../components/steps/SubscriberStep';
import { UserPlaneStep } from '../components/steps/UserPlaneStep';
import { TrafficStep } from '../components/steps/TrafficStep';
import { MobilityStep } from '../components/steps/MobilityStep';
import { SettingsStep } from '../components/steps/SettingsStep';
import { TestOverview } from '../components/TestOverview';

import { STEPS, type RatType, type StepKey, type UeTestCase } from '../types';
import { makeSubscriberGroup, makeTestCase } from '../defaults';
import { aggregateMbps, formatSeconds, removeSubscriberGroup, testLength, totalUes } from '../derive';
import { extractTestCase, generateUeCfg, rfDriverArgs, validateTestCase } from '../generateUeCfg';
import { testCaseStore } from '../testCaseStore';

const TH = 'h-8 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';

type Mode = { kind: 'list' } | { kind: 'edit'; tc: UeTestCase; dirty: boolean };

/** Which step an issue message belongs to, from its prefix. */
function stepOfIssue(msg: string): StepKey {
  if (/^Cell/.test(msg)) return 'cell';
  if (/^(UE Group|Subscriber)/.test(msg)) return 'subscriber';
  if (/^UserPlane/.test(msg)) return 'userPlane';
  if (/^Traffic/.test(msg)) return 'traffic';
  if (/^Mobility/.test(msg)) return 'mobility';
  return 'settings';
}

export function UeTestCaseView() {
  const { user } = useUser();
  const userId = user?.id ?? 'admin';

  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [list, setList] = useState<UeTestCase[]>([]);
  const refreshList = useCallback(() => setList(testCaseStore.list()), []);
  useEffect(() => { refreshList(); }, [refreshList]);

  // ── list actions ──────────────────────────────────────────────────────
  const startNew = () => {
    const tc = makeTestCase(testCaseStore.uniqueName('untitled'));
    setMode({ kind: 'edit', tc, dirty: false });
  };
  const open = (id: string) => {
    const tc = testCaseStore.get(id);
    if (tc) setMode({ kind: 'edit', tc, dirty: false });
  };
  const duplicate = (id: string) => {
    const src = testCaseStore.get(id);
    if (!src) return;
    const copy = makeTestCase(testCaseStore.uniqueName(src.settings.testCaseName));
    const dup: UeTestCase = {
      ...JSON.parse(JSON.stringify(src)),
      id: copy.id, createdAt: copy.createdAt, modifiedAt: copy.modifiedAt,
      settings: { ...src.settings, testCaseName: copy.settings.testCaseName },
    };
    testCaseStore.upsert(dup);
    refreshList();
    toast({ title: 'Duplicated', description: dup.settings.testCaseName });
  };
  const remove = (id: string) => {
    const tc = testCaseStore.get(id);
    if (!tc) return;
    if (!confirm(`Delete test case "${tc.settings.testCaseName}"? The saved ue.cfg under Test Configurations is kept.`)) return;
    testCaseStore.remove(id);
    refreshList();
  };
  const importCfg = async (file: File) => {
    const text = await file.text();
    const tc = extractTestCase(text);
    if (!tc) {
      toast({ title: 'Not a simtool test case', description: `${file.name} has no embedded test-case header. Only ue.cfg files generated here can be reopened.`, variant: 'destructive' });
      return;
    }
    const fresh = makeTestCase();
    const imported: UeTestCase = { ...tc, id: fresh.id, createdAt: fresh.createdAt, modifiedAt: fresh.modifiedAt };
    imported.settings.testCaseName = testCaseStore.uniqueName(imported.settings.testCaseName || file.name.replace(/\.cfg$/i, ''));
    setMode({ kind: 'edit', tc: imported, dirty: true });
    toast({ title: 'Imported', description: `${file.name} opened in the wizard.` });
  };

  if (mode.kind === 'list') {
    return (
      <TestList
        items={list}
        onNew={startNew}
        onOpen={open}
        onDuplicate={duplicate}
        onDelete={remove}
        onImport={importCfg}
      />
    );
  }

  return (
    <Editor
      key={mode.tc.id}
      initial={mode.tc}
      initialDirty={mode.dirty}
      userId={userId}
      onClose={() => { refreshList(); setMode({ kind: 'list' }); }}
    />
  );
}

// ── My Tests ──────────────────────────────────────────────────────────────

function TestList({ items, onNew, onOpen, onDuplicate, onDelete, onImport }: {
  items: UeTestCase[];
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
          {items.length === 0 ? 'No UE-SIM test cases yet.' : `${items.length} test case${items.length === 1 ? '' : 's'}`}
        </div>
        <div className="flex items-center gap-1.5">
          <label className="inline-flex">
            <input
              type="file" accept=".cfg,text/plain" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }}
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <span><Upload className="w-3.5 h-3.5 mr-1" /> Import ue.cfg</span>
            </Button>
          </label>
          <Button size="sm" className="h-8 text-xs" onClick={onNew}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New Test Case
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <button
          type="button" onClick={onNew}
          className="w-full rounded-md border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          Create your first UE-SIM test case — Cell → Subscriber → User Plane → Traffic → Mobility → Settings, then save as ue.cfg.
        </button>
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>Name</TableHead>
                <TableHead className={TH}>RAT</TableHead>
                <TableHead className={TH}>Cells</TableHead>
                <TableHead className={TH}>UEs</TableHead>
                <TableHead className={TH}>Traffic</TableHead>
                <TableHead className={TH}>Length</TableHead>
                <TableHead className={TH}>Modified</TableHead>
                <TableHead className={`${TH} text-right`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(t => {
                const traffic = t.userPlane.profiles.filter(p => p.dataType !== 'None').map(p => p.dataType);
                return (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => onOpen(t.id)}>
                    <TableCell className="text-sm font-medium text-foreground">
                      {t.settings.testCaseName}
                      {t.settings.description && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-[320px]">{t.settings.description}</div>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{t.cell.ratType}</Badge></TableCell>
                    <TableCell className="text-xs">{t.cell.cells.length} · {t.cell.cells.map(c => (t.cell.ratType === '5G:SA' ? c.band : `B${c.band}`)).join(', ')}</TableCell>
                    <TableCell className="text-xs">{totalUes(t)} in {t.subscriber.groups.length} group{t.subscriber.groups.length === 1 ? '' : 's'}</TableCell>
                    <TableCell className="text-xs">{traffic.length ? [...new Set(traffic)].join(', ') : '—'}</TableCell>
                    <TableCell className="text-xs">{formatSeconds(testLength(t))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(t.modifiedAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpen(t.id)}><FolderOpen className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" title="Duplicate" onClick={() => onDuplicate(t.id)}><Copy className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" title="Delete" onClick={() => onDelete(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────

function Editor({ initial, initialDirty, userId, onClose }: {
  initial: UeTestCase;
  initialDirty: boolean;
  userId: string;
  onClose: () => void;
}) {
  const [tc, setTc] = useState<UeTestCase>(initial);
  const [dirty, setDirty] = useState(initialDirty);
  const [step, setStep] = useState<StepKey>('cell');
  const [activeCell, setActiveCell] = useState(0);
  const [activeGroup, setActiveGroup] = useState(0);
  const [activeUp, setActiveUp] = useState(0);
  const [activeTraffic, setActiveTraffic] = useState(0);
  const [panel, setPanel] = useState<'overview' | 'cfg'>('overview');
  const [showPanel, setShowPanel] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = useCallback((patch: Partial<UeTestCase>) => {
    setTc(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  // Changing RAT re-seeds release / category defaults on every group; the
  // credentials and counts the user typed are kept.
  const onRatChange = (rat: RatType) => {
    setTc(prev => ({
      ...prev,
      subscriber: {
        ...prev.subscriber,
        groups: prev.subscriber.groups.map(g => {
          const seed = makeSubscriberGroup(g.id, rat);
          return { ...g, asRelease: seed.asRelease, ueCategoryType: seed.ueCategoryType, ueCategory: seed.ueCategory, vonrSupport: seed.vonrSupport };
        }),
      },
    }));
    setDirty(true);
  };

  const issues = useMemo(() => validateTestCase(tc), [tc]);
  const problems = useMemo(() => {
    const out: Partial<Record<StepKey, number>> = {};
    for (const m of issues) { const k = stepOfIssue(m); out[k] = (out[k] ?? 0) + 1; }
    return out;
  }, [issues]);

  const cfgText = useMemo(() => generateUeCfg(tc), [tc]);
  const derivedRf = useMemo(() => rfDriverArgs({ ...tc, settings: { ...tc.settings, rfDriverArgs: '' } }), [tc]);
  const aggregate = useMemo(() => ({ dl: aggregateMbps(tc, 'DL'), ul: aggregateMbps(tc, 'UL') }), [tc]);

  const stepIdx = STEPS.findIndex(s => s.key === step);
  const fileName = `${(tc.settings.testCaseName || 'untitled').trim().replace(/[^\w.-]+/g, '_')}.cfg`;

  // ── actions ────────────────────────────────────────────────────────────
  const saveLocal = (): UeTestCase => {
    const stored = testCaseStore.upsert(tc);
    setTc(stored);
    setDirty(false);
    return stored;
  };

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
      const stored = saveLocal();
      const content = generateUeCfg(stored);
      await configsService.importConfig({
        id: `ue-${stored.id}`,
        name: fileName,
        module: 'ue',
        content,
        path: `/root/ue/config/${fileName}`,
        size: content.length,
      }, userId);
      toast({ title: 'Saved', description: `${fileName} saved to Test Configurations (module UE).` });
    } catch (err: any) {
      toast({ title: 'Saved locally only', description: err?.message || 'Could not write the ue.cfg to the config store.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([cfgText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ue.cfg'; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: `ue.cfg (${tc.settings.testCaseName})` });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cfgText);
    toast({ title: 'Copied', description: 'ue.cfg is on the clipboard.' });
  };

  const handleClose = () => {
    if (dirty && !confirm('Discard unsaved changes to this test case?')) return;
    onClose();
  };

  // ── step body ──────────────────────────────────────────────────────────
  const body = (() => {
    switch (step) {
      case 'cell':
        return (
          <CellStep
            data={tc.cell}
            activeIdx={Math.min(activeCell, tc.cell.cells.length - 1)}
            onActiveChange={setActiveCell}
            onChange={cell => update({ cell })}
            onRatChange={onRatChange}
          />
        );
      case 'subscriber':
        return (
          <SubscriberStep
            data={tc.subscriber}
            cell={tc.cell}
            activeIdx={Math.min(activeGroup, tc.subscriber.groups.length - 1)}
            onActiveChange={setActiveGroup}
            onChange={subscriber => update({ subscriber })}
            onRemoveGroup={idx => { setTc(prev => removeSubscriberGroup(prev, idx)); setDirty(true); }}
          />
        );
      case 'userPlane':
        return (
          <UserPlaneStep
            data={tc.userPlane}
            subscriber={tc.subscriber}
            activeIdx={Math.min(activeUp, tc.userPlane.profiles.length - 1)}
            onActiveChange={setActiveUp}
            onChange={userPlane => update({ userPlane })}
            aggregate={aggregate}
          />
        );
      case 'traffic':
        return (
          <TrafficStep
            data={tc.traffic}
            subscriber={tc.subscriber}
            activeIdx={Math.min(activeTraffic, tc.traffic.profiles.length - 1)}
            onActiveChange={setActiveTraffic}
            onChange={traffic => update({ traffic })}
          />
        );
      case 'mobility':
        return (
          <MobilityStep
            data={tc.mobility}
            cell={tc.cell}
            subscriber={tc.subscriber}
            onChange={mobility => update({ mobility })}
            onEnableMobility={() => update({ cell: { ...tc.cell, mobility: true } })}
          />
        );
      case 'settings':
        return (
          <SettingsStep
            data={tc.settings}
            onChange={settings => update({ settings })}
            issues={issues}
            derivedRfArgs={derivedRf}
          />
        );
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
            <Save className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving…' : 'Save Test Case'}
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
            <FileCode2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />ue.cfg
          </button>
        </div>
        {panel === 'cfg' && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCopy} title="Copy"><Copy className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleDownload} title="Download ue.cfg"><Download className="w-3.5 h-3.5" /></Button>
          </div>
        )}
      </div>
      {panel === 'overview' ? (
        <TestOverview tc={tc} />
      ) : (
        <pre className="rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-snug font-mono overflow-auto max-h-[70vh] whitespace-pre">
          {cfgText}
        </pre>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Title row — "Creating Test Case: <name>" + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border border-border bg-card px-4 py-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground">{initialDirty || !testCaseStore.get(tc.id) ? 'Creating Test Case:' : 'Editing Test Case:'}</span>
          <span className="text-sm font-semibold text-primary truncate">{tc.settings.testCaseName || 'untitled'}</span>
          {dirty && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">unsaved</Badge>}
          {issues.length > 0 && <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">{issues.length} issue{issues.length === 1 ? '' : 's'}</Badge>}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm" variant="outline" className="h-8 gap-1"
            onClick={() => setShowPanel(v => !v)}
            title={showPanel ? 'Hide the overview and ue.cfg panel' : 'Show the overview and the generated ue.cfg'}
          >
            {showPanel ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="text-xs">{showPanel ? 'Hide' : 'Preview'}</span>
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5 mr-1" /> ue.cfg
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

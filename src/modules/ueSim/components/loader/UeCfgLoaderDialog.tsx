// modules/ueSim/components/loader/UeCfgLoaderDialog.tsx
//
// Drop a .cfg file or paste raw text → parse → preview detected sections →
// save each as a Section File → assemble them into a new Profile.
//
// The user picks a base name; the dialog suggests "<base> – <section>" for
// each generated section file so the relationship stays obvious in the
// per-tab dropdowns.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import { parseUeCfg } from '../../services/cfgParser';
import { mapToSections } from '../../services/sectionMapper';
import {
  cellSections, channelSections, profileStore,
  settingsSections, subscriberSections, trafficSections, userPlaneSections,
} from '../../services/sectionStore';
import type { LoaderResult, UeProfile } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (newProfileId: string) => void;
}

type SectionKey = keyof UeProfile['sectionIds'];

const SECTION_LABELS: Record<SectionKey, string> = {
  cell: 'Cell',
  subscriber: 'Subscriber',
  traffic: 'Traffic',
  userPlane: 'User Plane',
  channel: 'Channel Modelling',
  settings: 'Settings',
};

const ALL_SECTIONS: SectionKey[] = [
  'cell', 'subscriber', 'traffic', 'userPlane', 'channel', 'settings',
];

export function UeCfgLoaderDialog({ open, onClose, onImported }: Props) {
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [profileName, setProfileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Record<SectionKey, boolean>>({
    cell: true, subscriber: true, traffic: true,
    userPlane: true, channel: true, settings: true,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset on open/close.
  useEffect(() => {
    if (!open) {
      setText('');
      setFilename('');
      setProfileName('');
      setError(null);
      setEnabled({
        cell: true, subscriber: true, traffic: true,
        userPlane: true, channel: true, settings: true,
      });
    }
  }, [open]);

  const result: LoaderResult | null = useMemo(() => {
    if (!text.trim()) return null;
    try {
      const parsed = parseUeCfg(text);
      const sections = mapToSections(parsed);
      // Detect RAT from cell groups.
      const groupTypes = sections.cell.cell_groups.map(g => g.group_type);
      const rat: 'lte' | 'nr' | 'mixed' | 'unknown' =
        groupTypes.length === 0 ? 'unknown'
          : groupTypes.every(g => g === 'lte') ? 'lte'
          : groupTypes.every(g => g === 'nr') ? 'nr'
          : 'mixed';
      return {
        parsed,
        detected: {
          rat,
          cell_groups: sections.cell.cell_groups.length,
          ue_count: sections.subscriber.ues.length,
          channel_sim: sections.channel.channel_sim,
        },
        sections,
      };
    } catch (e: any) {
      setError(e?.message ?? 'Failed to parse ue.cfg');
      return null;
    }
  }, [text]);

  // Clear parse error when text changes successfully.
  useEffect(() => {
    if (result) setError(null);
  }, [result]);

  const handleFile = async (file: File) => {
    setFilename(file.name);
    if (!profileName) {
      const base = file.name.replace(/\.(cfg|json|txt)$/i, '');
      setProfileName(base);
    }
    const txt = await file.text();
    setText(txt);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleImport = () => {
    if (!result) return;
    const trimmed = profileName.trim() || filename.replace(/\.\w+$/, '') || 'Imported';
    const sourceFile = filename || 'pasted';

    // Save each enabled section. For disabled sections, fall back to the
    // existing built-in default (so the resulting profile is still complete).
    // We always have built-ins because sectionStore seeds them.
    const ids: UeProfile['sectionIds'] = {
      cell: enabled.cell
        ? cellSections.save(`${trimmed} – Cell`, result.sections.cell, undefined, sourceFile).id
        : 'builtin-cell-default-nr',
      subscriber: enabled.subscriber
        ? subscriberSections.save(`${trimmed} – Subscriber`, result.sections.subscriber, undefined, sourceFile).id
        : 'builtin-subscriber-1ue',
      traffic: enabled.traffic
        ? trafficSections.save(`${trimmed} – Traffic`, result.sections.traffic, undefined, sourceFile).id
        : 'builtin-traffic-default',
      userPlane: enabled.userPlane
        ? userPlaneSections.save(`${trimmed} – User Plane`, result.sections.userPlane, undefined, sourceFile).id
        : 'builtin-userplane-tun',
      channel: enabled.channel
        ? channelSections.save(`${trimmed} – Channel`, result.sections.channel, undefined, sourceFile).id
        : 'builtin-channel-off',
      settings: enabled.settings
        ? settingsSections.save(`${trimmed} – Settings`, result.sections.settings, undefined, sourceFile).id
        : 'builtin-settings-default',
    };

    const profile = profileStore.save({
      name: trimmed,
      description: `Imported from ${sourceFile}`,
      sectionIds: ids,
    });
    onImported(profile.id);
    onClose();
  };

  const canImport = !!result && profileName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Load ue.cfg</DialogTitle>
          <DialogDescription>
            Drop or paste an Amarisoft UE configuration file. It will be
            split into 6 reusable section files and bundled as a new profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Drop zone + file picker */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
            <div className="text-sm">
              {filename ? (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-4 w-4" /> {filename}
                </span>
              ) : (
                'Drop ue.cfg here, click to browse, or paste below'
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".cfg,.json,.txt,text/plain"
              className="hidden"
              onChange={onFileInput}
            />
          </div>

          {/* Paste area */}
          <div className="space-y-1">
            <Label htmlFor="cfg-paste" className="text-xs">Or paste cfg contents</Label>
            <textarea
              id="cfg-paste"
              value={text}
              onChange={e => setText(e.target.value)}
              className="font-mono text-xs w-full h-32 rounded-md border bg-background p-2 resize-none"
              placeholder="/* paste a ue.cfg here */"
            />
          </div>

          {/* Error / detection summary */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded p-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {result && (
            <>
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Parsed successfully
                <Badge variant="outline" className="ml-2">{result.detected.rat.toUpperCase()}</Badge>
                <span className="text-muted-foreground">
                  {result.detected.cell_groups} cell group(s), {result.detected.ue_count} UE(s)
                </span>
              </div>

              {result.parsed.warnings.length > 0 && (
                <ScrollArea className="max-h-24 border rounded p-2 bg-amber-50/50 dark:bg-amber-950/20">
                  <ul className="text-xs space-y-0.5">
                    {result.parsed.warnings.map((w, i) => (
                      <li key={i} className="text-amber-700 dark:text-amber-400">⚠ {w}</li>
                    ))}
                  </ul>
                </ScrollArea>
              )}

              {/* Section selection */}
              <div className="space-y-2">
                <Label className="text-xs">Save which sections as new files?</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_SECTIONS.map(key => (
                    <label
                      key={key}
                      className="flex items-center gap-2 border rounded p-2 cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={enabled[key]}
                        onCheckedChange={v => setEnabled(prev => ({ ...prev, [key]: !!v }))}
                      />
                      <span className="text-sm">{SECTION_LABELS[key]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Profile name */}
              <div className="space-y-1">
                <Label htmlFor="profile-name" className="text-xs">Profile name</Label>
                <Input
                  id="profile-name"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="e.g. n78 100MHz 32 UEs"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={!canImport}>
            Import as Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// modules/ueSim/components/apply/ApplyDialog.tsx
//
// Preview hot/cold diff between the on-target profile (which we model as the
// "last applied" snapshot) and the in-memory MaterializedProfile, and
// give the user a copy-paste path to push it via the existing Remote API
// console. Doing the SSH + service-restart loop end-to-end requires a
// system selector that this view doesn't own yet; we keep the contract
// honest by providing the JSON the user would send and a clear summary.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, AlertTriangle, Zap, RefreshCw } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { MaterializedProfile } from '../../types';
import { diffProfiles, summarizeDiff } from '../../services/applyService';
import { emitUeCfg, emitLogOptionsString } from '../../services/cfgEmitter';

interface Props {
  open: boolean;
  onClose: () => void;
  baseline: MaterializedProfile | null;   // what's "live" — null if first apply
  current: MaterializedProfile | null;    // what's in the editor right now
  profileName: string;
}

const LAST_APPLIED_KEY_PREFIX = 'simtool_uesim_last_applied_';

/**
 * Read the last-applied snapshot for this profile. We persist it under
 * profile name (not ID) because IDs change on duplication and the snapshot
 * is conceptually "what's running on the box for this label".
 */
export function readLastApplied(profileName: string): MaterializedProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_APPLIED_KEY_PREFIX + profileName);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLastApplied(profileName: string, profile: MaterializedProfile): void {
  if (typeof window === 'undefined') return;
  try {
    // Strip secrets before persisting. com_password is the Amarisoft
    // Remote API auth password — nothing in this snapshot reads it
    // back (the diff doesn't need a value, it just classifies the
    // path), so storing it in localStorage adds risk for zero benefit.
    // Any XSS payload on the app domain can read localStorage; keep
    // secrets out of it.
    const sanitized: MaterializedProfile = {
      ...profile,
      settings: { ...profile.settings, com_password: undefined },
    };
    window.localStorage.setItem(
      LAST_APPLIED_KEY_PREFIX + profileName,
      JSON.stringify(sanitized),
    );
  } catch {
    /* best effort */
  }
}

export function ApplyDialog({ open, onClose, baseline, current, profileName }: Props) {
  const [copied, setCopied] = useState<'cfg' | 'json' | null>(null);

  const diff = useMemo(() => {
    if (!current) return null;
    return diffProfiles(baseline, current);
  }, [baseline, current]);

  const hotPatch = useMemo(() => {
    if (!current || !diff) return null;
    // Build a config_set body ONLY from fields we can translate to real
    // Amarisoft Remote API keys (tx_gain / rx_gain are top-level; log
    // changes are pushed as the complete log_options string). Everything
    // else hot (per-cell channel, mobility, traffic events) lives in its
    // own Remote API message and is listed as "apply separately" instead
    // of being guessed into a nested body the API would reject.
    const hot = diff.entries.filter(e => e.kind === 'hot');
    if (hot.length === 0) return null;
    const body: Record<string, any> = { message: 'config_set' };
    const unmapped: string[] = [];
    let needLogOptions = false;
    let mapped = 0;
    for (const e of hot) {
      if (e.path === 'settings.tx_gain') { body.tx_gain = e.after; mapped++; }
      else if (e.path === 'settings.rx_gain') { body.rx_gain = e.after; mapped++; }
      else if (e.path.startsWith('settings.log_layers') || e.path === 'settings.log_options_extra') {
        needLogOptions = true;
        mapped++;
      } else {
        unmapped.push(e.path);
      }
    }
    if (needLogOptions) body.log_options = emitLogOptionsString(current.settings);
    return { body: mapped > 0 ? body : null, unmapped };
  }, [diff, current]);

  const fullCfg = useMemo(() => {
    if (!current) return '';
    return emitUeCfg(current, { header: `simtool — profile "${profileName}"` });
  }, [current, profileName]);

  const copy = (text: string, which: 'cfg' | 'json') => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1500);
    });
  };

  const markApplied = () => {
    if (current) writeLastApplied(profileName, current);
    onClose();
  };

  // Reset copy flash on open/close.
  useEffect(() => { setCopied(null); }, [open]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Apply Changes — {profileName}</DialogTitle>
          <DialogDescription>
            Review what changed since the last apply. Hot entries are pushable
            via Remote API <code>config_set</code>. Cold entries require
            writing a new ue.cfg and restarting the lte service.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {!current && (
            <div className="text-sm text-muted-foreground">
              No active profile to apply.
            </div>
          )}

          {current && diff && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={diff.hasCold ? 'default' : 'outline'} className="gap-1">
                  <RefreshCw className="h-3 w-3" /> {diff.entries.filter(e => e.kind === 'cold').length} cold
                </Badge>
                <Badge variant={diff.hasHot ? 'default' : 'outline'} className="gap-1">
                  <Zap className="h-3 w-3" /> {diff.entries.filter(e => e.kind === 'hot').length} hot
                </Badge>
                {!baseline && (
                  <Badge variant="secondary">first apply — full cfg</Badge>
                )}
              </div>

              {diff.entries.length === 0 && baseline && (
                <div className="text-sm text-emerald-600">
                  Nothing changed since last apply.
                </div>
              )}

              {diff.entries.length > 0 && (
                <ScrollArea className="max-h-64 border rounded p-2 bg-muted/30">
                  {/*
                    summarizeDiff returns Array<{section, lines: string[]}>.
                    The previous render (`<pre>{summarizeDiff(diff)}</pre>`)
                    coerced the array to a string and produced
                    "[object Object][object Object]". We render one block
                    per section with the section name as a header.
                  */}
                  <div className="text-xs space-y-2">
                    {summarizeDiff(diff).map((group) => (
                      <div key={group.section}>
                        <div className="font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.section}
                        </div>
                        <pre className="whitespace-pre-wrap font-mono">
                          {group.lines.join('\n')}
                        </pre>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {diff.hasCold && (
                <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                  <div>
                    <strong>Cold restart required.</strong> Save the .cfg file
                    onto your target host (overwriting the existing ue.cfg) and
                    run <code className="font-mono">service lte restart</code>.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => copy(fullCfg, 'cfg')}
                  disabled={!current}
                >
                  {copied === 'cfg' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copy full ue.cfg
                </Button>
                <Button
                  variant="outline"
                  onClick={() => hotPatch?.body && copy(JSON.stringify(hotPatch.body, null, 2), 'json')}
                  disabled={!hotPatch?.body}
                >
                  {copied === 'json' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copy hot config_set JSON
                </Button>
              </div>

              {hotPatch && hotPatch.unmapped.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Not included in config_set (use their own Remote API messages,
                  e.g. <code className="font-mono">ue_move</code> for mobility):{' '}
                  <span className="font-mono">{hotPatch.unmapped.join(', ')}</span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={markApplied} disabled={!current}>Mark as Applied</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


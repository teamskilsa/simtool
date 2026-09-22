// Catalogue-driven command picker for the Remote API console.
//
// Commands, parameters, ranges and help text come from the 2026-09-11
// Amarisoft docs (src/shared/default/templates/remoteapi). Picking a command
// or preset inserts its JSON into the editor; the parameter table below it is
// what the pre-send validator enforces.

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Kicker } from '@/components/ui/stat';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ThemeConfig } from '@/components/theme/types/theme.types';
import {
  getCatalogue,
  getCategories,
  type ApiCommand,
  type ComponentType,
  type ParamSpec,
} from '../../../shared/default/templates/remoteapi';
import { versionAtLeast } from '../utils/version';

interface CommandSelectorProps {
  componentType: ComponentType;
  /** Server version from the ready banner (gates newer commands). */
  serverVersion?: string | null;
  /** Kept for callers that still pass it; styling now uses the ui primitives. */
  themeConfig?: ThemeConfig;
  onCommandSelect: (command: string) => void;
}

export const DANGER_BADGE: Record<ApiCommand['danger'], { label: string; className: string }> = {
  safe: { label: 'read / safe', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  caution: { label: 'changes live state', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  destructive: { label: 'destructive', className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20' },
};

function typeLabel(spec: ParamSpec): string {
  const t = Array.isArray(spec.type) ? spec.type.join(' | ') : spec.type;
  return spec.items ? `${t}<${spec.items}>` : t;
}

function constraintLabel(spec: ParamSpec): string {
  const parts: string[] = [];
  if (spec.min !== undefined && spec.max !== undefined) parts.push(`[${spec.min}:${spec.max}]`);
  else if (spec.min !== undefined) parts.push(`>= ${spec.min}`);
  else if (spec.max !== undefined) parts.push(`<= ${spec.max}`);
  if (spec.enum) parts.push(spec.enum.join(' | '));
  if (spec.default !== undefined) parts.push(`default ${JSON.stringify(spec.default)}`);
  if (spec.aliases?.length) parts.push(`alias ${spec.aliases.join(', ')}`);
  if (spec.minVersion) parts.push(`since ${spec.minVersion}`);
  return parts.join(' · ');
}

const pretty = (body: unknown) => JSON.stringify(body, null, 2);

export function CommandSelector({ componentType, serverVersion, onCommandSelect }: CommandSelectorProps) {
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');

  const catalogue = useMemo(() => getCatalogue(componentType), [componentType]);
  const categories = useMemo(() => getCategories(componentType), [componentType]);
  const commands = catalogue.filter(c => c.category === category);
  const selected = catalogue.find(c => c.category === category && c.message === message);

  useEffect(() => {
    setCategory('');
    setMessage('');
  }, [componentType]);

  const tooNew = (c: ApiCommand) => !!(c.minVersion && serverVersion && !versionAtLeast(serverVersion, c.minVersion));

  const pick = (msg: string) => {
    setMessage(msg);
    const cmd = commands.find(c => c.message === msg);
    if (cmd) onCommandSelect(pretty(cmd.example));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Kicker>Category</Kicker>
          <Select value={category} onValueChange={(v) => { setCategory(v); setMessage(''); }}>
            <SelectTrigger><SelectValue placeholder={`${componentType} command category`} /></SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat} description={`${catalogue.filter(c => c.category === cat).length} commands`}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Kicker>Command</Kicker>
          <Select value={message} onValueChange={pick} disabled={!category}>
            <SelectTrigger><SelectValue placeholder="Pick a command" /></SelectTrigger>
            <SelectContent>
              {commands.map(cmd => (
                <SelectItem
                  key={cmd.message}
                  value={cmd.message}
                  disabled={tooNew(cmd)}
                  description={tooNew(cmd) ? `needs ${cmd.minVersion}, server runs ${serverVersion}` : `${cmd.message}${cmd.danger !== 'safe' ? ` · ${DANGER_BADGE[cmd.danger].label}` : ''}`}
                >
                  {cmd.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-sm" data-testid="command-details">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-xs font-semibold">{selected.message}</code>
            <Badge variant="outline" className={DANGER_BADGE[selected.danger].className}>
              {selected.danger === 'destructive' ? <ShieldAlert className="mr-1 h-3 w-3" /> : selected.danger === 'caution' ? <AlertTriangle className="mr-1 h-3 w-3" /> : null}
              {DANGER_BADGE[selected.danger].label}
            </Badge>
            {selected.longPoll && <Badge variant="outline">long-poll</Badge>}
            {selected.minVersion && <Badge variant="outline">since {selected.minVersion}</Badge>}
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3" />{selected.docRef}
            </span>
          </div>
          <p className="text-muted-foreground">{selected.description}</p>
          {selected.dangerNote && <p className="text-xs text-amber-700 dark:text-amber-400">{selected.dangerNote}</p>}
          {selected.notes && <p className="text-xs text-muted-foreground italic">{selected.notes}</p>}

          {selected.params && Object.keys(selected.params).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">param</th>
                    <th className="py-1 pr-3 font-medium">type</th>
                    <th className="py-1 pr-3 font-medium">range / values</th>
                    <th className="py-1 font-medium">help</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selected.params).map(([name, spec]) => (
                    <tr key={name} className="border-t border-border/60 align-top">
                      <td className="py-1 pr-3 font-mono whitespace-nowrap">
                        {name}{spec.required && <span className="text-red-600 dark:text-red-400">*</span>}
                      </td>
                      <td className="py-1 pr-3 font-mono whitespace-nowrap">{typeLabel(spec)}</td>
                      <td className="py-1 pr-3 whitespace-nowrap">{constraintLabel(spec)}</td>
                      <td className="py-1">{spec.help}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selected.oneOf?.length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.oneOf.map(g => `one of ${g.join(' / ')}`).join('; ')} required
                </p>
              ) : null}
            </div>
          )}

          {selected.presets && selected.presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Kicker className="w-full">Presets</Kicker>
              {selected.presets.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onCommandSelect(pretty(p.body))}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Section Files — template manager for reusable config sections
// Users can browse/view/delete built-in and user-saved PDN, UE DB, General templates
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  FolderTree, Globe, Smartphone, Shield, Trash2, Search, Package, Lock,
  Radio, Wifi, FileText, Upload, Download,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { sectionFilesService, type SectionFile, type SectionType } from '../services/sectionFiles.service';

const TYPE_META: Record<SectionType, { label: string; icon: any; color: string }> = {
  pdn:     { label: 'PDN / APN',   icon: Globe,       color: 'text-blue-600 bg-blue-50 border-blue-200' },
  uedb:    { label: 'UE Database', icon: Smartphone,  color: 'text-purple-600 bg-purple-50 border-purple-200' },
  general: { label: 'General',     icon: Shield,      color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  cell:    { label: 'Cell',        icon: Radio,       color: 'text-amber-600 bg-amber-50 border-amber-200' },
  band:    { label: 'Band',        icon: Package,     color: 'text-rose-600 bg-rose-50 border-rose-200' },
  rf:      { label: 'RF',          icon: Wifi,        color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  log:     { label: 'Log',         icon: FileText,    color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

const ALL_TYPES: (SectionType | 'all')[] = ['all', 'pdn', 'uedb', 'general', 'cell', 'band', 'rf', 'log'];

export const SectionFilesView: React.FC = () => {
  const [files, setFiles] = useState<SectionFile[]>([]);
  const [typeFilter, setTypeFilter] = useState<SectionType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SectionFile | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = () => setFiles(sectionFilesService.list());
  useEffect(refresh, []);

  const filtered = useMemo(() => {
    return files.filter(f => {
      if (typeFilter !== 'all' && f.type !== typeFilter) return false;
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [files, typeFilter, search]);

  const handleDelete = (sf: SectionFile) => {
    if (sf.builtIn) {
      toast({ title: 'Cannot delete', description: 'Built-in templates can\'t be removed.', variant: 'destructive' });
      return;
    }
    if (confirm(`Delete "${sf.name}"?`)) {
      sectionFilesService.remove(sf.id);
      refresh();
      if (selected?.id === sf.id) setSelected(null);
      toast({ title: 'Deleted', description: `${sf.name} removed.` });
    }
  };

  const handleExport = (sf: SectionFile) => {
    sectionFilesService.downloadAsFile(sf);
    toast({ title: 'Exported', description: `${sf.name} downloaded as JSON.` });
  };

  const handleImportClick = () => importRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = sectionFilesService.importFromJson(ev.target?.result as string);
        refresh();
        setSelected(imported);
        toast({ title: 'Imported', description: `"${imported.name}" added to your section files.` });
      } catch (err: any) {
        toast({ title: 'Import failed', description: err?.message || 'Invalid file format.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // allow re-importing same file
  };

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: files.length };
    for (const f of files) counts[f.type] = (counts[f.type] || 0) + 1;
    return counts;
  }, [files]);

  return (
    <div className="space-y-4">
      {/* Hidden import input */}
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

      {/* Hero header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <FolderTree className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Section Files</h2>
            <p className="text-sm text-muted-foreground">
              Reusable config pieces — load them into any builder section, save your own from the PDN/UE DB/General tabs.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleImportClick}
          className="flex items-center gap-2 h-9"
        >
          <Upload className="w-3.5 h-3.5" />
          Import JSON
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/30">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="h-8 pl-8 w-52 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1 ml-2">
          {ALL_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-indigo-600 text-white'
                  : 'bg-background text-muted-foreground border hover:bg-muted'
              }`}
            >
              {type === 'all' ? 'All' : TYPE_META[type as SectionType]?.label}
              <span className="ml-1.5 text-[10px] opacity-70">{typeCounts[type] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Two-column: grid + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FolderTree className="w-10 h-10 mx-auto mb-2 opacity-30" />
                No section files match your filter.
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filtered.map(sf => {
              const meta = TYPE_META[sf.type];
              const Icon = meta?.icon || Package;
              const isActive = selected?.id === sf.id;
              return (
                <button
                  key={sf.id}
                  onClick={() => setSelected(sf)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    isActive
                      ? 'border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/50'
                      : 'bg-white hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${meta?.color || 'bg-slate-50 border-slate-200'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm truncate">{sf.name}</div>
                        {sf.builtIn && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                            <Lock className="w-2.5 h-2.5" /> built-in
                          </Badge>
                        )}
                      </div>
                      {sf.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{sf.description}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{meta?.label || sf.type}</Badge>
                        {!sf.builtIn && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(sf.modifiedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview panel */}
        <div>
          <Card className="sticky top-4">
            <CardContent className="pt-4">
              {!selected ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a template to preview its contents.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{selected.name}</div>
                      {selected.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">{selected.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport(selected)}
                        className="h-7 px-2 text-xs gap-1"
                        title="Export as JSON"
                      >
                        <Download className="w-3 h-3" />
                        Export
                      </Button>
                      {!selected.builtIn && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(selected)}
                          className="h-7 px-2 text-red-500 hover:text-red-700 hover:border-red-300"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{TYPE_META[selected.type]?.label}</Badge>
                    {selected.builtIn
                      ? <Badge variant="outline" className="gap-1"><Lock className="w-2.5 h-2.5" /> built-in</Badge>
                      : <Badge variant="outline">user-saved</Badge>
                    }
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">Content</div>
                    <pre className="text-xs bg-slate-950 text-slate-300 p-3 rounded-md overflow-auto max-h-[400px] font-mono leading-relaxed">
                      {JSON.stringify(selected.data, null, 2)}
                    </pre>
                  </div>
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    <p><strong>Tip:</strong> To use this template, open Create Config → pick the {TYPE_META[selected.type]?.label} section → click "{selected.name}" in the section chip bar.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

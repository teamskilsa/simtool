// Modal for loading section-file templates — card grid on left, preview on right.
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Lock, Trash2, Package } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { sectionFilesService, type SectionFile, type SectionType } from '../../../services/sectionFiles.service';

interface LoadSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: SectionType;
  onLoad: (data: any, sourceName: string) => void;
}

export function LoadSectionDialog({ open, onOpenChange, type, onLoad }: LoadSectionDialogProps) {
  const [files, setFiles] = useState<SectionFile[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SectionFile | null>(null);

  const refresh = () => {
    const list = sectionFilesService.list(type);
    setFiles(list);
    if (!selected || list.find(f => f.id === selected.id) === undefined) {
      setSelected(list[0] || null);
    }
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open, type]);

  const filtered = useMemo(() => {
    if (!search) return files;
    const q = search.toLowerCase();
    return files.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q)
    );
  }, [files, search]);

  const builtIn = filtered.filter(f => f.builtIn);
  const userFiles = filtered.filter(f => !f.builtIn);

  const handleUse = () => {
    if (!selected) return;
    onLoad(selected.data, selected.name);
    onOpenChange(false);
    toast({ title: 'Loaded', description: `${selected.name} applied.` });
  };

  const handleDelete = (sf: SectionFile) => {
    if (sf.builtIn) return;
    if (!confirm(`Delete "${sf.name}"?`)) return;
    sectionFilesService.remove(sf.id);
    refresh();
  };

  const renderCard = (sf: SectionFile) => {
    const isActive = selected?.id === sf.id;
    return (
      <button
        key={sf.id}
        onClick={() => setSelected(sf)}
        className={`w-full text-left p-3 rounded-lg border transition-all ${
          isActive
            ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/50'
            : 'bg-white border-gray-200 hover:border-indigo-300'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{sf.name}</div>
            {sf.description && (
              <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{sf.description}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {sf.builtIn ? (
              <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                <Lock className="w-2.5 h-2.5" /> built-in
              </Badge>
            ) : (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleDelete(sf); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDelete(sf); }
                }}
                className="p-1 text-gray-400 hover:text-red-500 rounded cursor-pointer"
                aria-label={`Delete ${sf.name}`}
              >
                <Trash2 className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            Load Section File
            <Badge variant="secondary" className="ml-1">{type.toUpperCase()}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="h-9 pl-8"
            autoFocus
          />
        </div>

        {/* Two-column: list + preview */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 overflow-hidden">
          <div className="md:col-span-2 space-y-3 overflow-y-auto pr-1">
            {builtIn.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase text-gray-500 tracking-wider mb-1.5 px-1">Templates</h4>
                <div className="space-y-2">{builtIn.map(renderCard)}</div>
              </div>
            )}

            {userFiles.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase text-gray-500 tracking-wider mb-1.5 px-1">Your Saved</h4>
                <div className="space-y-2">{userFiles.map(renderCard)}</div>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="text-center text-sm text-gray-500 py-8">No matching section files.</div>
            )}
          </div>

          {/* Preview */}
          <div className="md:col-span-3 flex flex-col min-h-[300px] rounded-lg border bg-slate-950 overflow-hidden">
            {selected ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900">
                  <div className="text-xs font-medium text-slate-200 truncate">{selected.name}</div>
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                    {selected.type}
                  </Badge>
                </div>
                <pre className="flex-1 p-3 text-[11px] font-mono text-slate-300 overflow-auto leading-relaxed">
                  {JSON.stringify(selected.data, null, 2)}
                </pre>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                Select a template to preview.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleUse}
            disabled={!selected}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Use This Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

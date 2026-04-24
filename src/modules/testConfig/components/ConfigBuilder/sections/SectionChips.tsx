// Shared UI for loading / saving section templates inline in a builder section
import { useState, useEffect } from 'react';
import { FolderOpen, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { sectionFilesService, type SectionType, type SectionFile } from '../../../services/sectionFiles.service';

interface SectionChipsProps {
  type: SectionType;
  currentData: any;
  onLoad: (data: any) => void;
}

export function SectionChips({ type, currentData, onLoad }: SectionChipsProps) {
  const [files, setFiles] = useState<SectionFile[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const refresh = () => setFiles(sectionFilesService.list(type));
  useEffect(refresh, [type]);

  const handleLoad = (id: string) => {
    const sf = sectionFilesService.get(id);
    if (sf) {
      onLoad(sf.data);
      toast({ title: 'Loaded', description: `${sf.name} applied.` });
    }
  };

  const handleSave = () => {
    if (!newName.trim()) return;
    sectionFilesService.save({
      name: newName.trim(),
      type,
      description: newDesc.trim() || undefined,
      data: currentData,
    });
    refresh();
    setSaveOpen(false);
    setNewName('');
    setNewDesc('');
    toast({ title: 'Saved', description: `Section file "${newName}" stored.` });
  };

  const builtIns = files.filter(f => f.builtIn);
  const userFiles = files.filter(f => !f.builtIn);

  return (
    <div className="flex items-center gap-2 flex-wrap p-2 rounded-md bg-indigo-50/50 border border-indigo-100">
      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
      <span className="text-xs font-medium text-indigo-900">Section files:</span>

      {/* Built-in templates as chips */}
      {builtIns.map(f => (
        <button
          key={f.id}
          onClick={() => handleLoad(f.id)}
          title={f.description}
          className="text-xs px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          {f.name}
        </button>
      ))}

      {/* User-saved templates as dropdown */}
      {userFiles.length > 0 && (
        <Select onValueChange={handleLoad}>
          <SelectTrigger className="h-6 text-xs w-32 bg-white">
            <FolderOpen className="w-3 h-3 mr-1" />
            <SelectValue placeholder="My templates" />
          </SelectTrigger>
          <SelectContent>
            {userFiles.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex-1" />

      {/* Save as template */}
      <Button size="sm" variant="outline" className="h-6 text-xs bg-white" onClick={() => setSaveOpen(true)}>
        <Save className="w-3 h-3 mr-1" /> Save as section
      </Button>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Save as Section File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Name</label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="my-custom-pdn"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Description (optional)</label>
              <Input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="What's special about this section"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{type.toUpperCase()}</Badge>
              <span className="text-xs text-muted-foreground">
                Saved to browser storage (localStorage)
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!newName.trim()}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

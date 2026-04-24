// Full-featured toolbar on every section: Load / Save / Download / Import
// Replaces the older SectionChips — this makes templates a first-class feature.
import { useRef, useState } from 'react';
import { FolderOpen, Save, Download, Upload, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { sectionFilesService, type SectionType, type SectionFile } from '../../../services/sectionFiles.service';
import { LoadSectionDialog } from './LoadSectionDialog';
import { SaveSectionDialog } from './SaveSectionDialog';

const TYPE_LABELS: Record<SectionType, string> = {
  pdn: 'PDN', uedb: 'UE DB', general: 'General',
  cell: 'Cell', band: 'Band', rf: 'RF', log: 'Log',
};

interface SectionToolbarProps {
  type: SectionType;
  currentData: any;
  onLoad: (data: any, sourceName: string) => void;
  /** Optional: last-used template name, shown as a hint */
  loadedFromName?: string;
}

export function SectionToolbar({ type, currentData, onLoad, loadedFromName }: SectionToolbarProps) {
  const [loadOpen, setLoadOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = () => {
    const tempFile: SectionFile = {
      id: 'tmp', name: `current-${type}`, type,
      data: currentData, builtIn: false,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    sectionFilesService.downloadAsFile(tempFile);
    toast({ title: 'Downloaded', description: `${type}-current-${type}.json` });
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const sf = sectionFilesService.importFromJson(text);
      if (sf.type !== type) {
        toast({
          title: 'Wrong section type',
          description: `Imported "${sf.name}" is ${sf.type}, but this section expects ${type}.`,
          variant: 'destructive',
        });
        sectionFilesService.remove(sf.id);
        return;
      }
      onLoad(sf.data, sf.name);
      toast({ title: 'Imported', description: `${sf.name} loaded into the form.` });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err?.message || 'Invalid JSON', variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 rounded-lg border border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-white">
      <div className="flex items-center gap-1.5 pr-2 border-r border-indigo-200">
        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
        <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">{TYPE_LABELS[type]}</span>
      </div>

      {loadedFromName && (
        <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700 bg-white">
          from: {loadedFromName}
        </Badge>
      )}

      <div className="flex-1" />

      <Button size="sm" variant="outline" className="h-7 text-xs bg-white hover:bg-indigo-50" onClick={() => setLoadOpen(true)}>
        <FolderOpen className="w-3 h-3 mr-1" /> Load
      </Button>

      <Button size="sm" variant="outline" className="h-7 text-xs bg-white hover:bg-indigo-50" onClick={() => setSaveOpen(true)}>
        <Save className="w-3 h-3 mr-1" /> Save as Template
      </Button>

      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleDownload} title="Download as .json file">
        <Download className="w-3 h-3" />
      </Button>

      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleUploadClick} title="Import .json file">
        <Upload className="w-3 h-3" />
      </Button>
      <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />

      {/* Dialogs */}
      <LoadSectionDialog open={loadOpen} onOpenChange={setLoadOpen} type={type} onLoad={onLoad} />
      <SaveSectionDialog open={saveOpen} onOpenChange={setSaveOpen} type={type} data={currentData} />
    </div>
  );
}

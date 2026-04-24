import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { sectionFilesService, type SectionType } from '../../../services/sectionFiles.service';

interface SaveSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: SectionType;
  data: any;
  onSaved?: () => void;
}

export function SaveSectionDialog({ open, onOpenChange, type, data, onSaved }: SaveSectionDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
    }
  }, [open]);

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    const sf = sectionFilesService.save({
      name: name.trim(),
      type,
      description: description.trim() || undefined,
      data,
    });
    toast({ title: 'Saved', description: `Section file "${sf.name}" stored.` });
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-4 h-4 text-indigo-600" />
            Save as Section File
            <Badge variant="secondary">{type.toUpperCase()}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`my-${type}-config`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Description <span className="text-gray-400">(optional)</span></Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's notable about this configuration"
            />
          </div>

          <div className="rounded-md bg-indigo-50 border border-indigo-100 p-2.5 text-xs text-indigo-800">
            Saved to browser storage. Available everywhere the {type.toUpperCase()} section appears.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim()}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

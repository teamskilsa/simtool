// modules/ueSim/components/header/SectionHeaderStrip.tsx
//
// The bar that sits on top of every tab body. It gives the user:
//   • a dropdown to swap in a different section file of this type
//   • Save (in place – disabled for built-ins, in which case Save As)
//   • Save As (new file with chosen name)
//   • Reset (revert in-memory edits to last-saved data — handled by parent)
//   • Delete (only visible for user-saved files)

'use client';

import { useState } from 'react';
import { Save, Copy, RotateCcw, Trash2, FileText } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { UeSimSectionFile } from '../../types';

interface Props {
  label: string;
  sections: UeSimSectionFile[];
  activeId: string | undefined;
  isDirty: boolean;
  onSelect: (id: string) => void;
  onSave: () => void;        // overwrite (only for non-builtin)
  onSaveAs: (name: string, description?: string) => void;
  onReset: () => void;
  onDelete: () => void;       // only enabled for non-builtin
}

export function SectionHeaderStrip({
  label, sections, activeId, isDirty,
  onSelect, onSave, onSaveAs, onReset, onDelete,
}: Props) {
  const active = sections.find(s => s.id === activeId);
  const isBuiltIn = !!active?.builtIn;

  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [saveAsDesc, setSaveAsDesc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openSaveAs = () => {
    setSaveAsName(active ? `${active.name} (copy)` : `New ${label}`);
    setSaveAsDesc('');
    setSaveAsOpen(true);
  };

  const submitSaveAs = () => {
    const n = saveAsName.trim();
    if (!n) return;
    onSaveAs(n, saveAsDesc.trim() || undefined);
    setSaveAsOpen(false);
  };

  return (
    <>
      <div className="flex items-center flex-wrap gap-2 border border-border/70 rounded-xl px-3 py-2 bg-muted/30">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>

        <div className="w-44 lg:w-64">
          <Select value={activeId} onValueChange={onSelect}>
            <SelectTrigger className="h-8 [&>span]:truncate [&>span]:text-left">
              <SelectValue placeholder="Select section…" />
            </SelectTrigger>
            <SelectContent>
              {sections.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span>{s.name}</span>
                    {s.builtIn && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1">built-in</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isDirty && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            unsaved
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onSave}
            disabled={isBuiltIn || !isDirty}
            title={isBuiltIn ? 'Built-in sections cannot be overwritten — use Save As' : 'Save changes'}
          >
            <Save className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={openSaveAs}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Save As
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset} disabled={!isDirty}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={isBuiltIn || !active}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* Save-As dialog */}
      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save {label} As</DialogTitle>
            <DialogDescription>
              Creates a new section file. The current edits will be saved
              under the name below and the active profile will switch to it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="saveas-name">Name</Label>
              <Input
                id="saveas-name"
                value={saveAsName}
                onChange={e => setSaveAsName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="saveas-desc">Description (optional)</Label>
              <Input
                id="saveas-desc"
                value={saveAsDesc}
                onChange={e => setSaveAsDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveAsOpen(false)}>Cancel</Button>
            <Button onClick={submitSaveAs} disabled={!saveAsName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this section file?</AlertDialogTitle>
            <AlertDialogDescription>
              {active ? `"${active.name}" will be permanently removed.` : ''}{' '}
              The active profile will fall back to the {label.toLowerCase()} default.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmDelete(false); onDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

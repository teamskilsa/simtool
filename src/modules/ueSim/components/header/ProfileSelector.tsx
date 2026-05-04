// modules/ueSim/components/header/ProfileSelector.tsx
//
// Top-level bar above the tabs. Owns: profile dropdown, "New profile",
// "Load ue.cfg" (opens the loader dialog), "Export ue.cfg" (downloads
// the materialised profile as text), and "Apply" (preview + commit
// changes against a connected target).

'use client';

import { useState } from 'react';
import { Plus, Upload, Download, FolderOpen, Trash2, Send } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { MaterializedProfile, UeProfile } from '../../types';
import { emitUeCfg } from '../../services/cfgEmitter';

interface Props {
  profiles: UeProfile[];
  activeId: string | undefined;
  materialized: MaterializedProfile | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDuplicate: (name: string) => void;
  onDelete: () => void;
  onOpenLoader: () => void;
  onApply: () => void;
}

export function ProfileSelector({
  profiles, activeId, materialized,
  onSelect, onCreate, onDuplicate, onDelete, onOpenLoader, onApply,
}: Props) {
  const active = profiles.find(p => p.id === activeId);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [dupOpen, setDupOpen] = useState(false);
  const [dupName, setDupName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openNew = () => {
    setNewName('New Profile');
    setNewOpen(true);
  };

  const submitNew = () => {
    const n = newName.trim();
    if (!n) return;
    onCreate(n);
    setNewOpen(false);
  };

  const openDuplicate = () => {
    setDupName(active ? `${active.name} (copy)` : 'Profile (copy)');
    setDupOpen(true);
  };

  const submitDuplicate = () => {
    const n = dupName.trim();
    if (!n) return;
    onDuplicate(n);
    setDupOpen(false);
  };

  const exportCfg = () => {
    if (!materialized) return;
    const header = active
      ? `Exported by simtool — profile "${active.name}"`
      : 'Exported by simtool';
    const text = emitUeCfg(materialized, { header });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(active?.name ?? 'profile').replace(/[^A-Za-z0-9_.-]+/g, '_')}.cfg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Profile</span>
        <div className="w-64">
          <Select value={activeId} onValueChange={onSelect}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select profile…" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="ghost" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New
        </Button>
        <Button size="sm" variant="ghost" onClick={openDuplicate} disabled={!active}>
          Duplicate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
          disabled={!active}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={onOpenLoader}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Load ue.cfg
          </Button>
          <Button size="sm" variant="outline" onClick={exportCfg} disabled={!materialized}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export ue.cfg
          </Button>
          <Button size="sm" onClick={onApply} disabled={!materialized}>
            <Send className="h-3.5 w-3.5 mr-1" /> Apply
          </Button>
        </div>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Profile</DialogTitle>
            <DialogDescription>
              Creates an empty profile that uses the default built-in
              section files for every tab. You can swap them per-tab afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="newprof-name">Name</Label>
            <Input
              id="newprof-name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={submitNew} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Profile</DialogTitle>
            <DialogDescription>
              Creates a new profile pointing at the same section files. The
              copy is independent — swapping a section in it won't affect
              the original.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="dup-name">Name</Label>
            <Input
              id="dup-name"
              value={dupName}
              onChange={e => setDupName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDupOpen(false)}>Cancel</Button>
            <Button onClick={submitDuplicate} disabled={!dupName.trim()}>Duplicate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this profile?</AlertDialogTitle>
            <AlertDialogDescription>
              {active
                ? `"${active.name}" will be removed. The section files remain — you can rebuild a new profile from them.`
                : ''}
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

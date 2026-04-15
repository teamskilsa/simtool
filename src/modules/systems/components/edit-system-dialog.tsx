// modules/systems/components/edit-system-dialog.tsx
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import type { System } from '../types';

interface EditSystemDialogProps {
  system: System | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (systemId: number, updates: Partial<System>) => Promise<void>;
}

export function EditSystemDialog({ 
  system, 
  open, 
  onOpenChange, 
  onSubmit 
}: EditSystemDialogProps) {
  const [formData, setFormData] = useState({
    type: '',
    name: '',
    ip: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (system) {
      setFormData({
        type: system.type,
        name: system.name,
        ip: system.ip
      });
    }
  }, [system]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!system) return;
    
    try {
      setLoading(true);
      await onSubmit(system.id, formData);
      toast({
        title: "Success",
        description: "System has been updated successfully.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update system',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!system) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit System</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>System Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select system type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Callbox">Callbox</SelectItem>
                  <SelectItem value="UESim">UE Simulator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>System Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter system name"
              />
            </div>

            <div className="space-y-2">
              <Label>IP Address</Label>
              <Input
                value={formData.ip}
                onChange={(e) => setFormData(prev => ({ ...prev, ip: e.target.value }))}
                placeholder="192.168.1.100"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

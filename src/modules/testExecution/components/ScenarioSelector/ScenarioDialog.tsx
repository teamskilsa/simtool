// components/ScenarioSelector/ScenarioDialog.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ScenarioCreator } from '../ScenarioCreator';

interface ScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any; // The scenario data when editing
  onSave: (data: any) => Promise<void>;
  mode: 'create' | 'edit';
}

export function ScenarioDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
  mode
}: ScenarioDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (data: any) => {
    try {
      setIsSubmitting(true);
      await onSave(data);
      onOpenChange(false);
      toast({
        title: "Success",
        description: `Scenario ${mode === 'create' ? 'created' : 'updated'} successfully`,
      });
    } catch (error) {
      console.error(`Error ${mode}ing scenario:`, error);
      toast({
        title: "Error",
        description: `Failed to ${mode} scenario`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto backdrop-blur-sm bg-background/80 border-muted/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {mode === 'create' ? 'Create New Scenario' : 'Edit Scenario'}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <ScenarioCreator
            initialData={initialData}
            isEditing={mode === 'edit'}
            onSave={handleSave}
            isSaving={isSubmitting}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
// components/ScenarioCreator/CreateScenarioDialog.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ScenarioCreator } from './ScenarioCreator';
import { ScenarioConfig } from './types';
import { Boxes } from "lucide-react";

interface CreateScenarioDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: ScenarioConfig;
  onOpenChange: (open: boolean) => void;
  onSave: (scenario: ScenarioConfig) => Promise<void>;
  onSuccess?: () => void;
}

export function CreateScenarioDialog({
  open,
  mode,
  initialData,
  onOpenChange,
  onSave,
  onSuccess
}: CreateScenarioDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (data: ScenarioConfig) => {
    try {
      setIsSubmitting(true);
      await onSave(data);
      
      toast({
        title: "Success",
        description: `Scenario ${mode === 'create' ? 'created' : 'updated'} successfully`,
      });
      
      onOpenChange(false);
      onSuccess?.();
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="border-b border-border/60 px-6 py-4 space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Boxes className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground">
                {mode === 'create' ? 'Create New Scenario' : 'Edit Scenario'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {mode === 'create'
                  ? 'Pick a topology, then a config for each module.'
                  : 'Modify the existing scenario configuration.'
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body scrolls; the header stays put so the dialog never grows
            taller than the viewport on a 4-module topology. */}
        <div className="overflow-y-auto px-6 py-5">
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
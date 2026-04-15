// components/ScenarioCreator/CreateScenarioDialog.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ScenarioCreator } from './ScenarioCreator';
import { ScenarioConfig } from './types';
import { cn } from "@/lib/utils";
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
      <DialogContent className={cn(
        "max-w-4xl max-h-[90vh] overflow-y-auto",
        "bg-background/80 backdrop-blur-sm",
        "border border-muted/30",
        "shadow-lg"
      )}>
        <DialogHeader className="border-b border-muted/20 pb-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg",
              "bg-gradient-to-br from-blue-500/20 to-indigo-500/20"
            )}>
              <Boxes className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-br from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                {mode === 'create' ? 'Create New Scenario' : 'Edit Scenario'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1">
                {mode === 'create' 
                  ? 'Configure a new test scenario with your desired settings'
                  : 'Modify the existing scenario configuration'
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className={cn(
          "mt-6 p-6 rounded-lg",
          "bg-gradient-to-br from-background/60 to-muted/30",
          "border border-muted/20"
        )}>
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
// components/ScenarioSelector/ScenarioActions.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  MoreVertical,
  Copy, 
  Trash2,
  FileText,
  Pencil,
  Play,
  StopCircle
} from 'lucide-react';
import { ScenarioCreator } from '../ScenarioCreator';

interface ScenarioActionsProps {
  scenario: {
    id: string;
    name: string;
    topology: string;
    moduleConfigs: Array<{
      moduleId: string;
      configId: string;
      enabled: boolean;
      ipAddress?: string;
    }>;
    ipConfig: {
      common?: string;
      [key: string]: string | undefined;
    };
    system?: {
      id: string;
      name: string;
      host: string;
      port: string;
    };
  };
  isRunning: boolean;
  onRun: () => Promise<void>;
  onRefreshList?: () => void;
  onViewLogs: () => void;
}

export function ScenarioActions({ 
  scenario,
  isRunning,
  onRun,
  onRefreshList,
  onViewLogs
}: ScenarioActionsProps) {
  const { toast } = useToast();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditSave = async (updatedData: any) => {
    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/scenarios`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...updatedData,
          id: scenario.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update scenario');
      }

      toast({
        title: "Success",
        description: "Scenario updated successfully"
      });

      setShowEditDialog(false);
      onRefreshList?.();
    } catch (error) {
      console.error('[ScenarioActions] Update failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update scenario",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/scenarios`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: scenario.id })
      });

      if (!response.ok) {
        throw new Error('Failed to delete scenario');
      }

      toast({
        title: "Success",
        description: "Scenario deleted successfully"
      });

      setShowDeleteDialog(false);
      onRefreshList?.();
    } catch (error) {
      console.error('[ScenarioActions] Deletion failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete scenario",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      setIsSubmitting(true);
      const response = await fetch('/api/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...scenario,
          name: `${scenario.name}_copy`,
          id: undefined,
          createdAt: undefined,
          lastRun: undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate scenario');
      }

      toast({
        title: "Success",
        description: "Scenario duplicated successfully"
      });

      onRefreshList?.();
    } catch (error) {
      console.error('[ScenarioActions] Duplication failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to duplicate scenario",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isRunning ? "destructive" : "default"}
          onClick={onRun}
          disabled={isRunning}
          className="w-[72px]"
        >
          {isRunning ? (
            <>
              <StopCircle className="w-4 h-4 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run
            </>
          )}
        </Button>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={onViewLogs}
          className="w-[36px] p-0"
          title="View Logs"
        >
          <FileText className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className="w-[36px] p-0"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Scenario</DialogTitle>
          </DialogHeader>
          <ScenarioCreator
            initialData={scenario}
            isEditing={true}
            onSave={handleEditSave}
            isSaving={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the scenario
              "{scenario.name}" and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
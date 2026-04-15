'use client';

import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ConfigItem } from '../../types';
import { ImportForm } from './ImportForm';
import { useAuth } from '@/modules/auth/context/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (configs: ConfigItem[]) => Promise<void>;  // Now accepts array of configs
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const { user } = useAuth();
    const { toast } = useToast();

    const handleImport = async (configs: ConfigItem[]) => {
        if (!user?.id) {
            toast({
                title: "Authentication Required",
                description: "Please log in to import configurations",
                variant: "destructive"
            });
            return;
        }

        try {
            // Import each config in the array
            for (const config of configs) {
                await onImport(config);
            }
            onClose();
            
            toast({
                title: "Success",
                description: `Successfully imported ${configs.length} configuration${configs.length !== 1 ? 's' : ''}`,
            });
        } catch (error) {
            console.error('Import failed:', error);
            toast({
                title: "Import Failed",
                description: error instanceof Error ? error.message : 'Failed to import configuration',
                variant: "destructive"
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
                {/* Add DialogTitle but make it visually hidden since we have a visual title in ImportForm */}
                <VisuallyHidden asChild>
                    <DialogTitle>Import Configuration</DialogTitle>
                </VisuallyHidden>
                <TooltipProvider>
                    <ImportForm onImport={handleImport} onCancel={onClose} />
                </TooltipProvider>
            </DialogContent>
        </Dialog>
    );
};
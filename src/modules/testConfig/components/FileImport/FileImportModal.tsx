// src/modules/testConfig/components/FileImport/FileImportModal.tsx
'use client'

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/file-upload';
import { Spinner } from '@/components/ui/spinner';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { cn } from '@/lib/utils';

interface FileImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: File[]) => Promise<void>;
}

export function FileImportModal({ isOpen, onClose, onImport }: FileImportModalProps) {
  const { theme: themeVariant } = useTheme();
  const theme = themes[themeVariant];
  const [isImporting, setIsImporting] = React.useState(false);

  const handleFileDrop = async (files: File[]) => {
    try {
      setIsImporting(true);
      await onImport(files);
      onClose();
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        theme.effects.glass.medium,
        theme.surfaces.modal.background,
        theme.surfaces.modal.border
      )}>
        <DialogHeader>
          <DialogTitle className={theme.surfaces.modal.foreground}>
            Import Configuration Files
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          {isImporting ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Spinner size="lg" />
              <p className={theme.surfaces.modal.foreground}>
                Importing files...
              </p>
            </div>
          ) : (
            <FileUpload
              onDrop={handleFileDrop}
              accept={{
                'text/plain': ['.cfg', '.conf', '.json']
              }}
              maxFiles={5}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
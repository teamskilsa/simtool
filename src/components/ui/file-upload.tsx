// src/components/ui/file-upload.tsx
'use client'

import React from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { UploadCloud } from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';

interface FileUploadProps {
  onDrop: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  className?: string;
  children?: React.ReactNode;
}

export const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(({
  onDrop,
  accept,
  maxFiles = 1,
  className,
  children
}, ref) => {
  const { theme: themeVariant } = useTheme();
  const theme = themes[themeVariant];
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles
  });

  return (
    <div
      {...getRootProps()}
      ref={ref}
      className={cn(
        "rounded-lg p-6 text-center cursor-pointer",
        theme.effects.transition.default,
        theme.surfaces.card.background,
        theme.surfaces.card.border,
        theme.effects.glass.light,
        isDragActive && [
          theme.surfaces.card.hover,
          "ring-2",
          `ring-${theme.colors.primary[500]}`
        ],
        "hover:scale-[1.01]",
        className
      )}
    >
      <input {...getInputProps()} />
      {children || (
        <>
          <UploadCloud className={cn(
            "mx-auto h-12 w-12",
            `text-${theme.colors.primary[500]}`
          )} />
          <div className={cn(
            "mt-2",
            theme.components.button.base,
            "font-medium"
          )}>
            Drag & drop files here, or click to select
          </div>
          <p className={cn(
            "text-sm mt-1",
            theme.surfaces.card.foreground,
            "opacity-70"
          )}>
            Supported files: .cfg, .conf, .json
          </p>
        </>
      )}
    </div>
  );
});

FileUpload.displayName = 'FileUpload';
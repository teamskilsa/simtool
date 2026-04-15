// src/modules/testConfig/views/ConfigurationView/ConfigurationHeader.tsx
'use client'

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Plus, FileJson, Upload, FolderPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ButtonSeparator } from '@/components/ui/button-separator';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';

interface ConfigurationHeaderProps {
  onImport: () => void;
  onCreateNew: () => void;
  onFileImport: () => void;
  onManageGroups: () => void;  // Add this
}

export const ConfigurationHeader: React.FC<ConfigurationHeaderProps> = ({
  onImport,
  onCreateNew,
  onFileImport,
  onManageGroups
}) => {
  const { theme: themeVariant } = useTheme();
  const theme = themes[themeVariant];

  return (
    <div className="mb-6 space-y-4">
      {/* Header Title Section */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          `bg-${theme.colors.primary[500]}/10`,
          `border border-${theme.colors.primary[500]}/20`
        )}>
          <FileJson className={cn(
            "w-6 h-6",
            `text-${theme.colors.primary[500]}`
          )} />
        </div>
        <div>
          <h2 className={cn(
            "text-2xl font-bold",
            "bg-clip-text text-transparent",
            theme.gradients.primary
          )}>
            Test Configurations
          </h2>
          <p className={cn(
            "text-sm",
            theme.surfaces.page.foreground
          )}>
            Manage and edit your test configuration files
          </p>
        </div>
      </div>
  
      {/* Actions Card */}
      <Card className={cn(
        "p-4",
        theme.effects.glass.light,
        theme.surfaces.card.background,
        theme.surfaces.card.border,
        "shadow-[0_0_15px_rgba(59,130,246,0.1)]"
      )}>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="default"
            onClick={onImport}
            className={cn(
              theme.effects.transition.default,
              theme.components.button.variants.outline,
              "hover:scale-105"
            )}
          >
            <Download className={cn(
              "w-4 h-4 mr-2",
              `text-${theme.colors.primary[500]}`
            )} />
            Import from Server
          </Button>
  
          <ButtonSeparator />
  
          <Button
            variant="outline"
            size="default"
            onClick={onFileImport}
            className={cn(
              theme.effects.transition.default,
              theme.components.button.variants.outline,
              "hover:scale-105"
            )}
          >
            <Upload className={cn(
              "w-4 h-4 mr-2",
              `text-${theme.colors.primary[500]}`
            )} />
            Import File
          </Button>
  
          <ButtonSeparator />
  
          <Button
            size="default"
            onClick={onCreateNew}
            className={cn(
              theme.effects.transition.default,
              theme.components.button.variants.default,
              "hover:scale-105"
            )}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New
          </Button>
  
          <ButtonSeparator />
  
          <Button
            variant="outline"
            size="default"
            onClick={onManageGroups}
            className={cn(
              theme.effects.transition.default,
              theme.components.button.variants.outline,
              "hover:scale-105"
            )}
          >
            <FolderPlus className={cn(
              "w-4 h-4 mr-2",
              `text-${theme.colors.primary[500]}`
            )} />
            Manage Groups
          </Button>
        </div>
      </Card>
    </div>
  );
};
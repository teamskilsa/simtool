// src/modules/testConfig/views/ConfigurationView/ConfigurationHeader.tsx
'use client'

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Plus, FileJson, Upload, FolderPlus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

interface ConfigurationHeaderProps {
  onImport: () => void;
  onCreateNew: () => void;
  onFileImport: () => void;
  onManageGroups: () => void;
}

export const ConfigurationHeader: React.FC<ConfigurationHeaderProps> = ({
  onImport,
  onCreateNew,
  onFileImport,
  onManageGroups
}) => (
  // Was: a 40px icon tile + gradient title + subtitle line, then four
  // default-size buttons in a bordered glass Card with separators between
  // them. The gradient title also rendered as near-white on white, so the
  // page's own name was the least legible text on it.
  <PageHeader
    icon={<FileJson />}
    title="Test Configurations"
    subtitle="Manage and edit your test configuration files"
    actions={
      <>
        <Button variant="outline" size="sm" onClick={onImport}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Import from Server
        </Button>

        <Button variant="outline" size="sm" onClick={onFileImport}>
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          Import File
        </Button>

        <Button variant="outline" size="sm" onClick={onManageGroups}>
          <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
          Manage Groups
        </Button>

        <Button size="sm" onClick={onCreateNew}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Create New
        </Button>
      </>
    }
  />
);

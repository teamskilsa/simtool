// src/modules/testConfig/components/SectionFiles/SectionViewer.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Editor } from '../ConfigEditor/Editor';
import { Button } from '@/components/ui/button';
import { Save, Download } from 'lucide-react';

interface SectionViewerProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  onDownload?: () => void;
  readOnly?: boolean;
}

export const SectionViewer: React.FC<SectionViewerProps> = ({
  content,
  onChange,
  onSave,
  onDownload,
  readOnly = false
}) => {
  return (
    <Card className="p-4 space-y-4">
      <div className="flex justify-end space-x-2">
        {!readOnly && onSave && (
          <Button onClick={onSave} size="sm">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        )}
        {onDownload && (
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        )}
      </div>
      <Editor
        content={content}
        onChange={onChange}
        readOnly={readOnly}
      />
    </Card>
  );
};

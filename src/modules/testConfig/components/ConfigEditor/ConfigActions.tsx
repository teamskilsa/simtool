// src/modules/testConfig/components/ConfigEditor/ConfigActions.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Save, Delete } from 'lucide-react';

interface ConfigActionsProps {
  onSave?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export const ConfigActions: React.FC<ConfigActionsProps> = ({
  onSave,
  onDuplicate,
  onDelete
}) => {
  return (
    <div className="flex items-center gap-2">
      {onSave && (
        <Button onClick={onSave} size="sm">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      )}
      {onDuplicate && (
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </Button>
      )}
      {onDelete && (
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Delete className="w-4 h-4 mr-2" />
          Delete
        </Button>
      )}
    </div>
  );
};
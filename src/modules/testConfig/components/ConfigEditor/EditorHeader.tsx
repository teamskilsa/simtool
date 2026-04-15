// src/modules/testConfig/components/ConfigEditor/EditorHeader.tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EditorHeaderProps {
  fileName: string;
  groupName?: string;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  fileName,
  groupName = 'enb'
}) => {
  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-3",
      "bg-blue-50/30 dark:bg-blue-950/10",
      "backdrop-blur-sm",
      "border-b border-blue-100/50 dark:border-blue-900/50"
    )}>
      <span className="text-lg font-medium">{fileName}</span>
      <Badge variant="secondary" className={cn(
        "bg-blue-100/50 dark:bg-blue-900/30",
        "text-blue-700 dark:text-blue-300",
        "hover:bg-blue-100 dark:hover:bg-blue-900/50"
      )}>
        {groupName}
      </Badge>
    </div>
  );
};
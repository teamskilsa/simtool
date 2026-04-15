// src/modules/testConfig/components/ConfigEditor/Editor.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export const Editor: React.FC<EditorProps> = ({
  content,
  onChange,
  readOnly = false
}) => {
  return (
    <div className="w-full">
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={cn(
          "w-full p-6 font-mono text-sm",
          "bg-transparent outline-none",
          "min-h-[calc(100vh-300px)]",
          "resize-none",
          readOnly && "cursor-default"
        )}
        style={{ 
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        }}
        spellCheck={false}
      />
    </div>
  );
};
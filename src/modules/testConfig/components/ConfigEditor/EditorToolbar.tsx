// src/modules/testConfig/components/ConfigEditor/EditorToolbar.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  FileJson,
  Search,
  Undo,
  Redo,
  WrapText,
  Type,
  IndentIcon,
  AlignJustify,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  lineCount: number;
  onFormat: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onWrapToggle: () => void;
  onIndent: () => void;
  onSearch: () => void;
  onFontSizeIncrease: () => void;
  canUndo: boolean;
  canRedo: boolean;
  readOnly?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  lineCount,
  onFormat,
  onUndo,
  onRedo,
  onWrapToggle,
  onIndent,
  onSearch,
  onFontSizeIncrease,
  canUndo,
  canRedo,
  readOnly = false
}) => {
  return (
    <div className={cn(
      "border-b",
      "bg-blue-50/20 dark:bg-blue-950/10",
      "backdrop-blur-sm",
      "border-blue-100/50 dark:border-blue-900/50"
    )}>
      <div className="flex items-center justify-between p-2">
        <TooltipProvider>
          <div className="flex items-center space-x-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFormat}
                  disabled={readOnly}
                  className="hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
                >
                  <FileJson className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Format JSON</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="mx-2 h-6" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUndo}
                  disabled={!canUndo || readOnly}
                  className="hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
                >
                  <Undo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRedo}
                  disabled={!canRedo || readOnly}
                  className="hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
                >
                  <Redo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="mx-2 h-6" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onWrapToggle}
                  className="hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
                >
                  <WrapText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle Word Wrap</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onIndent}
                  disabled={readOnly}
                  className="hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
                >
                  <IndentIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Indent Code</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSearch}
                  className="hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Find</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFontSizeIncrease}
                  className="hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
                >
                  <Type className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Increase Font Size</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <div className="flex items-center text-sm text-muted-foreground">
          <Layers className="h-4 w-4 mr-2" />
          {lineCount} lines
        </div>
      </div>
    </div>
  );
};
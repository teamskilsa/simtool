// src/modules/testConfig/views/ConfigurationView/ConfigurationEditor.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight,
  Save,
  Copy,
  Download,
  Maximize2,
  Minimize2,
  Check,
  FileJson,
  Pencil
} from 'lucide-react';
import { extractBuilderMeta, tryParseAmarisoftConfig, detectConfigType } from '../../components/ConfigBuilder';
import { ConfigItem } from '../../types';
import { Editor } from '../../components/ConfigEditor/Editor';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ConfigurationEditorProps {
  config: ConfigItem | null;
  onChange: (config: ConfigItem) => void;
  onCollapse?: () => void;
  isCollapsed?: boolean;
}

export const ConfigurationEditor: React.FC<ConfigurationEditorProps> = ({
  config,
  onChange,
  onCollapse,
  isCollapsed = false
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editedContent, setEditedContent] = useState(config?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  // Update edited content when config changes
  useEffect(() => {
    setEditedContent(config?.content || '');
  }, [config]);

  // The "Edit in Builder" button is enabled if EITHER the config carries
  // @builder metadata (perfect round-trip) or the .cfg parser can detect the
  // config type (best-effort import for files created outside SimTool).
  const builderMode = useMemo<{ available: boolean; viaParser: boolean }>(() => {
    if (!config?.content) return { available: false, viaParser: false };
    if (extractBuilderMeta(config.content)) return { available: true, viaParser: false };
    const ast = tryParseAmarisoftConfig(config.content);
    const t = detectConfigType(ast, config.name);
    return { available: t !== 'unknown', viaParser: true };
  }, [config?.content, config?.name]);

  const handleSave = async () => {
    if (!config) return;
    
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...config,
        content: editedContent,
        modifiedAt: new Date()
      };
      await onChange(updatedConfig);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (editedContent) {
      await navigator.clipboard.writeText(editedContent);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!config || !editedContent) return;
    
    const blob = new Blob([editedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isCollapsed) {
    return (
      <div className="w-12 flex flex-col items-center py-4 border-l">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCollapse}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-white dark:bg-gray-900",
        isFullscreen ? "fixed inset-0 z-50" : "flex-1 rounded-lg border"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {config ? (
            <>
              <h3 className="font-medium">{config.name}</h3>
              <Badge variant="secondary">
                {config.module}
              </Badge>
              {config.group && (
                <Badge variant="outline">
                  {config.group}
                </Badge>
              )}
            </>
          ) : (
            <h3 className="font-medium text-muted-foreground">
              No configuration selected
            </h3>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Edit in Builder — works for both natively-created (@builder meta)
              and imported configs (via the .cfg parser fallback). */}
          {config && builderMode.available && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    sessionStorage.setItem('simtool_load_config_id', config.id);
                    window.dispatchEvent(new CustomEvent('simtool:navigate', {
                      detail: { section: 'create-test' },
                    }));
                  }}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 border-0"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Edit in Builder
                  {builderMode.viaParser && (
                    <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0 h-4 bg-white/20 border-white/40 text-white">
                      parsed
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {builderMode.viaParser
                  ? 'Best-effort parse from raw .cfg — review fields and re-save'
                  : 'Open this config in the visual block-based builder'}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!config}
              >
                {justCopied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {justCopied ? 'Copied!' : 'Copy content'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={!config}
              >
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Download
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-4">
        {config ? (
          <div className="space-y-4">
            <Editor
              content={editedContent}
              onChange={setEditedContent}
              readOnly={false}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={isSaving || editedContent === config.content}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <FileJson className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">Select a configuration to edit</p>
            <p className="text-sm mt-1">
              Import from server or create a new one
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
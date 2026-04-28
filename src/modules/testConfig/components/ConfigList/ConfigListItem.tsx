import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, Trash2, MoreVertical, FolderPlus, Pencil } from 'lucide-react';
import { ConfigItem } from '../../types';
import { cn } from '@/lib/utils';
import { RAT_BADGE, AUX_BADGE, type ConfigClassification } from './classifyConfig';

interface ConfigListItemProps {
  config: ConfigItem;
  classification?: ConfigClassification;
  isSelected: boolean;
  isActiveConfig: boolean;
  onSelect: (checked: boolean) => void;
  onConfigSelect: () => void;
  onDuplicate: () => Promise<void>;
  onDelete: () => void;
  onRename: () => void;
  onAddToGroup: () => void;
}

export const ConfigListItem: React.FC<ConfigListItemProps> = ({
  config,
  classification,
  isSelected,
  isActiveConfig,
  onSelect,
  onConfigSelect,
  onDuplicate,
  onDelete,
  onRename,
  onAddToGroup
}) => {
  // Pick the type badge — RAT for main configs, AUX kind for dependencies
  const typeBadge = (() => {
    if (!classification) return null;
    if (classification.kind === 'main' && classification.rat) {
      return RAT_BADGE[classification.rat];
    }
    if (classification.kind === 'auxiliary' && classification.auxKind) {
      return AUX_BADGE[classification.auxKind];
    }
    return null;
  })();
  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg border cursor-pointer",
        "transition-all duration-200",
        isActiveConfig
          ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent",
      )}
      onClick={onConfigSelect}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onSelect}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{config.name}</span>
            {config.group && (
              <Badge variant="secondary" className="text-xs">
                {config.group}
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRename}>
                <Pencil className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddToGroup}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Add to Group
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate">
            Modified: {new Date(config.modifiedAt).toLocaleString()}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {typeBadge && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', typeBadge.color)}>
                {typeBadge.label}
              </span>
            )}
            <Badge variant="outline" className="text-xs">
              {config.module}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};
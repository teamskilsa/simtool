import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/modules/auth/context/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { useConfigContext } from '../../context/ConfigContext';
import { ConfigListItem } from './ConfigListItem';
import { AssignToGroupDialog } from '../GroupManagement/AssignToGroupDialog';
import { groupService } from '../../services/groups.service';
import { ChevronLeft, Copy, Trash2, Filter } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfigItem } from '../../types';
import { cn } from '@/lib/utils';
import { 
  handleSingleDuplicate, 
  handleRename, 
  handleBulkDuplicate, 
  handleBulkDelete 
} from '../../actions/configListActions';

interface ConfigurationListProps {
  configs: ConfigItem[];
  selectedConfig: ConfigItem | null;
  onConfigSelect: (config: ConfigItem) => void;
  onConfigsChange: (configs: ConfigItem[]) => void;
  onDelete: (configId: string) => void;
  loading?: boolean;
}

export const ConfigurationList: React.FC<ConfigurationListProps> = ({
  configs,
  selectedConfig,
  onConfigSelect,
  onConfigsChange,
  onDelete,
  loading = false,
}) => {
  const { user } = useAuth();
  const { loadConfigs } = useConfigContext();
  const { toast } = useToast();

  const [selectedConfigs, setSelectedConfigs] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameConfigId, setRenameConfigId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [isAssignToGroupOpen, setIsAssignToGroupOpen] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<string | null>(null);

  const groupedConfigs = useMemo(() => {
    return configs.reduce((acc, config) => {
      const group = config.group || 'Ungrouped';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(config);
      return acc;
    }, {} as Record<string, ConfigItem[]>);
  }, [configs]);

  const filteredConfigs = useMemo(() => {
    let filtered = configs;
    if (searchTerm) {
      filtered = filtered.filter(config => 
        config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.module.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (activeGroup) {
      filtered = filtered.filter(config => config.group === activeGroup);
    }
    return filtered;
  }, [configs, searchTerm, activeGroup]);

  if (isCollapsed) {
    return (
      <div className="w-12 flex flex-col items-center py-4 border-r">
        <Button variant="ghost" size="sm" onClick={() => setIsCollapsed(false)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-96 flex flex-col border-r">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="Search configurations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9"
          />
          <Button variant="ghost" size="sm" onClick={() => setIsCollapsed(true)} className="px-2">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedConfigs.size === filteredConfigs.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedConfigs(new Set(filteredConfigs.map(c => c.id)));
                } else {
                  setSelectedConfigs(new Set());
                }
              }}
            />
            <span className="text-sm text-muted-foreground">
              {selectedConfigs.size} selected
            </span>
          </div>

          <div className="flex items-center gap-1">
            {selectedConfigs.size > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (user?.id && configs) {
                      const success = await handleBulkDuplicate(
                        selectedConfigs,
                        configs,
                        user.id,
                        loadConfigs,
                        onConfigsChange
                      );
                      if (success) {
                        setSelectedConfigs(new Set());
                      }
                    }
                  }}
                  className="h-8 px-2"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBulkDelete(selectedConfigs, onDelete, setSelectedConfigs)}
                  className="h-8 px-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <Filter className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setActiveGroup(null)}>
                  All Configurations
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {Object.keys(groupedConfigs).map(group => (
                  <DropdownMenuItem 
                    key={group}
                    onClick={() => setActiveGroup(group)}
                  >
                    {group}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredConfigs.map((config) => (
            <ConfigListItem
              key={config.id}
              config={config}
              isSelected={selectedConfigs.has(config.id)}
              isActiveConfig={selectedConfig?.id === config.id}
              onSelect={(checked) => {
                setSelectedConfigs(prev => {
                  const next = new Set(prev);
                  if (checked) {
                    next.add(config.id);
                  } else {
                    next.delete(config.id);
                  }
                  return next;
                });
              }}
              onConfigSelect={() => onConfigSelect(config)}
              onDuplicate={async () => {
                if (user?.id) {
                  await handleSingleDuplicate(
                    config,
                    user.id,
                    loadConfigs,
                    onConfigsChange,
                    configs
                  );
                }
              }}
              onDelete={() => {
                onDelete(config.id);
                setSelectedConfigs(prev => {
                  const next = new Set(prev);
                  next.delete(config.id);
                  return next;
                });
              }}
              onRename={() => {
                setRenameConfigId(config.id);
                setRenameValue(config.name);
                setIsRenameDialogOpen(true);
              }}
              onAddToGroup={() => {
                setSelectedForGroup(config.id);
                setIsAssignToGroupOpen(true);
              }}
            />
          ))}
        </div>
      </ScrollArea>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Configuration</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Enter new name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (renameConfigId && renameValue.trim()) {
                handleRename(
                  renameConfigId,
                  renameValue.trim(),
                  configs,
                  onConfigsChange,
                  user?.id || '',
                  loadConfigs
                );
                setIsRenameDialogOpen(false);
                setRenameConfigId(null);
                setRenameValue('');
              }
            }}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignToGroupDialog
        isOpen={isAssignToGroupOpen}
        onClose={() => {
          setIsAssignToGroupOpen(false);
          setSelectedForGroup(null);
        }}
        configId={selectedForGroup}
        userId={user?.id || ''}
        onAssign={async (groupId) => {
          if (selectedForGroup && user?.id) {
            try {
              await groupService.addConfigToGroup(user.id, groupId, selectedForGroup);
              await loadConfigs();
              setIsAssignToGroupOpen(false);
              setSelectedForGroup(null);
              toast({
                title: "Success",
                description: "Configuration added to group"
              });
            } catch (error) {
              toast({
                title: "Error",
                description: "Failed to add configuration to group",
                variant: "destructive"
              });
            }
          }
        }}
      />
    </div>
  );
};
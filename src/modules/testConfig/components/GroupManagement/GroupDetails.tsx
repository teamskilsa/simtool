import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { Group } from '../../types/group.types';
import { ConfigItem } from '../../types/testConfig.types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { FileJson, FolderClosed, Plus, X, Trash2 } from 'lucide-react';
import { useGroupStore } from '../../store/groupStore';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface GroupDetailsProps {
  group: Group | null;
}

export const GroupDetails = React.memo(({ group }) => {
  const { 
    updateGroup, 
    deleteGroup, 
    addConfigToGroup, 
    removeConfigFromGroup, 
    configs,
    loadGroupConfigs,
    groupConfigs: groupConfigMapping,
    isLoading: storeLoading 
  } = useGroupStore();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedConfigs, setSelectedConfigs] = useState<Set<string>>(new Set());
  const [localName, setLocalName] = useState('');
  const [localDescription, setLocalDescription] = useState('');

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  //const { deleteGroup } = useGroupStore();
  
  const handleDelete = useCallback(async () => {
    if (!group) return;
    
    try {
      const success = await deleteGroup(group.id, group.createdBy);
      if (success) {
        toast({
          title: "Success",
          description: "Group deleted successfully"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive"
      });
    }
    setShowDeleteDialog(false);
  }, [group, deleteGroup]);
  
  // Update local state when group changes
  useEffect(() => {
    if (group) {
      setLocalName(group.name);
      setLocalDescription(group.description || '');
      loadGroupConfigs(group.id);
    }
  }, [group?.id]);

  const groupConfigIds = useMemo(() => {
    console.log('GroupConfigMapping state:', groupConfigMapping);
    console.log('Current group:', group?.id);
    
    if (!group?.id || !groupConfigMapping[group.id]) return [];
    
    // Ensure we're getting a proper array of config names
    const configIds = groupConfigMapping[group.id] || [];
    console.log('Config IDs for group:', configIds);
    return configIds;
  }, [group, groupConfigMapping]);
  
  const groupConfigs = useMemo(() => {
    console.log('All available configs:', configs);
    console.log('Group config IDs:', groupConfigIds);
    
    // Filter configs based on their names being in the groupConfigIds
    const filtered = configs.filter(config => {
      const included = groupConfigIds.includes(config.name);
      console.log(`Config ${config.name}: ${included ? 'included' : 'excluded'}`);
      return included;
    });
    
    console.log('Final filtered configs:', filtered);
    return filtered;
  }, [configs, groupConfigIds]);

  // Get available configs (those not in the group)
  const availableConfigs = useMemo(() => {
    return configs.filter(config => 
      !groupConfigIds.includes(config.name)
    );
  }, [configs, groupConfigIds]);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedConfigs(new Set(checked ? availableConfigs.map(c => c.name) : []));
  }, [availableConfigs]);

  const handleConfigSelect = useCallback((configName: string) => {
    setSelectedConfigs(prev => {
      const next = new Set(prev);
      if (next.has(configName)) next.delete(configName);
      else next.add(configName);
      return next;
    });
  }, []);

  const handleAddConfigs = async () => {
    if (!group) return;
    try {
      setIsLoading(true);
      for (const configName of selectedConfigs) {
        await addConfigToGroup(configName, group.id, group.createdBy);
      }
      setSelectedConfigs(new Set());
      toast({
        title: "Success",
        description: "Configurations added to group"
      });
    } catch (error) {
      console.error('Failed to add configs:', error);
      toast({
        title: "Error",
        description: "Failed to add configurations to group",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = useCallback(async (field: string, value: string) => {
    if (!group) return;
    try {
      setIsLoading(true);
      await updateGroup({
        ...group,
        [field]: value,
        modifiedAt: new Date()
      }, group.createdBy);

      toast({
        title: "Success",
        description: "Group updated successfully"
      });
    } catch (error) {
      console.error('Failed to update group:', error);
      toast({
        title: "Error",
        description: "Failed to update group",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [group, updateGroup]);

  const handleRemoveConfig = async (configName: string) => {
    if (!group) return;
    try {
      await removeConfigFromGroup(configName, group.id, group.createdBy);
      toast({
        title: "Success",
        description: "Configuration removed from group"
      });
    } catch (error) {
      console.error('Failed to remove config:', error);
      toast({
        title: "Error",
        description: "Failed to remove configuration from group",
        variant: "destructive"
      });
    }
  };

  if (!group) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <FolderClosed className="h-10 w-10 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Select a group to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className={cn(
        "p-6",
        "bg-gradient-to-r from-blue-500/5 to-indigo-500/5",
        "border border-blue-100/20"
      )}>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Group Name</Label>
            <Input
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={() => handleUpdate('name', localName)}
              className="mt-1.5"
              placeholder="Enter group name"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Description</Label>
            <Input
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              onBlur={() => handleUpdate('description', localDescription)}
              className="mt-1.5"
              placeholder="Add a description..."
            />
          </div>
        </div>
          {/* Add Delete Button */}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this group?')) {
                deleteGroup(group.id, group.createdBy);
              }
            }}
            className="ml-4 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Group
          </Button>  
      </Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Current Configurations</h3>
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
            {groupConfigs.length} items
          </Badge>
        </div>

        <Card className="p-4">
          {groupConfigs.length > 0 ? (
            <div className="divide-y divide-border/50">
              {groupConfigs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between py-3 px-2 group hover:bg-accent/5 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <FileJson className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium">{config.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {config.module}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveConfig(config.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <p>No configurations in this group</p>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Available Configurations</h3>
          {selectedConfigs.size > 0 && (
            <Button
              onClick={handleAddConfigs}
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Selected ({selectedConfigs.size})
            </Button>
          )}
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedConfigs.size === availableConfigs.length && availableConfigs.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead className="text-right">Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableConfigs.map((config) => (
                <TableRow
                  key={config.id}
                  className={cn(
                    "cursor-pointer",
                    selectedConfigs.has(config.name) && "bg-accent/5"
                  )}
                >
                  <TableCell className="w-[50px]">
                    <Checkbox
                      checked={selectedConfigs.has(config.name)}
                      onCheckedChange={() => handleConfigSelect(config.name)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-blue-500" />
                      {config.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {config.module}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(config.modifiedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
        <p>Created: {new Date(group.createdAt).toLocaleString()}</p>
        <p>Last Modified: {new Date(group.modifiedAt).toLocaleString()}</p>
      </div>
    </div>
  );
});

GroupDetails.displayName = 'GroupDetails';
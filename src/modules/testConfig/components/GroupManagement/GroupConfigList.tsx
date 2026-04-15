import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfigItem, GroupConfigListProps } from './types';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';
import { styles } from './styles';
import { APITest } from './APITest';
export const GroupConfigList: React.FC<GroupConfigListProps> = ({
  groupId,
  configs,
  selectedConfigs,
  onConfigSelect,
  onConfigsAdd,
  onConfigsRemove
}) => {
  if (!groupId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Select a group to manage configurations</p>
      </div>
    );
  }

  return (
    <Card className={cn("p-4", styles.glassEffect)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Configurations</h3>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {/* Open add configs dialog */}}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Configs
          </Button>
          {selectedConfigs.size > 0 && (
            <Button 
              size="sm" 
              variant="outline" 
              className="text-destructive"
              onClick={() => onConfigsRemove(Array.from(selectedConfigs))}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Selected
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={configs.length > 0 && selectedConfigs.size === configs.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      configs.forEach(config => onConfigSelect(config.id));
                    } else {
                      selectedConfigs.forEach(id => onConfigSelect(id));
                    }
                  }}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Modified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground h-32">
                  No configurations in this group
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow 
                  key={config.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selectedConfigs.has(config.id) && "bg-muted/50"
                  )}
                  onClick={() => onConfigSelect(config.id)}
                >
                  <TableCell>
                    <Checkbox 
                      checked={selectedConfigs.has(config.id)}
                      onCheckedChange={() => onConfigSelect(config.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-muted-foreground" />
                    {config.name}
                  </TableCell>
                  <TableCell>{config.module}</TableCell>
                  <TableCell>
                    {new Date(config.modifiedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
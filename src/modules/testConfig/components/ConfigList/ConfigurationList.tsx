// ConfigList/ConfigurationList.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/modules/auth/context/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { useConfigContext } from '../../context/ConfigContext';
import { ConfigListItem } from './ConfigListItem';
import { ConfigListHeader } from './ConfigListHeader';
import { FilterDropdown } from './components/FilterDropdown';
import { RenameDialog } from './components/RenameDialog';
import { AssignToGroupDialog } from '../GroupManagement/AssignToGroupDialog';
import { useConfigList } from './hooks/useConfigList';
import { configActions } from './actions/configActions';
import { groupActions } from './actions/groupActions';
import { ConfigItem } from '../../types';
import { cn } from '@/lib/utils';

export interface ConfigListProps {
  configs: ConfigItem[];
  selectedConfig: ConfigItem | null;
  onConfigSelect: (config: ConfigItem) => void;
  onConfigsChange: (configs: ConfigItem[]) => void;
  onDelete: (configId: string) => void;
  loading?: boolean;
}

export const ConfigurationList: React.FC<ConfigListProps> = ({
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

  const {
    selectedConfigs,
    isCollapsed,
    searchTerm,
    activeGroup,
    isRenameDialogOpen,
    renameValue,
    renameConfigId,
    isAssignToGroupOpen,
    selectedForGroup,
    groupedConfigs,
    filteredConfigs,
    setSelectedConfigs,
    setIsCollapsed,
    setSearchTerm,
    setActiveGroup,
    setIsRenameDialogOpen,
    setRenameValue,
    setRenameConfigId,
    setIsAssignToGroupOpen,
    setSelectedForGroup,
    handleBulkSelect,
    handleSingleSelect
  } = useConfigList(configs);

  if (isCollapsed) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setIsCollapsed(false)}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className="w-96 flex flex-col border-r">
      <ConfigListHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onCollapse={() => setIsCollapsed(true)}
        selectedCount={selectedConfigs.size}
        isAllSelected={selectedConfigs.size === filteredConfigs.length}
        onSelectAll={handleBulkSelect}
        onBulkDuplicate={() => {
          // Implement bulk duplicate
        }}
        onBulkDelete={() => configActions.handleBulkDelete(selectedConfigs, onDelete, setSelectedConfigs)}
        filterDropdown={
          <FilterDropdown
            groups={groupedConfigs}
            activeGroup={activeGroup}
            onGroupSelect={setActiveGroup}
          />
        }
      />

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredConfigs.map((config) => (
            <ConfigListItem
              key={config.id}
              config={config}
              isSelected={selectedConfigs.has(config.id)}
              isActiveConfig={selectedConfig?.id === config.id}
              onSelect={(checked) => handleSingleSelect(config.id, checked)}
              onConfigSelect={() => onConfigSelect(config)}
              onDuplicate={async () => {
                // Implement single duplicate
              }}
              onDelete={() => configActions.handleDelete(config.id, onDelete, setSelectedConfigs)}
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

      <RenameDialog
        isOpen={isRenameDialogOpen}
        onClose={() => {
          setIsRenameDialogOpen(false);
          setRenameConfigId(null);
          setRenameValue('');
        }}
        configId={renameConfigId}
        value={renameValue}
        onChange={setRenameValue}
        configs={configs}
        onConfigsChange={onConfigsChange}
        userId={user?.id || ''}
        loadConfigs={loadConfigs}
      />

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
            const success = await groupActions.addConfigToGroup(
              user.id,
              groupId,
              selectedForGroup,
              loadConfigs
            );
            if (success) {
              setIsAssignToGroupOpen(false);
              setSelectedForGroup(null);
            }
          }
        }}
      />
    </div>
  );
};
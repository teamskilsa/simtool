// ConfigList/ConfigurationList.tsx
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, FileText, Database } from 'lucide-react';
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
import { TAB_LIST, TAB_TRIGGER, TAB_TRIGGER_ACTIVE, TAB_TRIGGER_IDLE } from '@/components/ui/tab-styles';
import { classifyAll, RAT_BADGE } from './classifyConfig';
import type { BuilderConfigType } from '../ConfigBuilder';

type ListTab = 'main' | 'aux';
type RatFilter = 'all' | BuilderConfigType;

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

  // Classify each config (main vs auxiliary, plus RAT for main configs).
  // Memoized on the configs array so it only re-runs when configs change.
  const classification = useMemo(() => classifyAll(configs), [configs]);

  // Tab + RAT filter
  const [tab, setTab] = useState<ListTab>('main');
  const [ratFilter, setRatFilter] = useState<RatFilter>('all');

  // Counts for the tab badges (use the filteredConfigs so search applies)
  const counts = useMemo(() => {
    let main = 0, aux = 0;
    for (const c of filteredConfigs) {
      const k = classification.get(c.id)?.kind;
      if (k === 'main') main++; else if (k === 'auxiliary') aux++;
    }
    return { main, aux };
  }, [filteredConfigs, classification]);

  // RAT counts inside the main tab — used for the chip badges
  const ratCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const c of filteredConfigs) {
      const cl = classification.get(c.id);
      if (cl?.kind !== 'main') continue;
      counts.all++;
      if (cl.rat) counts[cl.rat] = (counts[cl.rat] || 0) + 1;
    }
    return counts;
  }, [filteredConfigs, classification]);

  // Final list applied AFTER tab + RAT filter
  const visibleConfigs = useMemo(() => {
    return filteredConfigs.filter(c => {
      const cl = classification.get(c.id);
      if (!cl) return false;
      if (tab === 'main' && cl.kind !== 'main') return false;
      if (tab === 'aux'  && cl.kind !== 'auxiliary') return false;
      if (tab === 'main' && ratFilter !== 'all' && cl.rat !== ratFilter) return false;
      return true;
    });
  }, [filteredConfigs, classification, tab, ratFilter]);

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
        isAllSelected={selectedConfigs.size === visibleConfigs.length && visibleConfigs.length > 0}
        onSelectAll={handleBulkSelect}
        onBulkDuplicate={async () => {
          const n = await configActions.handleBulkDuplicate(
            selectedConfigs, configs, user?.id || 'admin', loadConfigs, setSelectedConfigs,
          );
          toast({
            title: n > 0 ? 'Duplicated' : 'Nothing to duplicate',
            description: n > 0 ? `${n} configuration${n === 1 ? '' : 's'} copied.` : undefined,
          });
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

      {/* Main / Dependencies tab toggle. Same underline language as every
          other tab bar in the app, and theme tokens rather than hardcoded
          indigo/gray, which stayed light-mode colours in dark mode. */}
      <div className={cn(TAB_LIST, 'px-2 gap-0.5')}>
        <button
          onClick={() => setTab('main')}
          className={cn(
            TAB_TRIGGER, 'px-2 text-xs',
            tab === 'main' ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_IDLE,
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          Configurations
          <span className="text-[10px] opacity-70">({counts.main})</span>
        </button>
        <button
          onClick={() => setTab('aux')}
          className={cn(
            TAB_TRIGGER, 'px-2 text-xs',
            tab === 'aux' ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_IDLE,
          )}
        >
          <Database className="w-3.5 h-3.5" />
          Dependencies
          <span className="text-[10px] opacity-70">({counts.aux})</span>
        </button>
      </div>

      {/* RAT chips — only on the main tab.
          A filter that can only ever return nothing is not worth a chip, so
          empty RATs are hidden (they reappear the moment one is imported).
          That drops the row from two wrapped lines to one on a narrow panel.
          The active chip keeps its slot if you filter down to zero. */}
      {tab === 'main' && (
        <div className="px-2 py-1.5 flex flex-wrap gap-1 border-b">
          {(['all', 'nr', 'lte', 'nsa', 'nbiot', 'catm', 'core'] as RatFilter[])
            .filter(r => r === 'all' || (ratCounts[r] ?? 0) > 0 || ratFilter === r)
            .map(r => {
              const isActive = ratFilter === r;
              const meta = r === 'all' ? null : RAT_BADGE[r];
              const label = r === 'all' ? 'All' : meta?.label ?? r;
              const n = ratCounts[r] ?? 0;
              return (
                <button
                  key={r}
                  onClick={() => setRatFilter(r)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-md font-medium border transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40',
                  )}
                >
                  {label}
                  <span className={cn('ml-1 text-[9px]', isActive ? 'opacity-80' : 'opacity-60')}>
                    {n}
                  </span>
                </button>
              );
            })}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {visibleConfigs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              {tab === 'aux'
                ? 'No dependency files yet. Drop a drb.cfg / sib*.asn alongside an enb.cfg to import them together.'
                : 'No configurations match this filter.'}
            </p>
          )}
          {visibleConfigs.map((config) => (
            <ConfigListItem
              key={config.id}
              config={config}
              classification={classification.get(config.id)}
              isSelected={selectedConfigs.has(config.id)}
              isActiveConfig={selectedConfig?.id === config.id}
              onSelect={(checked) => handleSingleSelect(config.id, checked)}
              onConfigSelect={() => onConfigSelect(config)}
              onDuplicate={async () => {
                const created = await configActions.handleDuplicate(
                  config.id, configs, user?.id || 'admin', loadConfigs,
                );
                toast({
                  title: created ? 'Duplicated' : 'Duplicate failed',
                  description: created ? `Created "${created.name}"` : 'Source content unavailable.',
                  variant: created ? 'default' : 'destructive',
                });
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
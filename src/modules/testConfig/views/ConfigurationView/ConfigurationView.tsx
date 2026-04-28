'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/modules/auth/context/auth-context';
import { ConfigItem } from '../../types';
import { ConfigurationHeader } from './ConfigurationHeader';
import { ConfigurationList } from '../../components/ConfigList';
import { ConfigurationEditor } from './ConfigurationEditor';
import { ImportModal } from '../../components/ImportConfig';
import { FileImportModal } from '../../components/FileImport/FileImportModal';
import { configsService } from '../../services/configs.service';
import { tryParseAmarisoftConfig, detectConfigType, extractReferencedFiles } from '../../components/ConfigBuilder';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { cn } from '@/lib/utils';
import { useGroupStore } from '../../store/groupStore';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
//import { GroupManagement } from '@/modules/testConfig/components/GroupManagement';
import { GroupManagementContainer as GroupManagement } from '@/modules/testConfig/components/GroupManagement';

export function ConfigurationView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme: themeVariant } = useTheme();
  const theme = themes[themeVariant];
  
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFileImportOpen, setIsFileImportOpen] = useState(false);
  const [isGroupManagementOpen, setIsGroupManagementOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { 
    groups, 
    createGroup, 
    deleteGroup, 
    renameGroup, 
    moveGroup,
    addConfigToGroup,
    selectedGroupId,
    selectGroup
  } = useGroupStore();

  const loadConfigs = useCallback(async () => {
    if (!user?.id || loading) return;  // Keep this check
    try {
      const loadedConfigs = await configsService.getConfigs(user.id);
      setConfigs(loadedConfigs);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh configurations",
        variant: "destructive"
      });
    }
  }, [user?.id]);  // Only depend on user.id, remove loading and toast dependencies

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);  // Keep this simple

  const handleImport = async (config: ConfigItem) => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log('Handling import for config:', config);
      
      if (!config.name || !config.module || !config.content) {
        throw new Error('Missing required fields for import');
      }

      await configsService.importConfig({
        id: config.id,
        name: config.name,
        module: config.module,
        content: config.content,
        size: config.size
      }, user.id);

      await loadConfigs();
      setIsImportModalOpen(false);
      toast({
        title: "Success",
        description: "Configuration imported successfully"
      });
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to import configuration',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (files: File[]) => {
    if (!user?.id) return;

    try {
      setLoading(true);
      // Read all dropped files first so we can co-import deps in one pass.
      const fileMap = new Map<string, { name: string; content: string; size: number }>();
      for (const file of files) {
        const content = await file.text();
        // Browsers/users sometimes wrap .cfg with .json/.txt — strip those.
        let cleanName = file.name.replace(/\.(json|txt)$/i, '');
        // Bare names without .cfg/.asn keep their original extension
        // (drb.cfg / sib2_3.asn are both valid). Only force .cfg if no known ext.
        if (!/\.(cfg|asn|conf|db)$/i.test(cleanName)) cleanName += '.cfg';
        fileMap.set(cleanName.toLowerCase(), { name: cleanName, content, size: file.size });
      }

      // Identify each file's role: main cfg (has detect type) vs auxiliary
      // (drb*.cfg, sib*.asn, ...).
      let mainCount = 0, depCount = 0, missingDeps: string[] = [];
      for (const [, f] of fileMap) {
        const ast = tryParseAmarisoftConfig(f.content);
        const detected = detectConfigType(ast, f.name);
        const isAuxiliary = detected === 'unknown' || /\.asn$/i.test(f.name) || /^drb/i.test(f.name);

        const module =
          isAuxiliary ? 'enb' :
          detected === 'core' ? 'mme' :
          detected === 'nr'   ? 'gnb' :
          (detected === 'lte' || detected === 'nbiot' || detected === 'catm' || detected === 'nsa') ? 'enb' :
          f.name.startsWith('gnb-') ? 'gnb' :
          f.name.startsWith('mme-') ? 'mme' : 'enb';

        await configsService.importConfig({
          name: f.name,
          module,
          content: f.content,
          size: f.size,
        }, user.id);

        if (isAuxiliary) depCount++;
        else {
          mainCount++;
          // Check the main cfg's references — warn for any not in the drop set
          const refs = extractReferencedFiles(f.content);
          for (const r of refs) {
            const baseName = r.filename.split('/').pop() || r.filename;
            if (!fileMap.has(baseName.toLowerCase()) && !fileMap.has(r.filename.toLowerCase())) {
              missingDeps.push(`${baseName} (referenced as ${r.type})`);
            }
          }
        }
      }

      await loadConfigs();
      setIsFileImportOpen(false);

      if (missingDeps.length > 0) {
        toast({
          title: "Imported with missing dependencies",
          description: `${mainCount} main cfg + ${depCount} auxiliary file(s). Missing: ${missingDeps.slice(0, 3).join(', ')}${missingDeps.length > 3 ? `, +${missingDeps.length - 3} more` : ''}. Drop these alongside next time.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Imported ${mainCount} main config${mainCount === 1 ? '' : 's'}${depCount > 0 ? ` + ${depCount} dependency file${depCount === 1 ? '' : 's'}` : ''}.`,
        });
      }
    } catch (error) {
      console.error('File import failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to import files',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleDelete = async (configId: string) => {
    if (!user?.id) return;
    try {
      await configsService.deleteConfig(user.id, configId);
      if (selectedConfig?.id === configId) {
        setSelectedConfig(null);
      }
      await loadConfigs();
      toast({
        title: "Success",
        description: "Configuration deleted successfully"
      });
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        title: "Error",
        description: "Failed to delete configuration",
        variant: "destructive"
      });
    }
  };

  const handleAddToGroup = useCallback(async (configId: string, groupId: string) => {
    try {
      await addConfigToGroup(configId, groupId);
      setConfigs(prev => prev.map(config => 
        config.id === configId 
          ? { ...config, group: groupId }
          : config
      ));
      toast({
        title: "Success",
        description: "Added to group successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add to group",
        variant: "destructive"
      });
    }
  }, [addConfigToGroup, toast]);

  const handleGroupCreate = async (name: string, userId: string, parentId?: string) => {
    try {
      const success = await createGroup(name, userId, parentId);
      if (success) {
        toast({
          title: "Success",
          description: "Group created successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive"
      });
    }
  };

  return (
    <TooltipProvider>
      <div className={cn(
        "flex-1 p-6",
        theme.surfaces.page.background
      )}>
        <ConfigurationHeader
          onImport={() => setIsImportModalOpen(true)}
          onCreateNew={() => setSelectedConfig(null)}
          onFileImport={() => setIsFileImportOpen(true)}
          onManageGroups={() => setIsGroupManagementOpen(true)}
        />
        
        {loading && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center",
            theme.effects.glass.medium,
            "z-50"
          )}>
            <div className="flex flex-col items-center gap-2">
              <Spinner size="lg" />
              <span className={theme.surfaces.page.foreground}>
                Loading...
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          <ConfigurationList
            configs={configs}
            selectedConfig={selectedConfig}
            onConfigSelect={setSelectedConfig}
            onConfigsChange={setConfigs}
            onDelete={handleDelete}
            loading={loading}
            onAddToGroup={handleAddToGroup}
            selectedGroupId={selectedGroupId}
            onGroupSelect={selectGroup}
          />
          
          <ConfigurationEditor
            config={selectedConfig}
            readOnly={isImportModalOpen}
          />
        </div>

        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImport}
        />

        <FileImportModal
          isOpen={isFileImportOpen}
          onClose={() => setIsFileImportOpen(false)}
          onImport={handleFileImport}
        />

      <GroupManagement
        isOpen={isGroupManagementOpen}
        onClose={() => setIsGroupManagementOpen(false)}
      />
      </div>
    </TooltipProvider>
  );
}
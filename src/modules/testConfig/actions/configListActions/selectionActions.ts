import { ConfigItem } from '../../types';
import { configsService } from '../../services/configs.service';
import { toast } from '@/components/ui/use-toast';

export const handleBulkDuplicate = async (
    selectedConfigs: Set<string>,
    configs: ConfigItem[],
    userId: string,
    loadConfigs: () => Promise<void>,
    onConfigsChange: (configs: ConfigItem[]) => void
  ) => {
    try {
      const configsToDuplicate = configs.filter(config => selectedConfigs.has(config.id));
      const timestamp = new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(/[/,]/g, '').replace(/\s/g, '-');
      
      const duplicatedConfigs: ConfigItem[] = [];
      
      for (const config of configsToDuplicate) {
        const duplicate: ConfigItem = {
          ...config,
          id: `${config.id}-${timestamp}`,
          name: `${config.name.includes('.cfg') ? config.name.replace('.cfg', `-${timestamp}.cfg`) : `${config.name}-${timestamp}.cfg`}`,
          createdBy: userId,
          createdAt: new Date(),
          modifiedAt: new Date(),
          isServerConfig: false,
          path: `/root/${config.module}/config/${config.name.includes('.cfg') ? config.name.replace('.cfg', `-${timestamp}.cfg`) : `${config.name}-${timestamp}.cfg`}`
        };
        await configsService.importConfig(duplicate, userId);
        duplicatedConfigs.push(duplicate);
      }
  
      // Update local state immediately
      onConfigsChange([...configs, ...duplicatedConfigs]);
      
      toast({
        title: "Success",
        description: `Successfully duplicated ${configsToDuplicate.length} configuration${configsToDuplicate.length !== 1 ? 's' : ''}`,
        variant: "default"
      });
  
      return true;
    } catch (error) {
      console.error('Bulk duplication failed:', error);
      toast({
        title: "Error",
        description: "Failed to duplicate configurations",
        variant: "destructive"
      });
      return false;
    }
  };

export const handleBulkDelete = (
  selectedConfigs: Set<string>,
  onDelete: (configId: string) => void,
  setSelectedConfigs: (configs: Set<string>) => void
) => {
  try {
    selectedConfigs.forEach(configId => {
      onDelete(configId);
    });
    setSelectedConfigs(new Set());
    
    toast({
      title: "Success",
      description: `Successfully deleted ${selectedConfigs.size} configuration${selectedConfigs.size !== 1 ? 's' : ''}`,
      variant: "default"
    });
  } catch (error) {
    console.error('Bulk deletion failed:', error);
    toast({
      title: "Error",
      description: "Failed to delete configurations",
      variant: "destructive"
    });
  }
};

export const handleBulkGroupCreate = (
  selectedConfigs: Set<string>,
  groupName: string,
  configs: ConfigItem[],
  onConfigsChange: (configs: ConfigItem[]) => void,
  setSelectedConfigs: (configs: Set<string>) => void
) => {
  try {
    const newConfigs = configs.map(config => 
      selectedConfigs.has(config.id)
        ? { ...config, group: groupName }
        : config
    );
    onConfigsChange(newConfigs);
    setSelectedConfigs(new Set());
    
    toast({
      title: "Success",
      description: `Successfully added ${selectedConfigs.size} configuration${selectedConfigs.size !== 1 ? 's' : ''} to group`,
      variant: "default"
    });
  } catch (error) {
    console.error('Bulk group creation failed:', error);
    toast({
      title: "Error",
      description: "Failed to add configurations to group",
      variant: "destructive"
    });
  }
};

export const handleBulkSelect = (
  checked: boolean,
  filteredConfigs: ConfigItem[],
  setSelectedConfigs: (configs: Set<string>) => void
) => {
  try {
    if (checked) {
      const configIds = filteredConfigs.map(c => c.id);
      setSelectedConfigs(new Set(configIds));
    } else {
      setSelectedConfigs(new Set());
    }
  } catch (error) {
    console.error('Bulk selection failed:', error);
    toast({
      title: "Error",
      description: "Failed to select configurations",
      variant: "destructive"
    });
  }
};
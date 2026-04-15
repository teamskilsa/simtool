import { ConfigItem } from '../../types';
import { configsService } from '../../services/configs.service';
import { toast } from '@/components/ui/use-toast';


export const handleSingleDuplicate = async (
    config: ConfigItem,
    userId: string,
    loadConfigs: () => Promise<void>,
    onConfigsChange: (configs: ConfigItem[]) => void,
    currentConfigs: ConfigItem[]
  ) => {
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(/[/,]/g, '').replace(/\s/g, '-');
  
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
      
      // Update local state immediately
      onConfigsChange([...currentConfigs, duplicate]);
  
      toast({
        title: "Success",
        description: "Configuration duplicated successfully",
        variant: "default"
      });
    } catch (error) {
      console.error('Duplication failed:', error);
      toast({
        title: "Error",
        description: "Failed to duplicate configuration",
        variant: "destructive"
      });
    }
  };

  export const handleRename = (
    configId: string,
    newName: string,
    configs: ConfigItem[],
    onConfigsChange: (configs: ConfigItem[]) => void,
    userId: string,
    loadConfigs: () => Promise<void>
  ) => {
    try {
      // Update the config with new name
      const updatedConfigs = configs.map(config => 
        config.id === configId 
          ? { ...config, name: newName, modifiedAt: new Date() }
          : config
      );
      
      onConfigsChange(updatedConfigs);
      
      // Save to server if needed
      loadConfigs(); // Refresh to ensure sync with server
  
      toast({
        title: "Success",
        description: "Configuration renamed successfully",
        variant: "default"
      });
      
    } catch (error) {
      console.error('Rename failed:', error);
      toast({
        title: "Error",
        description: "Failed to rename configuration",
        variant: "destructive"
      });
    }
  };

export const handleGroupCreate = (
  configIds: string[],
  groupName: string,
  configs: ConfigItem[],
  onConfigsChange: (configs: ConfigItem[]) => void
) => {
  try {
    const newConfigs = configs.map(config => 
      configIds.includes(config.id) 
        ? { ...config, group: groupName }
        : config
    );
    onConfigsChange(newConfigs);
    
    toast({
      title: "Success",
      description: "Group created successfully",
      variant: "default"
    });
  } catch (error) {
    console.error('Group creation failed:', error);
    toast({
      title: "Error",
      description: "Failed to create group",
      variant: "destructive"
    });
  }
};
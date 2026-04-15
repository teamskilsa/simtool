// src/modules/testConfig/services/configs.service.ts
import { useToast } from '@/components/ui/use-toast';

class ConfigsService {
  private readonly baseUrl = '/api/configs';

 
  async getConfigs(userId: string): Promise<ConfigItem[]> {
    console.log('Fetching configs for user:', userId);
    const response = await fetch(`${this.baseUrl}?userId=${userId}`);
  
    if (!response.ok) {
      throw new Error('Failed to fetch configurations');
    }
  
    const configs = await response.json();
    console.log('Received configs:', configs); // Add this log
    return configs;
  }

  async importConfig(config: ConfigItem, userId: string): Promise<ConfigItem> {
    // Log the incoming config
    console.log('ImportConfig - Received config:', {
      id: config.id,
      name: config.name,
      module: config.module,
      contentLength: config.content?.length
    });

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            id: config.id,
            name: config.name,
            module: config.module,
            content: config.content,
            path: config.path || `/root/${config.module}/config/${config.name}`,
            size: config.content?.length || 0,
            createdBy: 'admin',  // Add these
            createdAt: new Date(),
            modifiedAt: new Date()
          },
          userId
        })
      });

      console.log('POST response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Import API error:', errorData);
        throw new Error(errorData.error || 'Failed to import configuration');
      }

      const result = await response.json();
      console.log('Import successful:', {
        id: result.id,
        name: result.name,
        module: result.module
      });
      return result;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }


async deleteConfig(userId: string, configId: string): Promise<void> {
  console.log('Deleting config:', { userId, configId });
  const response = await fetch(`${this.baseUrl}?userId=${userId}&configId=${configId}`, {
      method: 'DELETE'
  });

  if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Delete failed:', errorData);
      throw new Error(errorData.error || 'Failed to delete configuration');
  }
}
}

export const configsService = new ConfigsService();
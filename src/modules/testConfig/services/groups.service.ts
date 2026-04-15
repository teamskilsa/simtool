// groups.service.ts
import { Group } from '../types/group.types';
import { ConfigItem } from '../types/testConfig.types';

export class GroupService {
  private readonly baseUrl = '/api/groups';

  async createGroup(data: { name: string, description?: string }, userId: string): Promise<Group> {
    console.log('Creating group:', { data, userId });
    
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group: {
          ...data,
          parentId: null,
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          createdBy: userId
        },
        userId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Create group error:', error);
      throw new Error(error.message || 'Failed to create group');
    }

    const result = await response.json();
    console.log('Group created:', result);
    return result;
  }

  async addConfigToGroup(userId: string, groupId: string, configId: string): Promise<void> {
    console.log('Adding config to group:', { userId, groupId, configId });
    
    const response = await fetch(`${this.baseUrl}/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId, 
        groupId, 
        configIds: [configId] 
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add config to group');
    }
  }

  async getGroups(userId: string): Promise<Group[]> {
    console.log('Fetching groups for user:', userId);
    const response = await fetch(`${this.baseUrl}?userId=${userId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch groups');
    }
    
    const groups = await response.json();
    console.log('Received groups:', groups);
    return groups;
  }

  async deleteGroup(userId: string, groupId: string): Promise<void> {
    console.log('Deleting group:', { userId, groupId });
    
    const response = await fetch(`${this.baseUrl}?userId=${userId}&groupId=${groupId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete group');
    }
  }

  async updateGroup(group: Group, userId: string): Promise<Group> {
    console.log('Updating group:', { group, userId });
    
    const response = await fetch(this.baseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group: {
          ...group,
          modifiedAt: new Date().toISOString()
        },
        userId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update group');
    }

    const result = await response.json();
    console.log('Group updated:', result);
    return result;
  }

  async removeConfigFromGroup(userId: string, groupId: string, configId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/configs`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, groupId, configIds: [configId] })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to remove config from group');
    }
  }

  async getGroupConfigs(groupId: string): Promise<ConfigItem[]> {
    const response = await fetch(`${this.baseUrl}/configs?groupId=${groupId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch group configs');
    }
    return response.json();
  }
}

export const groupService = new GroupService();
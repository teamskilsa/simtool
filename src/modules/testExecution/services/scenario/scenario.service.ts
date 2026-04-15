// services/scenario/scenario.service.ts
import { ScenarioConfig } from '../../types/scenario.types';

class ScenarioService {
  private readonly baseUrl = '/api/scenarios';

  async getScenarios(userId: string, groupId?: string): Promise<ScenarioConfig[]> {
    try {
      const url = new URL(`${this.baseUrl}/list`);
      if (groupId) {
        url.searchParams.set('groupId', groupId);
      }
      url.searchParams.set('userId', userId);
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch scenarios');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get scenarios:', error);
      throw error;
    }
  }

  async saveScenario(userId: string, scenario: ScenarioConfig, groupId?: string): Promise<void> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          groupId,
          scenario: {
            ...scenario,
            createdBy: userId,
            createdAt: new Date(),
            modifiedAt: new Date()
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save scenario');
      }
    } catch (error) {
      console.error('Failed to save scenario:', error);
      throw error;
    }
  }

  async createGroup(userId: string, name: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create group');
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }

  async deleteGroup(userId: string, groupId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Failed to delete group');
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
      throw error;
    }
  }

  async moveToGroup(userId: string, scenarioId: string, groupId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${scenarioId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          groupId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to move scenario');
      }
    } catch (error) {
      console.error('Failed to move scenario:', error);
      throw error;
    }
  }
}

export const scenarioService = new ScenarioService();
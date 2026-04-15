// src/modules/testExecution/services/results/results.service.ts
export interface ExportOptions {
  format?: 'xlsx' | 'csv';
  filters?: Record<string, any>;
}

class ResultsService {
  async getResults(filters?: Record<string, any>) {
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`/api/results?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch results:', error);
      throw error;
    }
  }

  async exportResults(resultIds: string[], options: ExportOptions = {}): Promise<Blob> {
    try {
      const response = await fetch('/api/results/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resultIds,
          ...options
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export results');
      }

      return await response.blob();
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }
}

export const resultsService = new ResultsService();
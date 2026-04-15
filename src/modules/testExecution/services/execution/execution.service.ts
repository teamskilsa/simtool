// services/execution/execution.service.ts
import { ExecutionStep } from '../../types/execution.types';

class ExecutionService {
  async executeScenario(scenarioId: string): Promise<ExecutionStep[]> {
    console.log(`[ExecuteScenario] Starting execution for scenario: ${scenarioId}`);
    
    try {
      // 1. Fetch scenario details with proper URL encoding
      const response = await fetch(`/api/scenarios/execute?id=${encodeURIComponent(scenarioId)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[ExecuteScenario] Failed to fetch scenario:', errorData);
        throw new Error(errorData.error || 'Failed to fetch scenario details');
      }
      
      const scenario = await response.json();
      console.log('[ExecuteScenario] Retrieved scenario details:', scenario);

      // 2. Execute modules in sequence
      const steps: ExecutionStep[] = [];
      const modules = this.getExecutionOrder(scenario.topology);

      console.log(`[ExecuteScenario] Executing modules in order: ${modules.join(', ')}`);

      for (const module of modules) {
        const moduleConfig = scenario.moduleConfigs.find((c: any) => c.module === module);
        if (moduleConfig) {
          console.log(`[ExecuteScenario] Starting module execution: ${module}`);
          const step = await this.executeModule(moduleConfig, scenario.system.host);
          steps.push(step);

          if (step.status === 'failure') {
            console.error(`[ExecuteScenario] Module ${module} failed, stopping execution`);
            break;
          }
        } else {
          console.warn(`[ExecuteScenario] No config found for module: ${module}`);
        }
      }

      return steps;
    } catch (error) {
      console.error('[ExecuteScenario] Execution failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async executeModule(moduleConfig: any, systemHost: string): Promise<ExecutionStep> {
    console.log(`[ExecuteModule] Starting execution for module: ${moduleConfig.module}`);
    
    const step: ExecutionStep = {
      id: `${moduleConfig.module}-${Date.now()}`,
      name: `Execute ${moduleConfig.module}`,
      status: 'running',
      startTime: new Date()
    };

    try {
      // 1. Get configuration content
      console.log(`[ExecuteModule] Fetching config for ${moduleConfig.module}/${moduleConfig.configId}`);
      const configResponse = await fetch(`/api/configs/${moduleConfig.module}/${moduleConfig.configId}`);
      
      if (!configResponse.ok) {
        throw new Error(`Failed to fetch configuration: ${configResponse.statusText}`);
      }
      
      const config = await configResponse.json();
      console.log(`[ExecuteModule] Config fetched successfully for ${moduleConfig.module}`);

      // 2. Execute on node server
      console.log(`[ExecuteModule] Sending execution request to ${systemHost}:3001`);
      const executeResponse = await fetch(`http://${systemHost}:3001/api/configs/${moduleConfig.module}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: config.content,
          name: moduleConfig.configId
        }),
      });

      if (!executeResponse.ok) {
        throw new Error(`Execution failed: ${executeResponse.statusText}`);
      }

      const result = await executeResponse.json();
      console.log(`[ExecuteModule] Execution result for ${moduleConfig.module}:`, result);

      step.endTime = new Date();
      step.duration = (step.endTime.getTime() - step.startTime.getTime()) / 1000;

      if (result.copySuccess && (result.restartSuccess || moduleConfig.module === 'ue_db')) {
        step.status = 'success';
      } else {
        step.status = 'failure';
        step.error = result.restartError || 'Failed to execute configuration';
      }

      return step;
    } catch (error) {
      console.error(`[ExecuteModule] Error executing ${moduleConfig.module}:`, error);
      step.status = 'failure';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.endTime = new Date();
      step.duration = (step.endTime.getTime() - step.startTime.getTime()) / 1000;
      return step;
    }
  }

  private getExecutionOrder(topology: string): string[] {
    const order = {
      'callbox': ['mme', 'ims', 'ue_db', 'enb'],
      'core': ['mme', 'ims', 'ue_db'],
      'ue-core': ['core', 'enb', 'ue']
    }[topology] || [];
    
    console.log(`[GetExecutionOrder] Order for topology ${topology}:`, order);
    return order;
  }
}

export const executionService = new ExecutionService();
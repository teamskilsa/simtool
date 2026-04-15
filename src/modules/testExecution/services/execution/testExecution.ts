// services/testExecution.ts
import { ExecutionStatus } from '../types';

interface ExecutionStep {
  id: string;
  name: string;
  status: ExecutionStatus;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

interface ModuleExecution {
  module: string;
  configName: string;
  result?: {
    copySuccess: boolean;
    copyMessage: string;
    restartSuccess: boolean;
    restartError?: string;
    portStatus: boolean;
  };
}

class TestExecutionService {
  private async executeModule(moduleConfig: ModuleExecution): Promise<ExecutionStep> {
    const step: ExecutionStep = {
      id: `${moduleConfig.module}-${Date.now()}`,
      name: `Execute ${moduleConfig.module}`,
      status: 'running',
      startTime: new Date()
    };

    try {
      // 1. First fetch the configuration content
      const configResponse = await fetch(`/api/configs/${moduleConfig.module}/${moduleConfig.configName}`);
      if (!configResponse.ok) {
        throw new Error(`Failed to fetch configuration: ${configResponse.statusText}`);
      }
      const config = await configResponse.json();

      // 2. Execute the configuration on the node server
      const executeResponse = await fetch(`http://localhost:3001/api/configs/${moduleConfig.module}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: config.content,
          name: config.name
        }),
      });

      if (!executeResponse.ok) {
        throw new Error(`Execution failed: ${executeResponse.statusText}`);
      }

      const result = await executeResponse.json();
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
      step.status = 'failure';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.endTime = new Date();
      step.duration = (step.endTime.getTime() - step.startTime.getTime()) / 1000;
      return step;
    }
  }

  async executeScenario(scenarioId: string): Promise<ExecutionStep[]> {
    // 1. Fetch scenario details
    const response = await fetch(`/api/scenarios/${scenarioId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch scenario details');
    }
    const scenario = await response.json();

    // 2. Execute modules in the correct order based on topology
    const executionOrder = this.getExecutionOrder(scenario.topology);
    const steps: ExecutionStep[] = [];

    for (const module of executionOrder) {
      const moduleConfig = scenario.moduleConfigs.find((c: any) => c.module === module);
      if (moduleConfig) {
        const step = await this.executeModule({
          module: moduleConfig.module,
          configName: moduleConfig.configId
        });
        steps.push(step);

        // If a step fails, stop the execution
        if (step.status === 'failure') {
          break;
        }
      }
    }

    return steps;
  }

  private getExecutionOrder(topology: string): string[] {
    switch (topology) {
      case 'callbox':
        return ['mme', 'ims', 'ue_db', 'enb'];
      case 'core':
        return ['mme', 'ims', 'ue_db'];
      case 'ue-core':
        return ['core', 'enb', 'ue'];
      default:
        return [];
    }
  }
}

export const testExecutionService = new TestExecutionService();
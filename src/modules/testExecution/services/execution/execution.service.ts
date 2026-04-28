// services/execution/execution.service.ts
// Deploys config files to the target system via SSH and restarts Amarisoft services.
// Calls /api/systems/config-deploy (server-side SSH) — no more direct agent calls.
import { ExecutionStep } from '../../types/execution.types';

/** SSH credentials passed in at execution time from the system store */
export interface SshCredentials {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

class ExecutionService {
  /**
   * Execute a scenario: deploy each module config via SSH then restart services.
   *
   * @param scenarioId  ID of the scenario to run
   * @param sshCreds    SSH credentials for the target system
   */
  async executeScenario(scenarioId: string, sshCreds: SshCredentials): Promise<ExecutionStep[]> {
    console.log(`[ExecuteScenario] Starting execution for scenario: ${scenarioId}`);

    // 1. Fetch scenario details
    const response = await fetch(`/api/scenarios/execute?id=${encodeURIComponent(scenarioId)}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Failed to fetch scenario details');
    }
    const scenario = await response.json();
    console.log('[ExecuteScenario] Retrieved scenario:', scenario);

    // 2. Execute modules in order
    const steps: ExecutionStep[] = [];
    const modules = this.getExecutionOrder(scenario.topology);

    for (const module of modules) {
      const moduleConfig = scenario.moduleConfigs?.find((c: any) => c.module === module);
      if (!moduleConfig) {
        console.warn(`[ExecuteScenario] No config found for module: ${module}`);
        continue;
      }

      const step = await this.deployModule(module, moduleConfig.configContent, sshCreds);
      steps.push(step);

      if (step.status === 'failure') {
        console.error(`[ExecuteScenario] Module ${module} failed — stopping`);
        break;
      }
    }

    return steps;
  }

  /**
   * Deploy a single module: SCP config to remote then restart the service.
   * Uses /api/systems/config-deploy (Next.js server-side SSH, not the agent).
   */
  async deployModule(
    module: string,
    configContent: string,
    sshCreds: SshCredentials
  ): Promise<ExecutionStep> {
    const step: ExecutionStep = {
      id: `${module}-${Date.now()}`,
      name: `Deploy ${module}`,
      status: 'running',
      startTime: new Date(),
    };

    try {
      const res = await fetch('/api/systems/config-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sshCreds,
          module,
          configContent,
        }),
      });

      const result = await res.json();
      step.endTime = new Date();
      step.duration = (step.endTime.getTime() - step.startTime!.getTime()) / 1000;

      if (result.copySuccess && result.restartSuccess) {
        step.status = result.portStatus ? 'success' : 'failure';
        if (!result.portStatus) step.error = `Service started but port not listening`;
      } else {
        step.status = 'failure';
        step.error = result.restartError || result.copyMessage || 'Deploy failed';
      }
    } catch (error) {
      step.status = 'failure';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.endTime = new Date();
      step.duration = (step.endTime.getTime() - step.startTime!.getTime()) / 1000;
    }

    return step;
  }

  private getExecutionOrder(topology: string): string[] {
    // IDs must match TOPOLOGY_OPTIONS in
    //   src/modules/testExecution/components/ScenarioCreator/constants.ts
    // Order matters: core (MME/IMS/UE_DB) starts BEFORE the radio side (eNB/gNB)
    // so the eNB has somewhere to register. UE comes LAST.
    return ({
      callbox:  ['mme', 'ims', 'ue_db', 'enb'],
      core:     ['mme', 'ims', 'ue_db'],
      'ue-core':['mme', 'ue_db', 'enb', 'ue'],
    } as Record<string, string[]>)[topology] ?? [];
  }
}

export const executionService = new ExecutionService();
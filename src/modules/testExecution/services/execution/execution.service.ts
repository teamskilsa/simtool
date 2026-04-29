// services/execution/execution.service.ts
// Deploys config files to the target system via SSH and restarts Amarisoft services.
// Calls /api/systems/config-deploy (server-side SSH) — no more direct agent calls.
import { ExecutionStep } from '../../types/execution.types';
import { configService } from '../config/config.service';

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
   * Execute a scenario: for each module in the topology, look up the config
   * the user picked, fetch its file content, then SCP+restart on the target.
   *
   * Two non-obvious bits this fixes vs. earlier code:
   *   1. Scenarios store module rows under `moduleId` (not `module`); the
   *      old lookup used `c.module === module` and never matched, so deploy
   *      silently skipped every module.
   *   2. Module rows store `configId` only — a *reference*. The old code
   *      tried to read `moduleConfig.configContent`, which doesn't exist;
   *      we now resolve the id against the configs API to get the actual
   *      file content to ship.
   *
   * @param scenarioId  ID of the scenario to run
   * @param sshCreds    SSH credentials for the target system
   */
  async executeScenario(scenarioId: string, sshCreds: SshCredentials): Promise<ExecutionStep[]> {
    console.log(`[ExecuteScenario] Starting execution for scenario: ${scenarioId}`);

    // 1. Fetch scenario.
    const response = await fetch(`/api/scenarios/execute?id=${encodeURIComponent(scenarioId)}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Failed to fetch scenario details');
    }
    const scenario = await response.json();

    // 2. Pull all configs once so we can resolve configId → content per
    //    module without a round-trip per step.
    const allConfigs = await configService.getAllConfigs().catch(() => null);
    if (!allConfigs) {
      throw new Error('Could not load configs from the configs API');
    }

    // 3. Execute modules in topology order.
    const steps: ExecutionStep[] = [];
    const modules = this.getExecutionOrder(scenario.topology);

    for (const module of modules) {
      const row = (scenario.moduleConfigs ?? []).find(
        (c: any) => (c.moduleId ?? c.module) === module && c.enabled !== false,
      );
      if (!row || !row.configId) continue;

      const moduleConfigs = (allConfigs as any)[module] ?? [];
      const stored = moduleConfigs.find((c: any) => c.id === row.configId);
      if (!stored) {
        steps.push({
          id: `${module}-${Date.now()}`,
          name: `Deploy ${module}`,
          status: 'failure',
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          error: `Config ${row.configId} for module "${module}" was not found — was it deleted?`,
        });
        break;
      }
      if (typeof stored.content !== 'string' || stored.content.length === 0) {
        steps.push({
          id: `${module}-${Date.now()}`,
          name: `Deploy ${module}`,
          status: 'failure',
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          error: `Config "${stored.name}" has empty content`,
        });
        break;
      }

      const step = await this.deployModule(module, stored.content, sshCreds);
      step.name = `Deploy ${module} (${stored.name})`;
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

      // Forward the diagnostic surface from the API verbatim — phase tag,
      // tail of restart output, and the full per-command log. Without
      // this the UI could only ever say "Deploy failed" no matter what
      // actually went wrong; with it the user can see "sudo: no tty
      // present" or "config/enb.cfg:44:16: field 'cell_id': range is
      // [0:255]" inline.
      step.phase = result.phase;
      step.output = result.output;
      step.commandLog = result.commandLog;

      const isSuccess = result.copySuccess && result.restartSuccess && result.portStatus;
      if (isSuccess) {
        step.status = 'success';
      } else {
        step.status = 'failure';
        // Prefer the API's high-level `error` message (it's already
        // composed for human reading); fall back through restartError /
        // copyMessage / a generic placeholder.
        step.error =
          result.error
          || result.restartError
          || (!result.copySuccess && result.copyMessage)
          || (!result.portStatus && result.restartSuccess && `Service started but port did not come up`)
          || 'Deploy failed (no error details from server — check the network tab)';
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
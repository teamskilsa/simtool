// hooks/scenario/useScenarioRun.ts
//
// Owns a scenario run so the progress view can live at the page level
// instead of inside a table row. The pre-flight checks moved here from
// ScenarioCard verbatim — they're the difference between "Deploy failed"
// and "this scenario points at a system you deleted".
import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import { executionService } from '@/modules/testExecution/services';
import type { ExecutionStep } from '@/modules/testExecution/types/execution.types';

export interface RunnableScenario {
  id: string;
  name: string;
  topology: string;
  system?: { id: string; name: string; host: string; port: string };
  moduleConfigs?: Array<{
    moduleId: string;
    configId: string;
    enabled: boolean;
    ipAddress?: string;
  }>;
}

export interface ActiveRun {
  scenario: RunnableScenario;
  steps: ExecutionStep[];
  isRunning: boolean;
  /** Set when the run never produced steps (pre-flight or fetch failure). */
  fatalError: string | null;
  target?: { name: string; host: string };
}

export function useScenarioRun(onFinished?: () => void) {
  const { toast } = useToast();
  const { systems } = useSystems();
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);

  const startRun = useCallback(async (scenario: RunnableScenario) => {
    // ── Pre-flight. Each of these is a distinct, actionable misconfiguration;
    //    surfacing them as a fatal error on the run page (rather than only a
    //    toast) means the user still sees WHY after the toast disappears.
    const fail = (msg: string) => {
      setActiveRun({
        scenario,
        steps: [],
        isRunning: false,
        fatalError: msg,
        target: scenario.system ? { name: scenario.system.name, host: scenario.system.host } : undefined,
      });
      toast({ title: 'Cannot run scenario', description: msg, variant: 'destructive' });
    };

    if (!scenario.id) return fail('Invalid scenario configuration (no id).');
    if (!scenario.system?.id) {
      return fail('This scenario has no target system. Edit it and pick one from Test Systems.');
    }
    const sys = systems.find(s => String(s.id) === String(scenario.system!.id));
    if (!sys) {
      return fail(
        `The scenario points at system "${scenario.system.name}", which is no longer in your systems list. ` +
        'Edit the scenario or re-add the system.',
      );
    }
    if (!sys.username || (!sys.password && !sys.privateKey)) {
      return fail(`System "${sys.name}" has no SSH credentials set. Add them in Test Systems before running.`);
    }
    const enabled = (scenario.moduleConfigs ?? []).filter(c => c.enabled && c.configId);
    if (enabled.length === 0) {
      return fail('No enabled modules with a config selected. Edit the scenario and pick at least one.');
    }

    const target = { name: sys.name, host: sys.ip };
    setActiveRun({ scenario, steps: [], isRunning: true, fatalError: null, target });

    try {
      const finalSteps = await executionService.executeScenario(
        scenario.id,
        {
          host: sys.ip,
          port: sys.sshPort ?? 22,
          username: sys.username,
          ...(sys.authMode === 'privateKey' && sys.privateKey
            ? { privateKey: sys.privateKey }
            : { password: sys.password ?? '' }),
        },
        // Live progress — this is what makes the page update step by step
        // instead of sitting blank until the whole run resolves.
        (steps) => {
          setActiveRun(prev => (prev ? { ...prev, steps } : prev));
        },
      );

      setActiveRun(prev => (prev ? { ...prev, steps: finalSteps, isRunning: false } : prev));

      if (finalSteps.length === 0) {
        setActiveRun(prev => prev ? {
          ...prev,
          fatalError: 'No deploy steps ran. The scenario may reference module names that no longer exist.',
        } : prev);
        return;
      }

      const failed = finalSteps.find(s => s.status === 'failure');
      if (failed) {
        toast({
          title: 'Execution failed',
          description: `${failed.name}: ${failed.error ?? 'unknown error'}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Execution complete',
          description: `${finalSteps.length} step${finalSteps.length === 1 ? '' : 's'} succeeded.`,
        });
      }
      onFinished?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error occurred';
      setActiveRun(prev => (prev ? { ...prev, isRunning: false, fatalError: msg } : prev));
      toast({ title: 'Execution error', description: msg, variant: 'destructive' });
    }
  }, [systems, toast, onFinished]);

  const clearRun = useCallback(() => setActiveRun(null), []);

  return { activeRun, startRun, clearRun };
}

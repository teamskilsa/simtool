import { useState, useCallback } from 'react';
import { ScenarioConfig, TestComponent } from '../../types';
import { scenarioService } from '../../services';
import { useToast } from '@/components/ui/use-toast';

export const useScenarioConfig = (initialScenario?: ScenarioConfig) => {
  const [scenario, setScenario] = useState<ScenarioConfig | null>(initialScenario || null);
  const { toast } = useToast();

  const loadScenario = useCallback(async (id: string) => {
    try {
      const loadedScenario = await scenarioService.getScenario(id);
      setScenario(loadedScenario);
      return loadedScenario;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load scenario',
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  const updateComponents = useCallback(async (components: TestComponent[]) => {
    if (!scenario) return;

    try {
      await scenarioService.updateScenarioComponents(scenario.id, components);
      setScenario(prev => prev ? { ...prev, components } : null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update components',
        variant: 'destructive'
      });
      throw error;
    }
  }, [scenario, toast]);

  return {
    scenario,
    setScenario,
    loadScenario,
    updateComponents
  };
};

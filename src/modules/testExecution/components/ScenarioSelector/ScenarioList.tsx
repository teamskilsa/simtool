// components/ScenarioSelector/ScenarioList.tsx
//
// Loading semantics: the first fetch shows a centered spinner so the user
// has something while the list is empty; subsequent refetches (after a
// Duplicate / Delete / Run) leave the existing rows on screen and update
// in place. Earlier code blanked the whole table on every refetch, which
// flashed and felt broken.
import React, { useEffect, useRef, useState } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScenarioCard } from './ScenarioCard';
import { useToast } from '@/components/ui/use-toast';

interface Scenario {
  id: string;
  name: string;
  topology: string;
  moduleConfigs: Array<{
    moduleId: string;
    configId: string;
    enabled: boolean;
    ipAddress?: string;
  }>;
  ipConfig: { common?: string; [key: string]: string | undefined };
  system?: { id: string; name: string; host: string; port: string };
  createdAt: string;
  lastRun?: string;
}

interface ScenarioListProps {
  className?: string;
  /** Bumping this number triggers a refetch without remounting. Lets the
   *  parent (e.g. TestExecutionView after a successful Create) refresh
   *  the list without blanking the existing rows. */
  refreshTrigger?: number;
}

export function ScenarioList({ refreshTrigger }: ScenarioListProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);
  const [, forceRender] = useState(0);
  const { toast } = useToast();

  const fetchScenarios = async () => {
    try {
      setError(null);
      const response = await fetch('/api/scenarios');
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || `HTTP ${response.status} from /api/scenarios`);
      }
      const data = await response.json();
      setScenarios(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error fetching scenarios';
      console.error('[ScenarioList] fetch failed:', err);
      setError(msg);
      // Only toast once per failure spurt, not on every refetch — and
      // include the actual reason so the user knows whether it's a 500,
      // a network error, or something else.
      toast({
        title: 'Could not load scenarios',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      initialLoadDone.current = true;
      forceRender((n) => n + 1);
    }
  };

  useEffect(() => {
    fetchScenarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // First load: centered spinner so the user isn't staring at an empty
  // table while we wait. Subsequent refreshes leave the current rows on
  // screen — no spinner, no blank flash.
  if (!initialLoadDone.current) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead className="min-w-[200px]">Test Scenario</TableHead>
              <TableHead className="min-w-[150px]">Modules</TableHead>
              <TableHead className="min-w-[200px]">System/IP</TableHead>
              <TableHead className="min-w-[250px]">Configurations</TableHead>
              <TableHead className="min-w-[120px]">Created</TableHead>
              <TableHead className="min-w-[120px]">Last Run</TableHead>
              <TableHead className="text-right w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenarios.map((scenario, index) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                index={index + 1}
                onRefresh={fetchScenarios}
              />
            ))}
          </TableBody>
        </Table>

        {scenarios.length === 0 && !error && (
          <div className="text-center text-muted-foreground py-8 text-sm">
            No scenarios yet — click <span className="font-medium">Create Scenario</span> above
            to define a multi-component run.
          </div>
        )}

        {error && (
          <div className="text-center py-8 px-4 space-y-2">
            <p className="text-sm font-medium text-destructive">Couldn't load scenarios</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <button
              onClick={fetchScenarios}
              className="text-xs underline text-muted-foreground hover:text-foreground"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

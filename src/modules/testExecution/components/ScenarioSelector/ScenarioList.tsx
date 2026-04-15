// components/ScenarioSelector/ScenarioList.tsx
import React, { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScenarioCard } from './ScenarioCard';
import { ScenarioCreator } from '../ScenarioCreator';
import { useToast } from '@/components/ui/use-toast';

interface ScenarioListProps {
  className?: string;
}

export function ScenarioList({ className }: ScenarioListProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchScenarios = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scenarios');
      if (!response.ok) {
        throw new Error('Failed to fetch scenarios');
      }
      const data = await response.json();
      console.log('Fetched scenarios:', data);
      setScenarios(data);
    } catch (error) {
      console.error('Error fetching scenarios:', error);
      toast({
        title: "Error",
        description: "Failed to load scenarios",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scenarios Table */}
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

        {scenarios.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No scenarios available. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
// views/TestExecution/TestExecutionView.tsx
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ScenarioList } from '@/modules/testExecution/components/ScenarioSelector';
import { CreateScenarioDialog } from '@/modules/testExecution/components/ScenarioCreator/CreateScenarioDialog';
import { useToast } from '@/components/ui/use-toast';
import type { ScenarioConfig } from '@/modules/testExecution/components/ScenarioCreator/types';

export function TestExecutionView() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioConfig | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  const handleSaveScenario = async (data: ScenarioConfig) => {
    const url = '/api/scenarios';
    const method = dialogMode === 'create' ? 'POST' : 'PUT';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          dialogMode === 'edit' 
            ? { ...data, id: selectedScenario?.id } 
            : data
        ),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${dialogMode} scenario`);
      }

      return response.json();
    } catch (error) {
      console.error('Error saving scenario:', error);
      throw error;
    }
  };

  const handleCreateClick = () => {
    setDialogMode('create');
    setSelectedScenario(undefined);
    setDialogOpen(true);
  };

  const handleEditScenario = (scenario: ScenarioConfig) => {
    setDialogMode('edit');
    setSelectedScenario(scenario);
    setDialogOpen(true);
  };

  return (
    <Card className="bg-background/60 backdrop-blur-sm border-muted/20">
      <div className="border-b border-muted/20">
        <div className="flex items-center justify-between p-6">
          <h2 className="text-2xl font-bold">Test Scenarios</h2>
          <Button
            onClick={handleCreateClick}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Scenario
          </Button>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="scenarios" className="w-full">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="mt-4">
            <ScenarioList 
              key={refreshKey}
              onEditScenario={handleEditScenario}
            />
          </TabsContent>

          <TabsContent value="templates">
            {/* Templates content */}
          </TabsContent>
        </Tabs>
      </div>

      <CreateScenarioDialog
        open={dialogOpen}
        mode={dialogMode}
        initialData={selectedScenario}
        onOpenChange={setDialogOpen}
        onSave={handleSaveScenario}
        onSuccess={() => {
          setRefreshKey(prev => prev + 1);
        }}
      />
    </Card>
  );
}
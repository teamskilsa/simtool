// Two-mode Test Execution view.
//
//   Quick Run — single config + system + click. The 80% case for callbox
//               users who already have core running and just want to swap
//               the radio. After deploy, hand off to the monitoring
//               dashboard with the system pre-selected.
//
//   Scenarios — multi-component runs (e.g. callbox topology = mme + ims +
//               ue_db + enb in order). For when you're bringing the whole
//               stack up from cold, or saving a known-good combo to
//               replay later.
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ScenarioList } from '@/modules/testExecution/components/ScenarioSelector';
import { CreateScenarioDialog } from '@/modules/testExecution/components/ScenarioCreator/CreateScenarioDialog';
import { QuickRunPanel } from './components/QuickRun/QuickRunPanel';
import type { ScenarioConfig } from '@/modules/testExecution/components/ScenarioCreator/types';

export function TestExecutionView() {
  const [activeTab, setActiveTab] = useState<'quick' | 'scenarios'>('quick');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioConfig | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaveScenario = async (data: ScenarioConfig) => {
    const url = '/api/scenarios';
    const method = dialogMode === 'create' ? 'POST' : 'PUT';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        dialogMode === 'edit' ? { ...data, id: selectedScenario?.id } : data,
      ),
    });
    if (!response.ok) throw new Error(`Failed to ${dialogMode} scenario`);
    return response.json();
  };

  const handleCreateClick = () => {
    setDialogMode('create');
    setSelectedScenario(undefined);
    setDialogOpen(true);
  };

  // Edit / delete / duplicate from a row are handled inside ScenarioActions
  // (it owns its own Edit dialog wired to the same /api/scenarios PUT).
  // This view only owns the *Create* path through the header button — Edit
  // from a row doesn't bubble back here.

  return (
    <Card className="bg-background/60 backdrop-blur-sm border-muted/20">
      <div className="border-b border-muted/20">
        <div className="flex items-center justify-between p-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Test Execution</h2>
            <p className="text-sm text-muted-foreground">
              Run a single config, or chain a multi-component scenario.
            </p>
          </div>

          {/* The Create Scenario button only makes sense on the Scenarios
              tab — Quick Run doesn't need a "save" step. */}
          {activeTab === 'scenarios' && (
            <Button
              onClick={handleCreateClick}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Scenario
            </Button>
          )}
        </div>
      </div>

      <div className="p-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'quick' | 'scenarios')}
          className="w-full"
        >
          <TabsList className="bg-muted/50">
            <TabsTrigger value="quick">Quick Run</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <QuickRunPanel />
          </TabsContent>

          <TabsContent value="scenarios" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Multi-component runs — define a topology (e.g. callbox =
              mme + ims + ue_db + enb), pick a config per module, save as
              a scenario, then re-run from this list.
            </p>
            <ScenarioList refreshTrigger={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>

      <CreateScenarioDialog
        open={dialogOpen}
        mode={dialogMode}
        initialData={selectedScenario}
        onOpenChange={setDialogOpen}
        onSave={handleSaveScenario}
        onSuccess={() => setRefreshKey((p) => p + 1)}
      />
    </Card>
  );
}

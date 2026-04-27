// modules/systems/components/list/index.tsx
'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { SystemsHeader } from './header';
import { SystemsFilters } from './filters';
import { SystemsTable } from './table';
import { useSystems } from '../../hooks/use-systems';
import { useSystemsFilter } from '../../hooks/use-filters';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../../types';

export function SystemsListView() {
  const {
    systems,
    connections,
    monitoring,
    startMonitoring,
    stopMonitoring,
    addSystem,
    updateSystem,
    updateSystemProvisionStatus,
    deleteSystem,
    refreshSystem,
    refreshAllSystems,
  } = useSystems();

  const { filters, setFilters, filteredSystems } = useSystemsFilter(systems);

  const handleAddSystem = async (systemData: Partial<System>): Promise<System> => {
    return await addSystem(systemData);
  };

  const handleProvisionComplete = (
    systemId: number,
    result: { success: boolean; error?: string; steps: any[]; failedStep?: string },
  ) => {
    updateSystemProvisionStatus(systemId, {
      provisionStatus: result.success ? 'success' : 'failed',
      provisionError: result.error,
      provisionSteps: result.steps,
      provisionedAt: Date.now(),
      provisionFailedStep: result.failedStep,
    });
  };

  const handleEditSystem = async (systemId: number, updates: Partial<System>) => {
    try {
      await updateSystem(systemId, updates);
      toast({ title: "System Updated", description: "System has been updated successfully." });
    } catch (error) {
      toast({ title: "Error Updating System", description: error instanceof Error ? error.message : "Failed to update system", variant: "destructive" });
      throw error;
    }
  };

  const handleDeleteSystem = async (systemId: number) => {
    try {
      await deleteSystem(systemId);
      toast({ title: "System Deleted", description: "System has been deleted successfully." });
    } catch (error) {
      toast({ title: "Error Deleting System", description: error instanceof Error ? error.message : "Failed to delete system", variant: "destructive" });
      throw error;
    }
  };

  const handleStartMonitoring = async (duration: number, interval: number) => {
    try {
      await startMonitoring(duration, interval);
      toast({ title: "Monitoring Started", description: `Running for ${duration}s every ${interval}s.` });
    } catch (error) {
      toast({ title: "Error Starting Monitoring", description: error instanceof Error ? error.message : "Failed to start monitoring", variant: "destructive" });
      throw error;
    }
  };

  const handleStopMonitoring = async () => {
    try {
      await stopMonitoring();
      toast({ title: "Monitoring Stopped", description: "System monitoring has been stopped." });
    } catch (error) {
      toast({ title: "Error Stopping Monitoring", description: error instanceof Error ? error.message : "Failed to stop monitoring", variant: "destructive" });
      throw error;
    }
  };

  const handleRefreshSystem = async (systemId: number) => {
    try {
      await refreshSystem(systemId);
      toast({ title: "System Refreshed", description: "System data has been updated." });
    } catch (error) {
      toast({ title: "Refresh Failed", description: error instanceof Error ? error.message : "Failed to refresh system", variant: "destructive" });
      throw error;
    }
  };

  const handleRefreshAll = async () => {
    try {
      await refreshAllSystems();
      toast({ title: "All Systems Refreshed", description: "All system data has been updated." });
    } catch (error) {
      toast({ title: "Refresh Failed", description: error instanceof Error ? error.message : "Failed to refresh systems", variant: "destructive" });
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <SystemsHeader
        count={filteredSystems.length}
        onAddSystem={handleAddSystem}
        onRefreshAll={handleRefreshAll}
        onProvisionComplete={handleProvisionComplete}
      />

      {/* Main Content */}
      <div className="p-6">
        <Card className="overflow-hidden shadow-sm">
          {/* Filters bar */}
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <SystemsFilters
              filters={filters}
              setFilters={setFilters}
              monitoring={monitoring}
              onStartMonitoring={handleStartMonitoring}
              onStopMonitoring={handleStopMonitoring}
            />
          </div>

          {/* Table */}
          <div className="p-0">
            <SystemsTable
              systems={filteredSystems}
              connections={connections}
              onRefreshSystem={handleRefreshSystem}
              onEditSystem={handleEditSystem}
              onDeleteSystem={handleDeleteSystem}
              onProvisionComplete={handleProvisionComplete}
              updateSystemProvisionStatus={updateSystemProvisionStatus}
              onAddSystem={handleAddSystem}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

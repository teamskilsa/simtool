// modules/systems/components/list/index.tsx
import React from 'react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { SystemsHeader } from './header';
import { SystemsFilters } from './filters';
import { SystemsTable } from './table';  // Changed from './table'
import { useSystems } from '../../hooks/use-systems';
import { useSystemsFilter } from '../../hooks/use-filters';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../../types';

export function SystemsListView() {
  const { theme, mode } = useTheme();
  const themeConfig = themes[theme];
  
  const { 
    systems, 
    connections,
    monitoring,
    startMonitoring, 
    stopMonitoring,
    addSystem,
    updateSystem,
    deleteSystem,
    refreshSystem,
    refreshAllSystems,
    connectSystem
  } = useSystems();
  
  const { filters, setFilters, filteredSystems } = useSystemsFilter(systems);

  // Handle adding a new system
  const handleAddSystem = async (systemData: Partial<System>) => {
    try {
      const newSystem = await addSystem(systemData);
      toast({
        title: "System Added",
        description: "New system has been added successfully.",
      });
      // Connect the system if needed
      if (newSystem) {
        connectSystem(newSystem);
      }
    } catch (error) {
      toast({
        title: "Error Adding System",
        description: error instanceof Error ? error.message : "Failed to add system",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle editing an existing system
  const handleEditSystem = async (systemId: number, updates: Partial<System>) => {
    try {
      await updateSystem(systemId, updates);
      toast({
        title: "System Updated",
        description: "System has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error Updating System",
        description: error instanceof Error ? error.message : "Failed to update system",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle deleting a system
  const handleDeleteSystem = async (systemId: number) => {
    try {
      await deleteSystem(systemId);
      toast({
        title: "System Deleted",
        description: "System has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error Deleting System",
        description: error instanceof Error ? error.message : "Failed to delete system",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle starting system monitoring
  const handleStartMonitoring = async (duration: number, interval: number) => {
    try {
      await startMonitoring(duration, interval);
      toast({
        title: "Monitoring Started",
        description: `Monitoring will run for ${duration} seconds with ${interval} second intervals.`,
      });
    } catch (error) {
      toast({
        title: "Error Starting Monitoring",
        description: error instanceof Error ? error.message : "Failed to start monitoring",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle stopping system monitoring
  const handleStopMonitoring = async () => {
    try {
      await stopMonitoring();
      toast({
        title: "Monitoring Stopped",
        description: "System monitoring has been stopped.",
      });
    } catch (error) {
      toast({
        title: "Error Stopping Monitoring",
        description: error instanceof Error ? error.message : "Failed to stop monitoring",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle refreshing a single system
  const handleRefreshSystem = async (systemId: number) => {
    try {
      await refreshSystem(systemId);
      toast({
        title: "System Refreshed",
        description: "System data has been updated.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Failed to refresh system",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle refreshing all systems
  const handleRefreshAll = async () => {
    try {
      await refreshAllSystems();
      toast({
        title: "All Systems Refreshed",
        description: "All system data has been updated.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Failed to refresh systems",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Background with grid pattern */}
      <div className="fixed inset-0 bg-gradient-to-br from-background to-muted -z-10">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(to right, ${mode === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'} 1px, transparent 1px),
              linear-gradient(to bottom, ${mode === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'} 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
            opacity: 0.4
          }}
        />
      </div>

      <div className="relative">
        {/* Header Section */}
        <SystemsHeader 
          count={filteredSystems.length} 
          onAddSystem={handleAddSystem}
          onRefreshAll={handleRefreshAll}
        />
        
        {/* Main Content */}
        <div className="p-6">
          <div className={`
            rounded-xl 
            shadow-lg
            backdrop-blur-md
            ${themeConfig.surfaces.card.background}
            ${themeConfig.surfaces.card.border}
            ${themeConfig.effects.glass.medium}
          `}>
            {/* Filters Section */}
            <div className={`
              px-6 py-4 
              border-b 
              backdrop-blur-sm
              ${themeConfig.surfaces.card.border}
            `}>
              <SystemsFilters 
                filters={filters} 
                setFilters={setFilters}
                monitoring={monitoring}
                onStartMonitoring={handleStartMonitoring}
                onStopMonitoring={handleStopMonitoring}
              />
            </div>

            {/* Table Section */}
            <div className="p-6">
              <SystemsTable 
                systems={filteredSystems}
                connections={connections}
                onRefreshSystem={handleRefreshSystem}
                onEditSystem={handleEditSystem}
                onDeleteSystem={handleDeleteSystem}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
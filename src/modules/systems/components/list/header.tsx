// modules/systems/components/list/header.tsx
import { useState } from 'react';
import { Signal, RefreshCw } from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import { THEME_CHROME_BG } from '@/components/theme/utils/theme-chrome';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { AddSystem } from '../add-system';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../types';
import type { ProvisionResult } from '../services/provision';

interface SystemsHeaderProps {
  count: number;
  onAddSystem: (system: Partial<System>) => Promise<System | void>;
  onRefreshAll: () => Promise<void>;
  onProvisionComplete?: (systemId: number, result: ProvisionResult) => void;
}

export function SystemsHeader({ count, onAddSystem, onRefreshAll, onProvisionComplete }: SystemsHeaderProps) {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const accentBg = THEME_CHROME_BG[theme] ?? 'bg-indigo-600';

  const handleRefreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefreshAll();
      toast({ title: "Systems Refreshed", description: "All systems have been refreshed successfully." });
    } catch (error) {
      toast({ title: "Refresh Failed", description: error instanceof Error ? error.message : "Failed to refresh systems", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-10">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${accentBg}`}>
              <Signal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Systems</h1>
              <p className="text-sm text-muted-foreground">
                {count} {count === 1 ? 'system' : 'systems'} found
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshAll}
                    disabled={refreshing}
                    className="focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh all systems</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <AddSystem
              onAddSystem={onAddSystem}
              onProvisionComplete={onProvisionComplete}
            />
          </div>
        </div>
      </div>

      {/* Progress bar while refreshing */}
      {refreshing && (
        <div className="h-0.5 relative overflow-hidden bg-muted">
          <div className={`absolute inset-0 ${accentBg} animate-progress`} />
        </div>
      )}
    </div>
  );
}

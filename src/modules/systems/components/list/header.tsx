// modules/systems/components/header.tsx
import { useState } from 'react';
import { Signal, RefreshCw } from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { AddSystem } from '../add-system';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../types';

interface SystemsHeaderProps {
  count: number;
  onAddSystem: (system: Partial<System>) => Promise<void>;
  onRefreshAll: () => Promise<void>;
}

export function SystemsHeader({ count, onAddSystem, onRefreshAll }: SystemsHeaderProps) {
  const { theme, mode } = useTheme();
  const themeConfig = themes[theme];
  const [refreshing, setRefreshing] = useState(false);

  const getThemeColor = () => {
    switch (theme) {
      case 'teal': return 'bg-teal-600 hover:bg-teal-700';
      case 'rose': return 'bg-rose-600 hover:bg-rose-700';
      case 'light': return 'bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900';
      default: return 'bg-indigo-600 hover:bg-indigo-700';
    }
  };

  const handleRefreshAll = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      await onRefreshAll();
      toast({
        title: "Systems Refreshed",
        description: "All systems have been refreshed successfully",
      });
    } catch (error) {
      console.error('Failed to refresh systems:', error);
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Failed to refresh systems",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div 
      className={`
        border-b 
        ${themeConfig.surfaces.card.border} 
        bg-white/80 dark:bg-gray-900/80 
        backdrop-blur-xl
        sticky top-0 z-10
      `}
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Title and Count */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${getThemeColor()}`}>
              <Signal className="w-5 h-5 text-white dark:text-gray-900" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Systems
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {count} {count === 1 ? 'system' : 'systems'} found
              </p>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefreshAll}
                    disabled={refreshing}
                    className={`
                      bg-white/50 dark:bg-gray-800/50
                      hover:bg-white/80 dark:hover:bg-gray-800/80
                      transition-all
                      ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <RefreshCw className={`
                      w-4 h-4 
                      ${refreshing ? 'animate-spin' : ''}
                      transition-transform
                      hover:scale-110
                    `} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh all systems</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <AddSystem onAddSystem={onAddSystem} />
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {refreshing && (
        <div className="h-0.5 relative overflow-hidden bg-gray-100 dark:bg-gray-800">
          <div className="absolute inset-0 bg-indigo-500 dark:bg-indigo-400 animate-progress"></div>
        </div>
      )}
    </div>
  );
}
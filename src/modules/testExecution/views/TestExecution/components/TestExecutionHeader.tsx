// components/TestExecutionHeader.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestExecutionHeaderProps {
  onCreateClick: () => void;
}

export function TestExecutionHeader({ onCreateClick }: TestExecutionHeaderProps) {
  const handleClick = () => {
    console.log('Header create button clicked'); // Debug log
    onCreateClick();
  };

  return (
    <div className={cn(
      "flex items-center justify-between",
      "rounded-lg p-4",
      "bg-gradient-to-r from-background/80 to-muted/50",
      "border shadow-sm"
    )}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Test Scenarios</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage test execution scenarios
          </p>
        </div>
      </div>
      <Button 
        onClick={handleClick}
        className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
      >
        <Plus className="w-4 h-4 mr-2" />
        Create Scenario
      </Button>
    </div>
  );
}
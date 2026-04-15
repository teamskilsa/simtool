// views/TestExecution/components/ScenarioSelector/ExecutionLogs.tsx
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExecutionStep } from '@/modules/testExecution/types/execution.types';

interface ExecutionLogsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioName: string;
  steps: ExecutionStep[];
}

export function ExecutionLogs({ open, onOpenChange, scenarioName, steps }: ExecutionLogsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Execution Logs - {scenarioName}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[400px] mt-4">
          {steps.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No execution logs available
            </div>
          ) : (
            <div className="space-y-2">
              {steps.map(step => (
                <div 
                  key={step.id} 
                  className={cn(
                    "p-4 rounded-lg border",
                    step.status === 'success' && "border-green-500",
                    step.status === 'failure' && "border-red-500",
                    step.status === 'running' && "border-blue-500 animate-pulse"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{step.name}</span>
                    <Badge variant={
                      step.status === 'success' ? 'success' :
                      step.status === 'failure' ? 'destructive' :
                      'secondary'
                    }>
                      {step.status}
                    </Badge>
                  </div>
                  {step.error && (
                    <div className="mt-2 text-sm text-red-500">
                      {step.error}
                    </div>
                  )}
                  {step.duration && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Duration: {step.duration.toFixed(2)}s
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
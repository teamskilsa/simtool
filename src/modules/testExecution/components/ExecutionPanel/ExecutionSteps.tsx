import React from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { ExecutionStep } from '../../types';
import { cn } from '@/lib/utils';

interface ExecutionStepsProps {
  steps: ExecutionStep[];
  currentStepId?: string;
}

export const ExecutionSteps: React.FC<ExecutionStepsProps> = ({
  steps,
  currentStepId
}) => {
  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 p-4">
        {steps.map((step) => (
          <Card
            key={step.id}
            className={cn(
              "p-4",
              currentStepId === step.id && "ring-2 ring-primary"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">
                {step.status === 'running' && (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                )}
                {step.status === 'success' && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {step.status === 'failure' && (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{step.name}</h4>
                  <Badge 
                    variant={
                      step.status === 'success' ? 'success' :
                      step.status === 'failure' ? 'destructive' :
                      'secondary'
                    }
                  >
                    {step.status}
                  </Badge>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>

                {step.error && (
                  <div className="mt-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                    {step.error}
                  </div>
                )}

                {step.endTime && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Duration: {(step.duration || 0).toFixed(2)}s
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};

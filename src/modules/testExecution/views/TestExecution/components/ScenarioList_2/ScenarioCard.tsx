// components/ScenarioSelector/ScenarioCard.tsx
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Play,
  StopCircle,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  FileText
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface ScenarioCardProps {
  scenario: {
    id: string;
    name: string;
    topology: string;
    system: {
      id: string;
      name: string;
      host: string;
      port: string;
    };
    moduleConfigs: any[];
    createdAt: string;
    ipConfig: {
      common?: string;
      [key: string]: string | undefined;
    };
  };
}

export function ScenarioCard({ scenario }: ScenarioCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const handleRun = async () => {
    try {
      setIsRunning(true);
      toast({
        title: "Test Started",
        description: `Running scenario: ${scenario.name}`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start test execution",
        variant: "destructive"
      });
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    toast({
      title: "Test Stopped",
      description: `Stopped scenario: ${scenario.name}`
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };

  return (
    <Card className={cn(
      "p-4 transition-all",
      isRunning && "border-primary"
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{scenario.name}</h4>
            <Badge variant="outline">
              {isRunning ? 'Running' : 'Ready'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Created: {formatDate(scenario.createdAt)}</span>
            <span>•</span>
            <span className="capitalize">{scenario.topology}</span>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {scenario.topology === 'callbox' ? (
              <>
                <Badge variant="secondary">enb</Badge>
                <Badge variant="secondary">mme</Badge>
                <Badge variant="secondary">ims</Badge>
              </>
            ) : scenario.topology === 'core' ? (
              <>
                <Badge variant="secondary">mme</Badge>
                <Badge variant="secondary">ims</Badge>
              </>
            ) : (
              <Badge variant="secondary">ue</Badge>
            )}
            <Badge variant="outline">
              {scenario.system.host}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isRunning ? "destructive" : "default"}
            onClick={isRunning ? handleStop : handleRun}
          >
            {isRunning ? (
              <>
                <StopCircle className="w-4 h-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <FileText className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isRunning && (
        <div className="mt-4 space-y-2">
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-500" 
              style={{ width: '45%' }}
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Running step 2 of 5</span>
            <span>02:45 elapsed</span>
          </div>
        </div>
      )}
    </Card>
  );
}
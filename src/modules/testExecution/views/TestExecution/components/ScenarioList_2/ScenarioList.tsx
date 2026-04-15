// components/ScenarioSelector/ScenarioList.tsx
import React, { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  FileText,
  Network,
  FileIcon
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Scenario {
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
}

export function ScenarioList() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [runningScenarios, setRunningScenarios] = useState<Set<string>>(new Set());

  const fetchScenarios = async () => {
    try {
      console.log('Fetching scenarios...');
      setLoading(true);
      const response = await fetch('/api/scenarios');
      if (!response.ok) {
        throw new Error('Failed to fetch scenarios');
      }
      const data = await response.json();
      console.log('Fetched scenarios:', data);
      setScenarios(data);
    } catch (error) {
      console.error('Error fetching scenarios:', error);
      toast({
        title: "Error",
        description: "Failed to load scenarios",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };

  const handleRun = (scenarioId: string) => {
    setRunningScenarios(prev => new Set(prev).add(scenarioId));
    toast({
      title: "Test Started",
      description: "Running scenario"
    });
  };

  const handleStop = (scenarioId: string) => {
    setRunningScenarios(prev => {
      const newSet = new Set(prev);
      newSet.delete(scenarioId);
      return newSet;
    });
    toast({
      title: "Test Stopped",
      description: "Scenario execution stopped"
    });
  };

  const getModulesByTopology = (topology: string) => {
    switch (topology) {
      case 'callbox':
        return ['enb', 'mme', 'ims'];
      case 'core':
        return ['mme', 'ims'];
      case 'ue-core':
        return ['ue', 'enb', 'core'];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead className="min-w-[200px]">Test Scenario</TableHead>
            <TableHead className="min-w-[200px] max-w-[300px]">Config Name</TableHead>
            <TableHead className="min-w-[150px]">IPs</TableHead>
            <TableHead className="min-w-[120px]">Modules</TableHead>
            <TableHead className="min-w-[150px]">Created</TableHead>
            <TableHead className="min-w-[150px]">Last Run</TableHead>
            <TableHead className="w-[80px]">Logs</TableHead>
            <TableHead className="w-[150px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scenarios.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                No scenarios available. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            scenarios.map((scenario, index) => {
              const isRunning = runningScenarios.has(scenario.id);
              const modules = getModulesByTopology(scenario.topology);
              
              return (
                <TableRow key={scenario.id}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col space-y-1">
                      <span>{scenario.name}</span>
                      <Badge variant="outline" className="w-fit">
                        {scenario.topology}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="flex items-center gap-2 truncate">
                      <FileIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title={scenario.name}>
                        {scenario.name}-config.json
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 flex-shrink-0" />
                      <span>{scenario.system.host}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {modules.map(module => (
                        <div key={module} className="flex items-center gap-2">
                          <Badge variant="secondary" className="w-16">
                            {module}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {scenario.ipConfig[module] || scenario.system.host}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(scenario.createdAt)}</TableCell>
                  <TableCell>
                    {scenario.lastRun ? formatDate(scenario.lastRun) : '-'}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isRunning ? "destructive" : "default"}
                        onClick={() => isRunning ? handleStop(scenario.id) : handleRun(scenario.id)}
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
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
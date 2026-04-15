import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Settings,
  Server
} from 'lucide-react';
import { useTestExecutionStore } from '../../store/testExecutionStore';
import { ConfigItem } from '../../types/testConfig.types';
import { testRunnerService } from '../../services/testRunner.service';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { ConfigurationBox } from '@/components/ui/configuration-box';

interface TestExecutionPanelProps {
  config: ConfigItem;
}

export function TestExecutionPanel({ config }: TestExecutionPanelProps) {
  const router = useRouter();
  const { startTest, updateTestProgress, completeTest, getTestById } = useTestExecutionStore();
  const [testId, setTestId] = React.useState<string | null>(null);
  
  // Configuration state
  const [components, setComponents] = React.useState({
    enb: false,
    mme: false,
    ue: false
  });
  const [useCommonIp, setUseCommonIp] = React.useState(false);
  const [commonIp, setCommonIp] = React.useState('');

  const currentTest = testId ? getTestById(testId) : null;
  const isRunning = currentTest?.status === 'running';

  const handleRunTest = async () => {
    if (!components.enb && !components.mme && !components.ue) {
      alert('Please select at least one component');
      return;
    }

    const credentials = {
      host: useCommonIp ? commonIp : '192.168.1.100', // default IP if not using common IP
      username: 'admin', // these should come from secure configuration
      password: 'password'
    };

    const newTestId = startTest(config);
    setTestId(newTestId);

    try {
      const result = await testRunnerService.executeTest(
        config,
        credentials,
        (step) => {
          if (testId) {
            const currentTest = getTestById(testId);
            if (currentTest) {
              updateTestProgress({
                ...currentTest,
                steps: [...currentTest.steps, step]
              });
            }
          }
        }
      );

      completeTest(result);

      if (result.status === 'success') {
        setTimeout(() => {
          router.push('/stats');
        }, 1500);
      }
    } catch (error) {
      console.error('Test execution failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      <ConfigurationBox
        title="Test Scenario Configuration"
        icon={<Settings className="w-5 h-5" />}
        components={[
          {
            id: 'enb',
            label: 'eNB',
            checked: components.enb,
            onCheckedChange: (checked) => setComponents(prev => ({ ...prev, enb: checked }))
          },
          {
            id: 'mme',
            label: 'MME',
            checked: components.mme,
            onCheckedChange: (checked) => setComponents(prev => ({ ...prev, mme: checked }))
          },
          {
            id: 'ue',
            label: 'UE',
            checked: components.ue,
            onCheckedChange: (checked) => setComponents(prev => ({ ...prev, ue: checked }))
          }
        ]}
        commonIp={commonIp}
        onCommonIpChange={setCommonIp}
        useCommonIp={useCommonIp}
        onUseCommonIpChange={setUseCommonIp}
      />

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-blue-500" />
            <div className="space-y-1">
              <h3 className="font-medium">Test Execution</h3>
              <p className="text-sm text-muted-foreground">
                {config.name}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {currentTest && (
              <Badge variant="outline" className={cn(
                "px-2 py-1",
                currentTest.status === 'running' && "bg-blue-50 text-blue-700",
                currentTest.status === 'success' && "bg-green-50 text-green-700",
                currentTest.status === 'failure' && "bg-red-50 text-red-700"
              )}>
                {currentTest.status.charAt(0).toUpperCase() + currentTest.status.slice(1)}
              </Badge>
            )}
            
            <Button 
              onClick={handleRunTest} 
              disabled={isRunning}
              size="sm"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Test
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Test Steps Display */}
        {currentTest && currentTest.steps.length > 0 && (
          <ScrollArea className="h-[300px] border rounded-md p-4">
            <div className="space-y-3">
              {currentTest.steps.map((step) => (
                <Alert 
                  key={step.id}
                  variant={step.status === 'failure' ? 'destructive' : 'default'}
                  className="flex items-start gap-2"
                >
                  {step.status === 'running' ? (
                    <Loader2 className="w-4 h-4 animate-spin mt-1" />
                  ) : step.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-1" />
                  ) : step.status === 'failure' ? (
                    <XCircle className="w-4 h-4 text-red-500 mt-1" />
                  ) : null}
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{step.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {step.endTime ? 
                          `${((step.endTime.getTime() - step.startTime.getTime()) / 1000).toFixed(1)}s` : 
                          'Running...'
                        }
                      </span>
                    </div>
                    <AlertDescription className="mt-1">
                      {step.message}
                      {step.error && (
                        <pre className="mt-2 text-xs whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded">
                          {step.error}
                        </pre>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}
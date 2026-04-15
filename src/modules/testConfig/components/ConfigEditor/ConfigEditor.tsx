import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfigItem } from '../../types';
import { Editor } from './Editor';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfigurationBox } from '@/components/ui/configuration-box';
import { 
  Copy, 
  Download, 
  Maximize2, 
  Save, 
  Settings,
  Play,
  Loader2
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { testRunnerService } from '../../services/testRunner.service';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface ConfigEditorProps {
  config: ConfigItem | null;
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
  config,
  content,
  onChange,
  onSave,
  readOnly = false
}) => {
  const router = useRouter();
  const [isEdited, setIsEdited] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [testInProgress, setTestInProgress] = useState(false);
  const [testSteps, setTestSteps] = useState<any[]>([]);
  const [testError, setTestError] = useState<string | null>(null);

  // Test configuration states
  const [selectedModules, setSelectedModules] = useState({
    enb: false,
    mme: false,
    ue: false
  });
  const [useCommonIp, setUseCommonIp] = useState(false);
  const [commonIp, setCommonIp] = useState('');

  const handleContentChange = (newContent: string) => {
    setIsEdited(true);
    onChange(newContent);
  };

  const handleSave = () => {
    onSave?.();
    setIsEdited(false);
  };

  const handleTestExecution = async () => {
    if (!config) return;
    
    // Validate selections
    if (!selectedModules.enb && !selectedModules.mme && !selectedModules.ue) {
      alert('Please select at least one module to test');
      return;
    }

    if (useCommonIp && !commonIp) {
      alert('Please enter the common IP address');
      return;
    }

    setTestInProgress(true);
    setTestSteps([]);
    setTestError(null);

    try {
      const result = await testRunnerService.executeTest(
        config,
        `http://${useCommonIp ? commonIp : '192.168.1.100'}:9050`,
        (step) => {
          setTestSteps(prev => [...prev, step]);
        }
      );

      if (result.status === 'success') {
        setTimeout(() => {
          router.push('/stats');
        }, 1500);
      } else {
        setTestError(result.error || 'Test execution failed');
      }
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Test execution failed');
    } finally {
      setTestInProgress(false);
    }
  };

  if (!config) {
    return (
      <Card className="flex items-center justify-center h-[500px]">
        <div className="text-center text-muted-foreground">
          <p>Select a configuration to view or edit</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Configuration Section */}
      <div className="flex items-center justify-between">
        <ConfigurationBox
          title="Test Scenario Configuration"
          icon={<Settings className="w-5 h-5" />}
          components={[
            {
              id: 'enb',
              label: 'eNB',
              checked: selectedModules.enb,
              onCheckedChange: (checked) => setSelectedModules(prev => ({ ...prev, enb: checked }))
            },
            {
              id: 'mme',
              label: 'MME',
              checked: selectedModules.mme,
              onCheckedChange: (checked) => setSelectedModules(prev => ({ ...prev, mme: checked }))
            },
            {
              id: 'ue',
              label: 'UE',
              checked: selectedModules.ue,
              onCheckedChange: (checked) => setSelectedModules(prev => ({ ...prev, ue: checked }))
            }
          ]}
          commonIp={commonIp}
          onCommonIpChange={setCommonIp}
          useCommonIp={useCommonIp}
          onUseCommonIpChange={setUseCommonIp}
          className="flex-1 mr-4"
        />

        <Button
          onClick={handleTestExecution}
          disabled={testInProgress}
          className="h-10"
        >
          {testInProgress ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running Test...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run Test
            </>
          )}
        </Button>
      </div>

      {/* Test Execution Status */}
      {testSteps.length > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="font-medium">Test Execution Status</h3>
          {testSteps.map((step, index) => (
            <Alert key={index} variant={step.status === 'failure' ? 'destructive' : 'default'}>
              <div className="flex items-center gap-2">
                {step.status === 'running' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : step.status === 'success' ? (
                  <Badge variant="success">Success</Badge>
                ) : (
                  <Badge variant="destructive">Failed</Badge>
                )}
                <AlertDescription>
                  {step.message}
                  {step.error && (
                    <pre className="mt-2 text-xs whitespace-pre-wrap font-mono bg-red-50 dark:bg-red-900/10 p-2 rounded">
                      {step.error}
                    </pre>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          ))}
          {testError && (
            <Alert variant="destructive">
              <AlertDescription>{testError}</AlertDescription>
            </Alert>
          )}
        </Card>
      )}

      {/* Editor Section */}
      <div className={cn(
        "border rounded-xl overflow-hidden",
        "bg-white/50 dark:bg-gray-950/50",
        "backdrop-blur-sm",
        "shadow-xl shadow-blue-500/5",
        "ring-1 ring-blue-100/20 dark:ring-blue-900/20",
        isFullscreen && "fixed inset-0 z-50"
      )}>
        <div className={cn(
          "flex items-center justify-between px-6 py-4",
          "bg-gradient-to-r from-sky-100/90 to-blue-100/90",
          "dark:from-sky-900/90 dark:to-blue-900/90",
          "border-b border-blue-200 dark:border-blue-800",
          "backdrop-blur-md",
          "shadow-sm"
        )}>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {config.name}
            </h3>
            <div className={cn(
              "px-2.5 py-0.5 rounded-full text-sm font-medium",
              "bg-sky-200/70 dark:bg-sky-700/70",
              "text-sky-700 dark:text-sky-200"
            )}>
              {config.module}
            </div>
          </div>
          
          <TooltipProvider>
            <div className="flex items-center gap-2">
              {isEdited && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleSave}
                      className={cn(
                        "hover:bg-green-200/50 dark:hover:bg-green-900/20",
                        "text-green-600 dark:text-green-400"
                      )}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save changes</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="hover:bg-sky-200/50 dark:hover:bg-sky-900/20"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy to clipboard</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="hover:bg-sky-200/50 dark:hover:bg-sky-900/20"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download file</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="hover:bg-sky-200/50 dark:hover:bg-sky-900/20"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <Editor
          content={content}
          onChange={handleContentChange}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
};
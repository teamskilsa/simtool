import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { InstallResult } from '../types';

interface InstallProgressProps {
  result: InstallResult | null;
  isInstalling: boolean;
}

function formatStepName(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function InstallProgress({ result, isInstalling }: InstallProgressProps) {
  const [showLog, setShowLog] = useState(false);

  if (!isInstalling && !result) return null;

  if (isInstalling && !result) {
    return (
      <div className="space-y-4 mt-6">
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="font-medium">Installing software...</p>
            <p className="text-sm text-muted-foreground">
              This may take several minutes. Package installs (apache, php, etc.) can be slow.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4 mt-6">
      <Alert variant={result.success ? 'default' : 'destructive'}>
        <AlertTitle>{result.success ? 'Installation Complete' : 'Installation Failed'}</AlertTitle>
        <AlertDescription>
          {result.error || (result.success ? 'All critical steps completed successfully.' : 'One or more critical steps failed.')}
        </AlertDescription>
      </Alert>

      <div className="space-y-1">
        {result.steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/50">
            {step.ok ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">{formatStepName(step.name)}</p>
              {step.detail && (
                <p className="text-xs text-muted-foreground break-all">{step.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {result.installLog && (
        <div>
          <button
            type="button"
            onClick={() => setShowLog((s) => !s)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showLog ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {showLog ? 'Hide' : 'Show'} installer log (last 4KB)
          </button>
          {showLog && (
            <pre className="mt-2 p-3 bg-muted/50 rounded-md text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
              {result.installLog}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

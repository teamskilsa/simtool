import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Download, Copy, Check } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import type { InstallResult } from '../types';

interface InstallProgressProps {
  result: InstallResult | null;
  isInstalling: boolean;
  systemName?: string;
}

function formatStepName(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildFullLog(result: InstallResult, systemName?: string): string {
  const lines: string[] = [
    `=== Amarisoft Installation Log ===`,
    `Generated : ${new Date().toISOString()}`,
    systemName ? `System    : ${systemName}` : '',
    `Status    : ${result.success ? 'SUCCESS' : 'FAILED'}`,
    result.error ? `Error     : ${result.error}` : '',
    '',
    '--- Steps ---',
    ...result.steps.map(s =>
      `[${s.ok ? 'OK  ' : 'FAIL'}] ${s.name}${s.detail ? `\n         ${s.detail}` : ''}`
    ),
    '',
    '--- Installer Output ---',
    result.installLog || '(no installer output captured)',
  ];
  return lines.filter(l => l !== null && l !== undefined).join('\n');
}

export function InstallProgress({ result, isInstalling, systemName }: InstallProgressProps) {
  // Auto-expand log on failure so the user immediately sees what went wrong
  const [showLog, setShowLog] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (result && !result.success) setShowLog(true);
  }, [result]);

  const handleDownload = () => {
    if (!result) return;
    const content = buildFullLog(result, systemName);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `amarisoft-install-${systemName ? systemName.replace(/\s+/g, '_') + '-' : ''}${ts}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Log downloaded', description: 'Share this file when reporting an issue.' });
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildFullLog(result, systemName));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Log copied to clipboard', description: 'Paste it when reporting an issue.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Use the Download button instead.', variant: 'destructive' });
    }
  };

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
          {result.error || (result.success
            ? 'All critical steps completed successfully.'
            : 'One or more critical steps failed.')}
        </AlertDescription>
      </Alert>

      {/* Steps */}
      <div className="space-y-1">
        {result.steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/50">
            {step.ok
              ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-sm font-medium">{formatStepName(step.name)}</p>
              {step.detail && (
                <p className="text-xs text-muted-foreground break-all">{step.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Log section — always shown when log is available, auto-expanded on failure */}
      {result.installLog && (
        <div className="rounded-md border border-border">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
            <button
              type="button"
              onClick={() => setShowLog(s => !s)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showLog
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronRight className="h-3 w-3" />}
              {showLog ? 'Hide' : 'Show'} installer log (last 4KB)
            </button>

            {/* Download + Copy — always visible so user can grab the log even without expanding */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleCopy}
                title="Copy full log to clipboard"
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleDownload}
                title="Download log as .txt file to share when reporting issues"
              >
                <Download className="h-3 w-3" />
                Download log
              </Button>
            </div>
          </div>

          {showLog && (
            <pre className="p-3 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all bg-muted/10">
              {result.installLog}
            </pre>
          )}
        </div>
      )}

      {/* Fallback share prompt when there's no installLog but install failed */}
      {!result.success && !result.installLog && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            No installer output was captured. To report this issue, note the failed step and its detail message above.
          </p>
        </div>
      )}
    </div>
  );
}

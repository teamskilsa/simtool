import { useState, useEffect } from 'react';
import {
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCcw,
  Copy,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConnectionSelector } from './connection-selector';
import { CommandSelector } from './command-selector';
import { ResponseLog } from './response-log';
import { useRemoteAPI } from '../hooks/use-remote-api';
import { useTheme } from '@/components/theme/context/theme-context';
import { THEME_CHROME_BG } from '@/components/theme/utils/theme-chrome';
import type { ThemeConfig } from '@/components/theme/types/theme.types';
import type { ComponentType } from '../types';
import { remoteAPIStorage } from '../utils/remote-api-storage';
import ScreenMonitor from './screen-monitor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RemoteAPIInterfaceProps {
  themeConfig: ThemeConfig;
}

interface ConnectionDetails {
  ip: string;
  type: ComponentType;
  port: string;
  password?: string;
}

interface LogEntry {
  command: string;
  response: any;
  timestamp: string;
  status: 'success' | 'error';
}

export default function RemoteAPIInterface({ themeConfig }: RemoteAPIInterfaceProps) {
  const { theme } = useTheme();
  const connectBtnBg = THEME_CHROME_BG[theme] ?? 'bg-indigo-600';

  const [connection, setConnection] = useState<ConnectionDetails>(() => {
    return remoteAPIStorage.getRecentConnection() || { ip: '127.0.0.1', type: 'ENB', port: '9001' };
  });
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>(() => remoteAPIStorage.getCommandHistory());
  const [responseLog, setResponseLog] = useState<LogEntry[]>(() => remoteAPIStorage.getResponseLogs());
  const [isExecuting, setIsExecuting] = useState(false);

  const { client: wsClient, connect, disconnect, execute } = useRemoteAPI({
    server: connection.ip,
    port: parseInt(connection.port),
    ssl: false,
    password: connection.password || undefined,
  });

  const handleConnect = async () => {
    try {
      setStatus('connecting');
      setError(null);
      await connect();
      setStatus('connected');
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Failed to connect to the server');
    }
  };

  const handleConnectionChange = (details: ConnectionDetails) => {
    setConnection(details);
    // Persist host/port/type only — keep the password in memory so it
    // doesn't survive a refresh in localStorage.
    const { password, ...persistable } = details;
    remoteAPIStorage.saveConnection(persistable);
    if (status === 'connected') { disconnect(); setStatus('idle'); }
  };

  const handleExecuteCommand = async () => {
    if (!command.trim()) return;
    setIsExecuting(true);
    try {
      if (status !== 'connected') throw new Error('Please connect to the server first');
      const commandObj = JSON.parse(command);
      const result = await execute(commandObj.message, commandObj);
      const entry: LogEntry = { command, response: result, timestamp: new Date().toISOString(), status: 'success' };
      setResponseLog((prev) => [entry, ...prev]);
      remoteAPIStorage.saveLog(entry);
      setCommandHistory((prev) => [command, ...prev]);
      remoteAPIStorage.saveCommand(command);
      setCommand('');
    } catch (err: any) {
      const entry: LogEntry = { command, response: err.message, timestamp: new Date().toISOString(), status: 'error' };
      setResponseLog((prev) => [entry, ...prev]);
      remoteAPIStorage.saveLog(entry);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExportLogs = () => {
    const blob = new Blob([remoteAPIStorage.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `remote-api-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => { remoteAPIStorage.clearResponseLogs(); setResponseLog([]); };

  useEffect(() => { return () => { disconnect(); }; }, [disconnect]);

  return (
    <div className="space-y-6">
      {/* Connection card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Remote API Connection</CardTitle>
            <div className="flex items-center gap-2">
              {status === 'connected' && (
                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected to {connection.type}
                </Badge>
              )}
              {status === 'connecting' && (
                <Badge variant="secondary" className="gap-1.5">
                  Connecting…
                </Badge>
              )}
              {status === 'error' && (
                <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Connection Failed
                </Badge>
              )}
              <button
                onClick={handleConnect}
                disabled={status === 'connecting'}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:opacity-90 ${connectBtnBg}`}
              >
                <PlayCircle className="w-4 h-4" />
                {status === 'connecting' ? 'Connecting…' : status === 'connected' ? 'Reconnect' : 'Connect'}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ConnectionSelector themeConfig={themeConfig} onConnectionChange={handleConnectionChange} />
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Commands / Monitor tabs */}
      <Tabs defaultValue="commands" className="w-full">
        <TabsList>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="monitor">Screen Monitor</TabsTrigger>
        </TabsList>

        <TabsContent value="commands">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Command Execution</CardTitle>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCommand('{}')}
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Reset command"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(command)}
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Copy command"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CommandSelector
                componentType={connection.type}
                themeConfig={themeConfig}
                onCommandSelect={setCommand}
              />

              <div className="relative">
                <textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder='Enter command (e.g. {"message": "config_get"})'
                  rows={4}
                  className="w-full bg-background border border-input rounded-lg px-4 py-3 text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-colors resize-none"
                />
                <button
                  onClick={handleExecuteCommand}
                  disabled={isExecuting || !command.trim()}
                  className={`absolute right-2 bottom-2 p-2 rounded-lg text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${connectBtnBg}`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {commandHistory.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">Recent commands</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {commandHistory.slice(0, 5).map((cmd, i) => (
                      <button
                        key={i}
                        onClick={() => setCommand(cmd)}
                        className="px-2.5 py-1 bg-muted rounded-md text-xs text-foreground hover:bg-muted/80 transition-colors border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {cmd.length > 30 ? `${cmd.substring(0, 30)}…` : cmd}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ResponseLog
                logs={responseLog}
                themeConfig={themeConfig}
                onExport={handleExportLogs}
                onClear={handleClearLogs}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitor">
          <ScreenMonitor
            themeConfig={themeConfig}
            wsClient={wsClient}
            connected={status === 'connected'}
            connectionType={connection.type}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

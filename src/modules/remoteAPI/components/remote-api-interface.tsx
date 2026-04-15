import { useState, useEffect } from 'react';
import { 
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCcw,
  Copy
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConnectionSelector } from './connection-selector';
import { CommandSelector } from './command-selector';
import { ResponseLog } from './response-log';
import { useRemoteAPI } from '../hooks/use-remote-api';
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
}

interface LogEntry {
  command: string;
  response: any;
  timestamp: string;
  status: 'success' | 'error';
}

export default function RemoteAPIInterface({ themeConfig }: RemoteAPIInterfaceProps) {
  // Initialize state with stored values
  const [connection, setConnection] = useState<ConnectionDetails>(() => {
    return remoteAPIStorage.getRecentConnection() || {
      ip: '127.0.0.1',
      type: 'ENB',
      port: '9001'
    };
  });
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>(() => 
    remoteAPIStorage.getCommandHistory()
  );
  const [responseLog, setResponseLog] = useState<LogEntry[]>(() => 
    remoteAPIStorage.getResponseLogs()
  );
  const [isExecuting, setIsExecuting] = useState(false);

  const [activeTab, setActiveTab] = useState('commands'); // Add this state

  const { 
    client: wsClient, 
    connected: wsConnected, 
    error: wsError, 
    connect, 
    disconnect, 
    execute 
  } = useRemoteAPI({
      server: connection.ip,
      port: parseInt(connection.port),
      ssl: false
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
    remoteAPIStorage.saveConnection(details);
    if (status === 'connected') {
      disconnect();
      setStatus('idle');
    }
  };

  const handleExecuteCommand = async () => {
    if (!command.trim()) return;

    setIsExecuting(true);
    try {
      if (status !== 'connected') {
        throw new Error('Please connect to the server first');
      }
      
      const commandObj = JSON.parse(command);
      const result = await execute(commandObj.message, commandObj);

      const logEntry: LogEntry = {
        command: command,
        response: result,
        timestamp: new Date().toISOString(),
        status: 'success',
        connectionDetails: connection
      };

      setResponseLog(prev => [logEntry, ...prev]);
      remoteAPIStorage.saveLog(logEntry);
      
      // Save command to history
      setCommandHistory(prev => [command, ...prev]);
      remoteAPIStorage.saveCommand(command);
      
      setCommand('');
    } catch (err: any) {
      const logEntry: LogEntry = {
        command: command,
        response: err.message,
        timestamp: new Date().toISOString(),
        status: 'error',
        connectionDetails: connection
      };

      setResponseLog(prev => [logEntry, ...prev]);
      remoteAPIStorage.saveLog(logEntry);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExportLogs = () => {
    const data = remoteAPIStorage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `remote-api-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleClearLogs = () => {
    remoteAPIStorage.clearResponseLogs();
    setResponseLog([]);
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="space-y-6">
      {/* Connection Section */}
      <div className={`
        rounded-xl p-6 bg-white dark:bg-gray-800
        ${themeConfig.surfaces.card.background}
        border ${themeConfig.surfaces.card.border}
      `}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Remote API Connection
          </h2>
          <div className="flex items-center space-x-2">
            {status === 'connected' && (
              <span className="flex items-center px-3 py-1 text-sm bg-emerald-500/20 text-emerald-500 rounded-full">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Connected to {connection.type}
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center px-3 py-1 text-sm bg-red-500/20 text-red-500 rounded-full">
                <AlertCircle className="w-4 h-4 mr-2" />
                Connection Failed
              </span>
            )}
            <button 
              onClick={handleConnect}
              disabled={status === 'connecting'}
              className="flex items-center px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              {status === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>

        <ConnectionSelector 
          themeConfig={themeConfig}
          onConnectionChange={handleConnectionChange}
        />

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="commands" className="w-full">
        <TabsList>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="monitor">Screen Monitor</TabsTrigger>
        </TabsList>

        <TabsContent value="commands">
          <div className={`
            rounded-xl p-6 bg-white dark:bg-gray-800
            ${themeConfig.surfaces.card.background}
            border ${themeConfig.surfaces.card.border}
          `}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Command Execution
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCommand('{}')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                  title="Clear command"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(command)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                  title="Copy command"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <CommandSelector 
              componentType={connection.type}
              themeConfig={themeConfig}
              onCommandSelect={setCommand}
            />

            <div className="space-y-4 mt-4">
              <div className="relative">
                <textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder='Enter command (e.g., {"message": "config_get"})'
                  rows={4}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 
                            rounded-lg px-4 py-3 text-gray-900 dark:text-white font-mono text-sm"
                />
                <button
                  onClick={handleExecuteCommand}
                  disabled={isExecuting || !command.trim()}
                  className={`
                    absolute right-2 bottom-2 p-2 rounded-lg
                    bg-teal-600 text-white hover:bg-teal-700
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {commandHistory.length > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Recent commands:
                  <div className="flex flex-wrap gap-2 mt-1">
                    {commandHistory.slice(0, 5).map((cmd, i) => (
                      <button
                        key={i}
                        onClick={() => setCommand(cmd)}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs 
                                hover:bg-gray-200 dark:hover:bg-gray-600
                                text-gray-900 dark:text-gray-100"
                      >
                        {cmd.length > 30 ? cmd.substring(0, 30) + '...' : cmd}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Response Log */}
            <div className="mt-6">
              <ResponseLog 
                logs={responseLog}
                themeConfig={themeConfig}
                onExport={handleExportLogs}
                onClear={handleClearLogs}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="monitor">
            <ScreenMonitor 
                themeConfig={themeConfig}
                wsClient={wsClient}
                connected={status === 'connected'}
                connectionType={connection.type}  // Add this
            />
        </TabsContent>
      </Tabs>
    </div>
  );
}
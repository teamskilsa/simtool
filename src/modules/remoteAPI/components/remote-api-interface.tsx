import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCcw,
  Copy,
  Terminal as TerminalIcon,
  Unplug,
  ShieldAlert,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/ui/page-header';
import { Kicker } from '@/components/ui/stat';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ConnectionSelector, type ConnectionDetails } from './connection-selector';
import { CommandSelector } from './command-selector';
import { ResponseLog } from './response-log';
import ScreenMonitor from './screen-monitor';
import { useRemoteAPI } from '../hooks/use-remote-api';
import { useTheme } from '@/components/theme/context/theme-context';
import { THEME_CHROME_BG } from '@/components/theme/utils/theme-chrome';
import type { ThemeConfig } from '@/components/theme/types/theme.types';
import { remoteAPIStorage, type LogEntry } from '../utils/remote-api-storage';
import { RemoteAPIError } from '../utils/websocket-client';
import { parseRequestText, validateRequest, type ValidationReport } from '../utils/validate-request';
import { parseReleaseVersion } from '../utils/version';
import {
  CATALOGUE_VERSION,
  COMPONENT_TYPES,
  componentFromBannerType,
  type ComponentType,
} from '../../../shared/default/templates/remoteapi';

interface RemoteAPIInterfaceProps {
  themeConfig: ThemeConfig;
}

/** Cap for in-memory entries (events can arrive fast after `register`). */
const MAX_LOG_ENTRIES = 300;

export default function RemoteAPIInterface({ themeConfig }: RemoteAPIInterfaceProps) {
  const { theme } = useTheme();
  const connectBtnBg = THEME_CHROME_BG[theme] ?? 'bg-indigo-600';

  const [connection, setConnection] = useState<ConnectionDetails>(() => {
    const recent = remoteAPIStorage.getRecentConnection();
    const type: ComponentType = recent && COMPONENT_TYPES.includes(recent.type) ? recent.type : 'ENB';
    return recent ? { ...recent, type } : { ip: '127.0.0.1', type: 'ENB', port: '9001' };
  });
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>(() => remoteAPIStorage.getCommandHistory());
  const [responseLog, setResponseLog] = useState<LogEntry[]>(() => remoteAPIStorage.getResponseLogs());
  const [isExecuting, setIsExecuting] = useState(false);
  const [confirm, setConfirm] = useState<ValidationReport | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const apiConfig = useMemo(() => ({
    server: connection.ip.trim(),
    port: parseInt(connection.port, 10),
    ssl: false,
    password: connection.password || undefined,
  }), [connection.ip, connection.port, connection.password]);

  const { client: wsClient, connected, serverInfo, connect, disconnect } = useRemoteAPI(apiConfig);

  // The server tells us what it is; validate against that rather than the
  // button the user clicked (port 9000 answering as MME while ENB is picked).
  const bannerComponent = componentFromBannerType(serverInfo?.type);
  const component: ComponentType = (status === 'connected' && bannerComponent) || connection.type;
  const serverVersion = status === 'connected' ? serverInfo?.version ?? null : null;
  const serverLabel = serverInfo ? [serverInfo.type, serverInfo.name, serverInfo.version].filter(Boolean).join(' ') : undefined;

  const addLog = useCallback((entry: LogEntry, persist = true) => {
    setResponseLog(prev => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
    if (persist) remoteAPIStorage.saveLog(entry);
  }, []);

  const handleConnect = async () => {
    const port = parseInt(connection.port, 10);
    if (!connection.ip.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
      setStatus('error');
      setError('Enter a host and a port between 1 and 65535');
      return;
    }
    try {
      setStatus('connecting');
      setError(null);
      await connect();
      setStatus('connected');
    } catch (err: any) {
      setStatus('error');
      setError(err?.message || 'Failed to connect to the server');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setStatus('idle');
  };

  const handleConnectionChange = (details: ConnectionDetails) => {
    setConnection(details);
    // Persist host/port/type only; the password stays in memory.
    const { password: _password, ...persistable } = details;
    remoteAPIStorage.saveConnection(persistable);
    if (status === 'connected' || status === 'connecting') { disconnect(); setStatus('idle'); }
  };

  // Socket closed by the server / network.
  useEffect(() => {
    if (status === 'connected' && !connected) {
      setStatus('error');
      setError(`Connection to ${connection.ip}:${connection.port} closed`);
    }
  }, [connected, status, connection.ip, connection.port]);

  // Unsolicited frames: registered events, server errors, binary signal events.
  useEffect(() => {
    if (!wsClient) return;
    const now = () => new Date().toISOString();
    const onEvent = (msg: any) => {
      addLog({ command: `(event) ${msg?.message ?? 'unknown'}`, response: msg, timestamp: now(), status: 'event', server: serverLabel }, false);
    };
    const onServerError = (msg: any) => addLog({ command: '(server error)', response: msg, timestamp: now(), status: 'error', server: serverLabel });
    const onBinary = (b: any) => addLog({ command: `(binary signal event) ${b?.header?.label ?? ''}`, response: b, timestamp: now(), status: 'event', server: serverLabel }, false);
    wsClient.on('message', onEvent);
    wsClient.on('server_error', onServerError);
    wsClient.on('binary', onBinary);
    return () => {
      wsClient.off('message', onEvent);
      wsClient.off('server_error', onServerError);
      wsClient.off('binary', onBinary);
    };
  }, [wsClient, addLog, serverLabel]);

  // ── Validation (live, as the user types) ────────────────────────────────
  const parsed = useMemo(() => (command.trim() ? parseRequestText(command) : null), [command]);
  const report = useMemo(
    () => (parsed && parsed.value !== undefined ? validateRequest(parsed.value, { component, serverVersion }) : null),
    [parsed, component, serverVersion],
  );

  const send = async (rep: ValidationReport) => {
    const client = wsClient;
    setIsExecuting(true);
    const started = Date.now();
    const text = command;
    try {
      if (!client || status !== 'connected') throw new Error('Connect to the server first');
      if (rep.batch) {
        const results = await client.sendBatch(rep.messages, {
          onProgress: (n) => addLog({ command: `(notification) ${n.message ?? ''}`, response: n, timestamp: new Date().toISOString(), status: 'notification', server: serverLabel }),
        });
        results.forEach((r, i) => {
          const cmd = JSON.stringify(rep.messages[i]);
          addLog(r.ok
            ? { command: cmd, response: r.response, timestamp: new Date().toISOString(), status: 'success', durationMs: Date.now() - started, server: serverLabel }
            : { command: cmd, response: r.error instanceof RemoteAPIError ? r.error.response : r.error.message, timestamp: new Date().toISOString(), status: 'error', durationMs: Date.now() - started, server: serverLabel });
        });
      } else {
        const result = await client.sendMessage(rep.messages[0], {
          onProgress: (n) => addLog({ command: `(notification) ${n.message ?? rep.messages[0].message}`, response: n, timestamp: new Date().toISOString(), status: 'notification', server: serverLabel }),
        });
        addLog({ command: text, response: result, timestamp: new Date().toISOString(), status: 'success', durationMs: Date.now() - started, server: serverLabel });
      }
      setCommandHistory(prev => [text, ...prev.filter(c => c !== text)].slice(0, 20));
      remoteAPIStorage.saveCommand(text);
    } catch (err: any) {
      // Keep the whole error response (it carries message_id, time, utc).
      const response = err instanceof RemoteAPIError ? err.response : (err?.message ?? String(err));
      addLog({ command: text, response, timestamp: new Date().toISOString(), status: 'error', durationMs: Date.now() - started, server: serverLabel });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteCommand = async () => {
    if (!report || !report.ok || isExecuting) return;
    if (report.danger.level !== 'safe') {
      setAcknowledged(false);
      setConfirm(report);
      return;
    }
    await send(report);
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

  useEffect(() => () => { disconnect(); }, [disconnect]);

  const versionNote = (() => {
    if (!serverVersion) return null;
    const s = parseReleaseVersion(serverVersion);
    const c = parseReleaseVersion(CATALOGUE_VERSION);
    if (s === null || c === null) return `Version "${serverVersion}" is not a release date; version checks are skipped.`;
    if (s > c) return `Server ${serverVersion} is newer than the catalogue (${CATALOGUE_VERSION} docs): new messages are sent unchecked.`;
    if (s < c) return `Server ${serverVersion} is older than the catalogue (${CATALOGUE_VERSION} docs): commands and parameters added later are blocked.`;
    return null;
  })();

  const issueIcon = (level: string) => (level === 'error'
    ? <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
    : level === 'warning'
      ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      : <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<TerminalIcon />}
        title="Remote API"
        subtitle={`Amarisoft remote API console · commands checked against the ${CATALOGUE_VERSION} docs`}
        actions={
          status === 'connected'
            ? <Badge variant="success" className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />{serverLabel ?? component}</Badge>
            : status === 'error'
              ? <Badge variant="warning" className="gap-1.5"><AlertCircle className="h-3.5 w-3.5" />Not connected</Badge>
              : undefined
        }
      />

      {/* Connection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Connection</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {status === 'connecting' && <Badge variant="secondary">Connecting…</Badge>}
              {status === 'connected' && (
                <Button variant="outline" size="sm" onClick={handleDisconnect} className="gap-1.5">
                  <Unplug className="h-4 w-4" />Disconnect
                </Button>
              )}
              <button
                onClick={handleConnect}
                disabled={status === 'connecting'}
                className={`inline-flex items-center gap-2 px-3 h-8 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:opacity-90 ${connectBtnBg}`}
              >
                <PlayCircle className="w-4 h-4" />
                {status === 'connecting' ? 'Connecting…' : status === 'connected' ? 'Reconnect' : 'Connect'}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ConnectionSelector themeConfig={themeConfig} initial={connection} onConnectionChange={handleConnectionChange} />

          {status === 'connected' && serverInfo && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm md:grid-cols-5" data-testid="server-banner">
              <div><Kicker>Type</Kicker><span className="font-mono">{serverInfo.type ?? '?'}</span></div>
              <div><Kicker>Name</Kicker><span className="font-mono">{serverInfo.name ?? '?'}</span></div>
              <div><Kicker>Version</Kicker><span className="font-mono">{serverInfo.version ?? 'unknown'}</span></div>
              <div><Kicker>Product</Kicker><span className="font-mono">{serverInfo.product ?? '-'}</span></div>
              <div><Kicker>Session</Kicker><span className="font-mono">{serverInfo.via === 'grace' ? 'no banner' : serverInfo.via}</span></div>
            </div>
          )}
          {status === 'connected' && bannerComponent && bannerComponent !== connection.type && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Port {connection.port} answered as <b>{serverInfo?.type}</b>, not {connection.type}. Commands are validated against the {bannerComponent} catalogue.
              </AlertDescription>
            </Alert>
          )}
          {status === 'connected' && versionNote && (
            <p className="text-xs text-muted-foreground">{versionNote}</p>
          )}
          {error && status !== 'connected' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="commands" className="w-full">
        <TabsList>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="monitor">Screen Monitor</TabsTrigger>
        </TabsList>

        <TabsContent value="commands">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Command</CardTitle>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCommand('')}
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Clear command"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { try { void navigator.clipboard.writeText(command); } catch { /* clipboard unavailable */ } }}
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Copy command"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CommandSelector componentType={component} serverVersion={serverVersion} onCommandSelect={setCommand} />

              <div className="relative">
                <textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleExecuteCommand(); } }}
                  placeholder='{"message": "config_get"}  ·  an array sends several messages in one frame  ·  Ctrl/Cmd+Enter sends'
                  rows={Math.min(14, Math.max(4, command.split('\n').length + 1))}
                  spellCheck={false}
                  aria-label="Remote API request JSON"
                  className="w-full bg-background border border-input rounded-lg px-4 py-3 pr-14 text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-colors resize-y"
                />
                <button
                  onClick={() => void handleExecuteCommand()}
                  disabled={isExecuting || !report || !report.ok || status !== 'connected'}
                  title={status !== 'connected' ? 'Connect first' : report && !report.ok ? 'Fix the errors below' : 'Send (Ctrl/Cmd+Enter)'}
                  aria-label="Send request"
                  className={`absolute right-2 bottom-3 p-2 rounded-lg text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${connectBtnBg}`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {(parsed?.error || (report && (report.issues.length > 0 || report.danger.level !== 'safe'))) && (
                <div className="rounded-lg border border-border p-3 space-y-1.5 text-xs" data-testid="validation-panel">
                  <div className="flex items-center gap-2">
                    <Kicker>Pre-send check · {component}{serverVersion ? ` ${serverVersion}` : ''}</Kicker>
                    {report && report.ok && report.danger.level !== 'safe' && (
                      <Badge variant={report.danger.level === 'destructive' ? 'destructive' : 'warning'} className="gap-1">
                        {report.danger.level === 'destructive' ? <ShieldAlert className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {report.danger.level === 'destructive' ? 'destructive: confirm' : 'changes live state: confirm'}
                      </Badge>
                    )}
                  </div>
                  {parsed?.error && (
                    <div className="flex items-start gap-1.5">{issueIcon('error')}<span>{parsed.error}</span></div>
                  )}
                  {report?.issues.map((iss, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      {issueIcon(iss.level)}
                      <span className={cn(iss.level === 'error' && 'text-red-700 dark:text-red-400')}>
                        {iss.path && <code className="font-mono">{iss.path}</code>}{iss.path ? ': ' : ''}{iss.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {commandHistory.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <Kicker>Recent commands</Kicker>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {commandHistory.slice(0, 6).map((cmd, i) => (
                      <button
                        key={i}
                        onClick={() => setCommand(cmd)}
                        title={cmd}
                        className="px-2.5 py-1 bg-muted rounded-md font-mono text-xs text-foreground hover:bg-muted/80 transition-colors border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {(() => { const one = cmd.replace(/\s+/g, ' '); return one.length > 40 ? `${one.substring(0, 40)}…` : one; })()}
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
            connectionType={component}
            serverVersion={serverVersion}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirm?.danger.level === 'destructive'
                ? <><ShieldAlert className="h-5 w-5 text-red-600" />Destructive command</>
                : <><AlertTriangle className="h-5 w-5 text-amber-600" />Confirm live change</>}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Send <code className="font-mono">{confirm?.messages.map(m => m.message).join(', ')}</code> to{' '}
                  <b>{serverLabel ?? component}</b> at {connection.ip}:{connection.port}?
                </p>
                <ul className="list-disc pl-5 space-y-1" data-testid="confirm-reasons">
                  {confirm?.danger.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm?.danger.level === 'destructive' && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} aria-label="I understand the consequences" />
              I understand the consequences and know how to restore
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirm?.danger.level === 'destructive' && !acknowledged}
              className={confirm?.danger.level === 'destructive' ? 'bg-red-600 hover:bg-red-700 text-white' : undefined}
              onClick={() => { const rep = confirm; setConfirm(null); if (rep) void send(rep); }}
            >
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

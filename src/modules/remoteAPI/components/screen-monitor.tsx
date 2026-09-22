// Screen Monitor: a console-style terminal over the remote API.
//
// Amarisoft's remote API has no message that runs console commands (the
// previous version sent the undocumented {message:"monitor"}). Typed lines
// are translated by monitor-commands.ts into documented messages
// (`cell_gain 1 -10` -> {"message":"cell_gain","cell_id":1,"gain":-10}),
// validated like the Commands tab, and rendered as text. A line starting
// with `{` or `[` is sent as raw JSON. Periodic traces (`t g 2`) and log
// streaming (`logs`) run until Enter or Ctrl-C.

import React, { useEffect, useRef, useState } from 'react';
import 'xterm/css/xterm.css';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/stat';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ThemeConfig } from '@/components/theme/types/theme.types';
import type { ComponentType } from '../types';
import { WebSocketClient } from '../utils/websocket-client';
import { validateRequest } from '../utils/validate-request';
import { getMonitorCommands, resolveMonitorLine, type MonitorCommandType } from './monitor-commands';

interface ScreenMonitorProps {
  themeConfig?: ThemeConfig;
  wsClient: WebSocketClient | null;
  connected: boolean;
  connectionType: ComponentType;
  serverVersion?: string | null;
}

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};
const PROMPT = '\x1b[36m> \x1b[0m';
const nl = (s: string) => s.replace(/\r?\n/g, '\r\n');

const ScreenMonitor = ({ wsClient, connected, connectionType, serverVersion }: ScreenMonitorProps) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const availableCommands = getMonitorCommands(connectionType);

  // Terminal line state lives in refs: xterm callbacks outlive renders.
  const lineRef = useRef('');
  const historyRef = useRef<string[]>([]);
  const historyPos = useRef(-1);
  const busyRef = useRef(false);
  /** Set while a periodic trace / log stream runs; calling it stops the loop. */
  const stopRef = useRef<(() => void) | null>(null);
  const pendingConfirm = useRef<string | null>(null);
  const ctxRef = useRef({ wsClient, connected, connectionType, serverVersion });
  ctxRef.current = { wsClient, connected, connectionType, serverVersion };

  const [config, setConfig] = useState<{ fontSize: number }>(() => {
    if (typeof window === 'undefined') return { fontSize: 14 };
    try {
      const saved = window.localStorage.getItem('screen_monitor_config');
      return saved ? JSON.parse(saved) : { fontSize: 14 };
    } catch {
      return { fontSize: 14 };
    }
  });

  const currentCategoryCommands =
    availableCommands.find((cat) => cat.category === selectedCategory)?.items ?? [];

  const write = (s: string) => terminalInstance.current?.write(s);
  const prompt = () => write(`\r\n${PROMPT}${lineRef.current}`);

  const printResponse = (cmd: MonitorCommandType | null, resp: any) => {
    const body = cmd?.format ? cmd.format(resp) : JSON.stringify(resp, null, 2);
    write(`\r\n${nl(body)}`);
  };

  /** Validate and send one request, printing errors. Returns the response or undefined. */
  const request = async (msg: any, confirmKey: string, cmd: MonitorCommandType | null, quiet = false): Promise<any> => {
    const { wsClient: client, connected: isUp, connectionType: comp, serverVersion: ver } = ctxRef.current;
    if (!client || !isUp) {
      write(`\r\n${C.red('[not connected: click Connect above]')}`);
      return undefined;
    }
    const report = validateRequest(msg, { component: comp, serverVersion: ver });
    for (const iss of report.issues) {
      if (iss.level === 'info' && quiet) continue;
      const tag = iss.level === 'error' ? C.red('error') : iss.level === 'warning' ? C.yellow('warn ') : C.dim('info ');
      write(`\r\n${tag} ${iss.path ? iss.path + ': ' : ''}${iss.text}`);
    }
    if (!report.ok) return undefined;
    if (report.danger.level !== 'safe' && pendingConfirm.current !== confirmKey) {
      pendingConfirm.current = confirmKey;
      write(`\r\n${report.danger.level === 'destructive' ? C.red('DESTRUCTIVE') : C.yellow('CAUTION')}: ${report.danger.reasons.join(' ')}`);
      write(`\r\n${C.yellow('Press Enter again to send it, Ctrl-C to cancel.')}`);
      return undefined;
    }
    pendingConfirm.current = null;
    if (!quiet) write(`\r\n${C.dim(JSON.stringify(msg))}`);
    try {
      return await client.sendMessage(msg, {
        onProgress: (n) => write(`\r\n${C.cyan('notification')} ${JSON.stringify(n)}`),
      });
    } catch (err: any) {
      write(`\r\n${C.red(`error: ${err?.message ?? err}`)}`);
      if (err?.response && cmd === null) write(`\r\n${nl(JSON.stringify(err.response, null, 2))}`);
      return undefined;
    }
  };

  const runPeriodic = async (cmd: MonitorCommandType, msg: any, periodS: number) => {
    let stopped = false;
    let wake: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Stopping must also end the sleep, or the loop (and stopRef) never exit.
    stopRef.current = () => { stopped = true; if (timer) clearTimeout(timer); wake?.(); };
    write(`\r\n${C.dim(`every ${periodS}s, Enter stops`)}`);
    try {
      while (!stopped) {
        const resp = await request(msg, `periodic:${cmd.value}`, cmd, true);
        if (resp === undefined || stopped) break;
        write(`\r\n${C.dim(new Date().toLocaleTimeString())}`);
        printResponse(cmd, resp);
        await new Promise<void>((r) => { wake = r; timer = setTimeout(r, periodS * 1000); });
        wake = null;
      }
    } finally {
      stopRef.current = null;
    }
  };

  const runStream = async (msg: any) => {
    let stopped = false;
    stopRef.current = () => { stopped = true; };
    write(`\r\n${C.dim('streaming log_get (this connection only), Enter stops')}`);
    try {
      while (!stopped) {
        const resp = await request(msg, 'stream', null, true);
        if (resp === undefined || stopped) break;
        if (resp.discontinuity) write(`\r\n${C.yellow(`[${resp.discontinuity} logs dropped by the server buffer]`)}`);
        for (const l of resp.logs ?? []) {
          const ts = typeof l.timestamp === 'number' ? new Date(l.timestamp).toISOString().slice(11, 23) : '';
          const first = Array.isArray(l.data) ? String(l.data[0] ?? '') : String(l.data ?? '');
          const lvl = l.level === 'error' ? C.red(l.level) : l.level === 'warn' ? C.yellow(l.level) : C.dim(String(l.level ?? ''));
          write(`\r\n${ts} [${l.layer ?? '?'}] ${lvl} ${l.dir ?? ''} ${l.ue_id !== undefined ? `ue=${l.ue_id} ` : ''}${first}`);
        }
      }
    } finally {
      // The in-flight log_get (at most `timeout` s) is simply ignored after stop.
      stopRef.current = null;
    }
  };

  const printHelp = () => {
    const sections = getMonitorCommands(ctxRef.current.connectionType);
    for (const s of sections) {
      write(`\r\n${C.cyan(s.category)}`);
      for (const c of s.items) write(`\r\n  ${(c.example ?? c.value).padEnd(44)} ${c.cliOnly ? C.dim('[CLI only] ') : ''}${c.description}`);
    }
    write(`\r\n${C.dim('Raw JSON lines ({...} or [...]) are sent as remote API requests.')}`);
  };

  const execLine = async (line: string) => {
    const text = line.trim();
    if (!text) return;
    if (text.startsWith('{') || text.startsWith('[')) {
      let parsed: any;
      try { parsed = JSON.parse(text); } catch (e) { write(`\r\n${C.red(`Invalid JSON: ${(e as Error).message}`)}`); return; }
      if (Array.isArray(parsed)) {
        for (const m of parsed) {
          const r = await request(m, `raw:${text}`, null);
          if (r !== undefined) printResponse(null, r);
        }
        return;
      }
      const r = await request(parsed, `raw:${text}`, null);
      if (r !== undefined) printResponse(null, r);
      return;
    }
    const hit = resolveMonitorLine(ctxRef.current.connectionType, text);
    if (!hit) {
      write(`\r\n${C.red(`Unknown command: ${text.split(/\s+/)[0]}`)} ${C.dim('(type help)')}`);
      return;
    }
    const { cmd, args } = hit;
    if (cmd.value === 'help') printHelp();
    if (cmd.cliOnly) {
      write(`\r\n${C.yellow('CLI only:')} ${cmd.cliOnly}`);
      return;
    }
    if (!cmd.toApi) return;
    const periodArg = cmd.periodic && args.length && /^\d+(\.\d+)?$/.test(args[0]) ? Number(args[0]) : undefined;
    const built = cmd.toApi(cmd.periodic && periodArg !== undefined ? args.slice(1) : args);
    if (typeof built === 'string') {
      write(`\r\n${C.yellow(built)}`);
      return;
    }
    if (cmd.periodic) return runPeriodic(cmd, built, Math.max(0.5, periodArg ?? 1));
    if (cmd.stream) return runStream(built);
    const resp = await request(built, `cmd:${text}`, cmd);
    if (resp !== undefined) printResponse(cmd, resp);
  };

  const submit = async (line: string) => {
    if (line.trim()) {
      historyRef.current = [line, ...historyRef.current.filter((h) => h !== line)].slice(0, 50);
    }
    historyPos.current = -1;
    busyRef.current = true;
    const confirmBefore = pendingConfirm.current;
    try {
      await execLine(line);
    } finally {
      busyRef.current = false;
      // A risky command waiting for confirmation stays on the prompt, so a
      // second Enter sends it (any edit or Ctrl-C cancels).
      const awaiting = pendingConfirm.current !== null && pendingConfirm.current !== confirmBefore;
      lineRef.current = awaiting ? line : '';
      if (!awaiting) pendingConfirm.current = null;
      prompt();
    }
  };

  // ── Mount terminal once.
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      fontSize: config.fontSize,
      fontFamily: 'monospace',
      theme: { background: '#1a1b26', foreground: '#a9b1d6', cursor: '#f8f8f2' },
      cursorBlink: true,
      scrollback: 5000,
      rows: 30,
      cols: 120,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    setTimeout(() => {
      try { fit.fit(); } catch { /* fit fails on hidden tabs; re-fit on font change */ }
    }, 50);

    terminalInstance.current = term;
    fitAddon.current = fit;
    term.write(C.cyan(`${connectionType} monitor over the remote API. Type help. Click Connect above to start.`));
    term.write(`\r\n${PROMPT}`);

    const sub = term.onData((data) => {
      // A running trace/stream: Enter or Ctrl-C stops it.
      if (stopRef.current) {
        if (data === '\r' || data === '\x03') {
          stopRef.current();
          term.write(`\r\n${C.dim('[stopped]')}`);
        }
        return;
      }
      if (busyRef.current) return;
      if (data === '\r') {
        const line = lineRef.current;
        void submit(line);
        return;
      }
      if (data === '\x7f' || data === '\b') {
        if (lineRef.current.length) {
          lineRef.current = lineRef.current.slice(0, -1);
          term.write('\b \b');
        }
        return;
      }
      if (data === '\x03') {
        lineRef.current = '';
        pendingConfirm.current = null;
        term.write(`^C\r\n${PROMPT}`);
        return;
      }
      if (data === '\x1b[A' || data === '\x1b[B') {
        const h = historyRef.current;
        if (!h.length) return;
        historyPos.current = data === '\x1b[A' ? Math.min(h.length - 1, historyPos.current + 1) : Math.max(-1, historyPos.current - 1);
        const next = historyPos.current >= 0 ? h[historyPos.current] : '';
        term.write('\r\x1b[2K' + PROMPT + next);
        lineRef.current = next;
        return;
      }
      if (data.startsWith('\x1b')) return; // other escape sequences
      const printable = data.replace(/[\x00-\x1f]/g, '');
      if (printable) {
        lineRef.current += printable;
        term.write(printable);
      }
    });

    return () => {
      stopRef.current?.();
      sub.dispose();
      try { term.dispose(); } catch { /* already disposed */ }
      terminalInstance.current = null;
      fitAddon.current = null;
    };
    // Mount once; font size is applied separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connection state notices; stop running loops on disconnect.
  useEffect(() => {
    const term = terminalInstance.current;
    if (!term) return;
    if (!wsClient || !connected) {
      stopRef.current?.();
      term.write(`\r\n${C.yellow('[disconnected]')}\r\n${PROMPT}${lineRef.current}`);
      return;
    }
    term.write(`\r\n${C.green(`[connected to ${connectionType}${serverVersion ? ` ${serverVersion}` : ''}]`)}\r\n${PROMPT}${lineRef.current}`);
  }, [wsClient, connected, connectionType, serverVersion]);

  useEffect(() => {
    const term = terminalInstance.current;
    if (!term) return;
    term.options.fontSize = config.fontSize;
    setTimeout(() => { try { fitAddon.current?.fit(); } catch { /* hidden */ } }, 0);
  }, [config.fontSize]);

  const handleFontSize = (delta: number) => {
    const newSize = Math.max(8, Math.min(24, config.fontSize + delta));
    setConfig({ fontSize: newSize });
    try {
      window.localStorage.setItem('screen_monitor_config', JSON.stringify({ fontSize: newSize }));
    } catch { /* storage unavailable */ }
  };

  const runPicked = (value: string) => {
    if (busyRef.current || stopRef.current) return;
    const cmd = currentCategoryCommands.find((c) => c.value === value);
    // Commands needing arguments are typed, not sent blank.
    if (cmd?.example && /<[^>]+>/.test(cmd.example.replace(cmd.value, ''))) {
      lineRef.current = `${cmd.value} `;
      write(`\r\x1b[2K${PROMPT}${lineRef.current}`);
      write(`  ${C.dim(cmd.example)}`);
      write(`\r\x1b[2K${PROMPT}${lineRef.current}`);
      terminalInstance.current?.focus();
      return;
    }
    lineRef.current = value;
    write(value);
    void submit(value);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <div className="space-y-1">
          <Kicker>Category</Kicker>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {availableCommands.map((category) => (
                <SelectItem key={category.category} value={category.category} description={category.description}>
                  {category.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Kicker>Command</Kicker>
          <Select value="" onValueChange={runPicked} disabled={!selectedCategory}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Run or insert a command" />
            </SelectTrigger>
            <SelectContent>
              {currentCategoryCommands.map((cmd) => (
                <SelectItem key={cmd.value} value={cmd.value} description={cmd.cliOnly ? `CLI only · ${cmd.description}` : (cmd.example ?? cmd.description)}>
                  {cmd.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="flex-1 min-w-[200px] text-xs text-muted-foreground">
          Console commands are translated to documented remote API messages. Risky ones ask for a second Enter.
        </p>

        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleFontSize(1)}>A+</Button>
          <Button variant="ghost" size="sm" onClick={() => handleFontSize(-1)} disabled={config.fontSize <= 8}>A-</Button>
        </div>
      </div>

      <div
        className="w-full h-[600px] rounded-lg overflow-hidden"
        style={{ backgroundColor: '#1a1b26', padding: '12px' }}
        onClick={() => terminalInstance.current?.focus()}
      >
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default ScreenMonitor;

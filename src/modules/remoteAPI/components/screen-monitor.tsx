// Screen Monitor — interactive terminal that streams the Amarisoft `monitor`
// channel. The server pushes `{message: "monitor", data: "<output>"}` frames
// back; we render them into an xterm.js terminal.
//
// Why this used to look broken:
//   1. The terminal mount effect early-returned when `!connected`, so before
//      you hit Connect there was just an empty black box and no signal that
//      the panel even worked.
//   2. Outbound monitor commands went through sendMessage(), which auto-
//      assigned a message_id. The server echoed that id on its first reply,
//      so the response got matched to a pending Promise and resolved silently
//      — the terminal never received a 'message' event because handleMessage
//      consumed the response before reaching the emit() path.
//
// Fix: render the terminal unconditionally with an inline status header. Use
// the new wsClient.sendRaw() (no message_id, no pending tracking) for the
// monitor channel, and listen on the 'monitor' event for streamed output.

import React, { useEffect, useRef, useState } from 'react';
import 'xterm/css/xterm.css';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { Button } from '@/components/ui/button';
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
import { getMonitorCommands } from './monitor-commands';

interface ScreenMonitorProps {
  themeConfig: ThemeConfig;
  wsClient: WebSocketClient | null;
  connected: boolean;
  connectionType: ComponentType;
}

const ScreenMonitor = ({ wsClient, connected, connectionType }: ScreenMonitorProps) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [commandInput, setCommandInput] = useState<string>('');
  const availableCommands = getMonitorCommands(connectionType);

  const [config, setConfig] = useState<{ fontSize: number }>(() => {
    if (typeof window === 'undefined') return { fontSize: 14 };
    const saved = window.localStorage.getItem('screen_monitor_config');
    return saved ? JSON.parse(saved) : { fontSize: 14 };
  });

  const currentCategoryCommands =
    availableCommands.find((cat) => cat.category === selectedCategory)?.items ?? [];

  // ── Mount terminal once on first render. We DON'T re-create it when
  //    `connected` toggles — that used to wipe scrollback every time the
  //    connection state changed. Instead, the wsClient/connected effect
  //    below attaches/detaches the data flow.
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      fontSize: config.fontSize,
      fontFamily: 'monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#f8f8f2',
      },
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
      try { fit.fit(); } catch { /* fit silently fails on hidden tabs; we re-fit on show */ }
    }, 50);

    terminalInstance.current = term;
    fitAddon.current = fit;
    term.write(`\x1b[36m${connectionType} monitor — click Connect above to start streaming.\x1b[0m\r\n`);

    return () => {
      try { term.dispose(); } catch { /* already disposed */ }
      terminalInstance.current = null;
      fitAddon.current = null;
    };
    // Intentionally only on mount; font-size is applied separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Wire the data flow whenever wsClient / connected changes.
  useEffect(() => {
    const term = terminalInstance.current;
    if (!term) return;

    if (!wsClient || !connected) {
      term.write('\r\n\x1b[33m[disconnected]\x1b[0m\r\n');
      return;
    }

    term.write(`\r\n\x1b[32m[connected — type a command or pick one above]\x1b[0m\r\n`);

    // User-typed input flows out as monitor data. sendRaw skips the
    // message_id machinery so the server's streamed reply arrives via the
    // 'monitor' event instead of a Promise resolve.
    const onInput = (data: string) => {
      try {
        wsClient.sendRaw({ message: 'monitor', data });
      } catch (err) {
        term.write(`\r\n\x1b[31m[send failed: ${(err as Error).message}]\x1b[0m\r\n`);
      }
    };
    const inputDispose = term.onData(onInput);

    // Server-pushed monitor frames stream back here.
    const onMonitor = (msg: any) => {
      const text = typeof msg === 'string'
        ? msg
        : (msg?.data ?? JSON.stringify(msg) + '\r\n');
      term.write(text);
    };
    wsClient.on('monitor', onMonitor);

    return () => {
      try { inputDispose.dispose(); } catch { /* terminal already torn down */ }
      wsClient.off('monitor', onMonitor);
    };
  }, [wsClient, connected]);

  // ── Apply font-size changes without re-mounting the terminal.
  useEffect(() => {
    const term = terminalInstance.current;
    if (!term) return;
    term.options.fontSize = config.fontSize;
    setTimeout(() => fitAddon.current?.fit(), 0);
  }, [config.fontSize]);

  const handleFontSize = (delta: number) => {
    const newSize = Math.max(8, Math.min(24, config.fontSize + delta));
    setConfig({ fontSize: newSize });
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('screen_monitor_config', JSON.stringify({ fontSize: newSize }));
    }
  };

  const sendCommand = (cmd: string) => {
    if (!cmd) return;
    if (!wsClient || !connected) {
      terminalInstance.current?.write(
        `\r\n\x1b[31m[not connected — click Connect above first]\x1b[0m\r\n`,
      );
      return;
    }
    try {
      wsClient.sendRaw({ message: 'monitor', data: cmd + '\n' });
      terminalInstance.current?.write(`\r\n\x1b[2m> ${cmd}\x1b[0m\r\n`);
    } catch (err) {
      terminalInstance.current?.write(
        `\r\n\x1b[31m[send failed: ${(err as Error).message}]\x1b[0m\r\n`,
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4 bg-blue-50/90 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
        {/* Category Selection */}
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px] bg-white/80 dark:bg-gray-800/90 border-blue-200 dark:border-blue-900">
            <SelectValue placeholder="Select Category" />
          </SelectTrigger>
          <SelectContent>
            {availableCommands.map((category) => (
              <SelectItem key={category.category} value={category.category}>
                {category.category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Command Selection */}
        <Select
          value={commandInput}
          onValueChange={(value) => {
            setCommandInput(value);
            sendCommand(value);
            setCommandInput('');
          }}
          disabled={!selectedCategory}
        >
          <SelectTrigger className="w-[300px] bg-white/80 dark:bg-gray-800/90 border-blue-200 dark:border-blue-900">
            <SelectValue placeholder="Select Command" />
          </SelectTrigger>
          <SelectContent>
            {currentCategoryCommands.map((cmd) => (
              <SelectItem key={cmd.value} value={cmd.value} title={cmd.example}>
                <div className="flex flex-col">
                  <span className="font-medium">{cmd.label}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {cmd.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1 flex justify-end space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFontSize(1)}
            className="text-blue-700 dark:text-blue-400"
          >
            A+
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFontSize(-1)}
            className="text-blue-700 dark:text-blue-400"
            disabled={config.fontSize <= 8}
          >
            A-
          </Button>
        </div>
      </div>

      <div
        className="w-full h-[600px] rounded-lg overflow-hidden"
        style={{ backgroundColor: '#1a1b26', padding: '12px' }}
      >
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default ScreenMonitor;

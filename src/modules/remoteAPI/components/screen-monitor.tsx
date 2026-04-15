import React, { useEffect, useRef, useState } from 'react';
//import { Terminal } from 'xterm';
//import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
//import type { ITerminalOptions } from 'xterm';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, HelpCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ScreenMonitor = ({ themeConfig, wsClient, connected, connectionType }: ScreenMonitorProps) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const terminalInstance = useRef<Terminal | null>(null);
    const fitAddon = useRef<FitAddon | null>(null);
    
    // Command selection states
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [commandInput, setCommandInput] = useState<string>('');
    const availableCommands = getMonitorCommands(connectionType);

    const [config, setConfig] = useState(() => {
        const saved = localStorage.getItem('screen_monitor_config');
        return saved ? JSON.parse(saved) : {
            fontSize: 14
        };
    });

    // Get current category commands
    const currentCategoryCommands = availableCommands.find(
        cat => cat.category === selectedCategory
    )?.items || [];

    const sendCommand = (cmd: string) => {
        if (wsClient && cmd) {
            wsClient.sendMessage({
                message: 'monitor',
                data: cmd + '\n'
            });
        }
    };

    const initializeTerminal = () => {
        const term = new Terminal({
            fontSize: config.fontSize,
            fontFamily: 'monospace',
            theme: {
                background: '#1a1b26',
                foreground: '#a9b1d6',
                cursor: '#f8f8f2',
                selection: '#283457',
                black: '#15161E',
                brightBlack: '#414868',
                red: '#F7768E',
                brightRed: '#F7768E',
                green: '#9ECE6A',
                brightGreen: '#9ECE6A',
                yellow: '#E0AF68',
                brightYellow: '#E0AF68',
                blue: '#7AA2F7',
                brightBlue: '#7AA2F7',
                magenta: '#BB9AF7',
                brightMagenta: '#BB9AF7',
                cyan: '#7DCFFF',
                brightCyan: '#7DCFFF',
                white: '#A9B1D6',
                brightWhite: '#C0CAF5'
            },
            cursorBlink: true,
            scrollback: 5000,
            rows: 30,
            cols: 120,
            convertEol: true,
            padding: 12
        });

        fitAddon.current = new FitAddon();
        term.loadAddon(fitAddon.current);

        // Enable direct input in terminal
        term.onData((data) => {
            if (wsClient) {
                wsClient.sendMessage({
                    message: 'monitor',
                    data: data
                });
            }
        });

        return term;
    };

    useEffect(() => {
        if (!terminalRef.current || !connected || !wsClient) return;

        const term = new Terminal({
            fontSize: config.fontSize,
            fontFamily: 'monospace',
            rows: 30,
            cols: 120,
            cursorBlink: true,
            convertEol: true
        });

        const fit = new FitAddon();
        term.loadAddon(fit);

        // First open the terminal
        term.open(terminalRef.current);
        
        // Then wait a bit before fitting
        setTimeout(() => {
            try {
                fit.fit();
            } catch (e) {
                console.warn('Fit failed:', e);
            }
        }, 100);

        terminalInstance.current = term;
        fitAddon.current = fit;

        // Use sendMessage from wsClient instead of raw websocket
        const handleInput = (data: string) => {
            if (wsClient && connected) {
                wsClient.sendMessage({
                    message: 'monitor',
                    data: data
                });
            }
        };

        term.onData(handleInput);

        // Handle websocket messages at class level
        const messageHandler = (event: any) => {
            if (!term || !event) return;
            
            let data = event;
            // Handle both string and object messages
            if (typeof data === 'object') {
                if (data.data) {
                    data = data.data;
                } else {
                    data = JSON.stringify(data) + '\r\n';
                }
            }
            
            term.write(data);
        };

        wsClient.on('message', messageHandler);

        term.write(`***** Initializing ${connectionType} Monitor *****\r\n`);

        return () => {
            wsClient.off('message', messageHandler);
            if (terminalInstance.current) {
                terminalInstance.current.dispose();
                terminalInstance.current = null;
            }
            fitAddon.current = null;
        };
    }, [connected, config.fontSize, wsClient, connectionType]);

    useEffect(() => {
        return () => {
            if (terminalInstance.current) {
                try {
                    terminalInstance.current.dispose();
                } catch (error) {
                    console.error('Terminal disposal error:', error);
                }
                terminalInstance.current = null;
            }
            if (fitAddon.current) {
                fitAddon.current = null;
            }
        };
    }, []);

    const handleFontSize = (delta: number) => {
        const newSize = config.fontSize + delta;
        if (newSize < 8 || newSize > 24) return;

        setConfig(prev => {
            const newConfig = { ...prev, fontSize: newSize };
            localStorage.setItem('screen_monitor_config', JSON.stringify(newConfig));
            return newConfig;
        });

        if (terminalInstance.current) {
            terminalInstance.current.options.fontSize = newSize;
            setTimeout(() => fitAddon.current?.fit(), 0);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-4 bg-blue-50/90 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                {/* Category Selection */}
                <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                >
                    <SelectTrigger className="w-[200px] bg-white/80 dark:bg-gray-800/90 border-blue-200 dark:border-blue-900 hover:bg-white dark:hover:bg-gray-800">
                        <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-900">
                        {availableCommands.map((category) => (
                            <SelectItem 
                                key={category.category} 
                                value={category.category}
                                className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
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
                    <SelectTrigger className="w-[300px] bg-white/80 dark:bg-gray-800/90 border-blue-200 dark:border-blue-900 hover:bg-white dark:hover:bg-gray-800">
                        <SelectValue placeholder="Select Command" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-900">
                        {currentCategoryCommands.map((cmd) => (
                            <SelectItem 
                                key={cmd.value} 
                                value={cmd.value}
                                title={cmd.example}
                                className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium">{cmd.label}</span>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                        {cmd.description}
                                    </span>
                                    {cmd.example && (
                                        <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                                            {cmd.example}
                                        </span>
                                    )}
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
                        className="text-blue-700 dark:text-blue-400 hover:bg-blue-100/50 dark:hover:bg-blue-900/50"
                    >
                        A+
                    </Button>
                    {config.fontSize > 8 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFontSize(-1)}
                            className="text-blue-700 dark:text-blue-400 hover:bg-blue-100/50 dark:hover:bg-blue-900/50"
                        >
                            A-
                        </Button>
                    )}
                </div>
            </div>

            <div 
                className="w-full h-[600px] rounded-lg overflow-hidden"
                style={{ backgroundColor: '#1a1b26', padding: '12px' }}
            >
                <div 
                    ref={terminalRef}
                    className="w-full h-full"
                />
            </div>
        </div>
    );
};

export default ScreenMonitor;
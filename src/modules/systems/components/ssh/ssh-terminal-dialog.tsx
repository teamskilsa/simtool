// modules/systems/components/ssh/ssh-terminal-dialog.tsx
import { useState, useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { agentUrl } from '@/lib/constants';
import { Resizable } from 're-resizable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SSHTerminalOutput } from './ssh-terminal-output';
import { useSystemConnection } from '../../hooks/use-system-connection';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../../types';

interface SSHTerminalDialogProps {
  system: System;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SSHTerminalDialog({ system, open, onOpenChange }: SSHTerminalDialogProps) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const { testSSHConnection } = useSystemConnection();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const connectToSystem = async () => {
      if (open && !connected) {
        setLoading(true);
        try {
          const success = await testSSHConnection(system);
          setConnected(success);
          if (!success) {
            toast({
              title: "Connection Failed",
              description: "Failed to establish SSH connection",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('SSH connection failed:', error);
          setConnected(false);
          toast({
            title: "Connection Error",
            description: error instanceof Error ? error.message : "Failed to connect",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }
    };

    connectToSystem();
  }, [open, system, connected, testSSHConnection]);

  // Focus input when connected
  useEffect(() => {
    if (connected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [connected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !connected) return;

    try {
      setOutput(prev => [...prev, `$ ${command}`]);
      const result = await fetch(agentUrl(system.ip, '/api/ssh/execute'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command,
          username: system.username,
          password: system.password,
          host: system.ip
        })
      });

      const response = await result.json();
      if (response.success) {
        setOutput(prev => [...prev, response.output]);
      } else {
        throw new Error(response.error || 'Command execution failed');
      }
      
      setCommand('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Command failed';
      setOutput(prev => [...prev, `Error: ${errorMessage}`]);
      toast({
        title: "Command Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="terminal-dialog p-0">
        <Resizable
          defaultSize={{
            width: '40vw',
            height: '80vh',
          }}
          minWidth={100}
          minHeight={400}
          maxWidth="95vw"
          maxHeight="95vh"
          enable={{
            top: false,
            right: true,
            bottom: true,
            left: false,
            topRight: false,
            bottomRight: true,
            bottomLeft: false,
            topLeft: false
          }}
          handleClasses={{
            bottomRight: 'resize-handle'
          }}
        >
          <div className="terminal-window">
            <DialogHeader className="px-6 py-3 border-b border-white/10">
              <DialogTitle className="flex items-center gap-2 text-terminal-text">
                <Terminal className="w-5 h-5" />
                <div>
                  <div className="font-medium">{system.name}</div>
                  <div className="text-sm opacity-70">{system.ip}</div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="terminal-output custom-scrollbar">
              <SSHTerminalOutput 
                loading={loading}
                output={output}
              />
            </div>

            <div className="px-6 py-3 border-t border-white/10">
              <form onSubmit={handleSubmit} className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-prompt">$</span>
                <Input
                  ref={inputRef}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder={connected ? "Enter command..." : "Connecting..."}
                  disabled={!connected}
                  className="pl-7 font-mono bg-gray-800 text-white border-white/10 focus:border-white/20 focus:ring-white/20 placeholder-gray-400"
                />
              </form>
            </div>
          </div>
        </Resizable>
      </DialogContent>
    </Dialog>
  );
}
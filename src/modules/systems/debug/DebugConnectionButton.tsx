// modules/systems/components/debug/DebugConnectionButton.tsx
import { useState } from 'react';
import { Bug, Check, X, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { useSystemConnection } from '../hooks/use-system-connection';
import type { System } from '../types';

interface DebugConnectionButtonProps {
  system: System;
  onConnectionUpdate?: (status: {
    pingOk: boolean;
    sshOk: boolean;
    lastError?: string;
  }) => void;
}

export function DebugConnectionButton({ system, onConnectionUpdate }: DebugConnectionButtonProps) {
  const [testing, setTesting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [testResults, setTestResults] = useState<{
    pingOk: boolean;
    sshOk: boolean;
  }>({ pingOk: false, sshOk: false });
  
  const { testSystemReachability, testSSHConnection } = useSystemConnection();
  
  const handleDebug = async () => {
    console.log('Debug button clicked for system:', {
      id: system.id,
      name: system.name,
      ip: system.ip
    });
    
    setTesting(true);
    try {
      // Test basic connectivity
      const pingOk = await testSystemReachability(system.ip);
      console.log('Reachability test result:', pingOk);
      
      // Test SSH if ping successful
      let sshOk = false;
      if (pingOk) {
        sshOk = await testSSHConnection(system);
        console.log('SSH test result:', sshOk);
      }

      const results = {
        pingOk,
        sshOk,
        error: !pingOk ? 'System not reachable' : 
               !sshOk ? 'SSH connection failed' : undefined
      };

      setTestResults(results);
      setShowResults(true);

      // Only call if callback is provided
      if (typeof onConnectionUpdate === 'function') {
        onConnectionUpdate(results);
      }

      toast({
        title: (pingOk && sshOk) ? "Connection Success" : "Connection Issues",
        description: (pingOk && sshOk)
          ? "System is reachable and services are available" 
          : results.error,
        variant: (pingOk && sshOk) ? "default" : "warning",
      });
    } catch (error) {
      console.error('Debug failed:', error);
      toast({
        title: "Debug Error",
        description: error instanceof Error ? error.message : 'Failed to complete connection tests',
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDebug}
        disabled={testing}
      >
        {testing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Bug className="w-4 h-4" />
        )}
      </Button>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connection Test Results for {system.ip}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Network Connectivity</span>
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                testResults.pingOk ? <Check className="w-4 h-4 text-green-500" /> : 
                                   <X className="w-4 h-4 text-red-500" />
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span>SSH Connection</span>
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                testResults.sshOk ? <Check className="w-4 h-4 text-green-500" /> : 
                                   <X className="w-4 h-4 text-red-500" />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
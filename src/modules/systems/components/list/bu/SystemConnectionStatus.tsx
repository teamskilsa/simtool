// modules/systems/components/list/SystemConnectionStatus.tsx
import { Wifi, Shield } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConnectionStatusProps {
  connection?: {
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    lastError?: string;
    pingOk?: boolean;
    sshOk?: boolean;
  };
}

export function SystemConnectionStatus({ connection }: ConnectionStatusProps) {
  const renderNetworkStatus = () => (
    <Tooltip>
      <TooltipTrigger>
        <div className={`
          rounded-full p-1
          ${connection?.pingOk 
            ? 'bg-green-100 text-green-600' 
            : 'bg-red-100 text-red-600'}
        `}>
          <Wifi className="w-4 h-4" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Network: {connection?.pingOk ? 'Connected' : 'Disconnected'}</p>
      </TooltipContent>
    </Tooltip>
  );

  const renderSSHStatus = () => (
    <Tooltip>
      <TooltipTrigger>
        <div className={`
          rounded-full p-1
          ${connection?.sshOk 
            ? 'bg-green-100 text-green-600' 
            : 'bg-red-100 text-red-600'}
        `}>
          <Shield className="w-4 h-4" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>SSH: {connection?.sshOk ? 'Available' : 'Unavailable'}</p>
        {connection?.lastError && (
          <p className="text-xs text-red-500">{connection.lastError}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        {renderNetworkStatus()}
        {renderSSHStatus()}
      </TooltipProvider>
    </div>
  );
}

export function SystemStatusBadge({ connection }: ConnectionStatusProps) {
  return (
    <div className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
      ${connection?.status === 'connected' ? 'bg-green-100 text-green-600' : 
        connection?.status === 'connecting' ? 'bg-yellow-100 text-yellow-600' :
        'bg-red-100 text-red-600'}
    `}>
      <span className="w-1 h-1 mr-1.5 rounded-full bg-current" />
      {connection?.status || 'disconnected'}
    </div>
  );
}

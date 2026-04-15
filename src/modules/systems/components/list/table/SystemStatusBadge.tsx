// modules/systems/components/list/table/SystemConnectionStatus.tsx
import { Wifi, Shield } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConnectionProps {
  connection?: {
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    lastError?: string;
    pingOk?: boolean;
    sshOk?: boolean;
  };
}

export function SystemConnectionStatus({ connection }: ConnectionProps) {
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

// modules/systems/components/list/table/SystemStatusBadge.tsx
interface StatusBadgeProps {
  connection?: {
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
  };
}

export function SystemStatusBadge({ connection }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (connection?.status) {
      case 'connected':
        return 'bg-green-100 text-green-600';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-600';
      case 'error':
      case 'disconnected':
      default:
        return 'bg-red-100 text-red-600';
    }
  };

  return (
    <div className={`
      inline-flex items-center px-2.5 py-0.5 
      rounded-full text-xs font-medium
      ${getStatusStyles()}
    `}>
      <span className="w-1 h-1 mr-1.5 rounded-full bg-current" />
      {connection?.status || 'disconnected'}
    </div>
  );
}

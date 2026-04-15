// modules/systems/components/shared/connection-status.tsx
import { Wifi, Shield, Terminal, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ConnectionStatusProps {
  pingStatus: boolean;
  sshStatus: boolean;
  lastError?: string;
  lastChecked?: string;
}

export function ConnectionStatus({ 
  pingStatus, 
  sshStatus, 
  lastError,
  lastChecked 
}: ConnectionStatusProps) {
  const StatusIcon = ({ success, icon: Icon, label }: { 
    success: boolean; 
    icon: any; 
    label: string;
  }) => (
    <Tooltip>
      <TooltipTrigger>
        <div className={`
          rounded-full p-1
          ${success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}
        `}>
          <Icon className="w-4 h-4" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}: {success ? 'OK' : 'Failed'}</p>
        {!success && lastError && <p className="text-xs text-red-500">{lastError}</p>}
        {lastChecked && <p className="text-xs text-gray-500">Last checked: {lastChecked}</p>}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex items-center gap-2">
      <StatusIcon 
        success={pingStatus} 
        icon={Wifi} 
        label="Network Ping"
      />
      <StatusIcon 
        success={sshStatus} 
        icon={Shield} 
        label="SSH Connection"
      />
    </div>
  );
}

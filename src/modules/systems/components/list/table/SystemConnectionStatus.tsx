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

function ConnectionIcon({
  ok,
  icon: Icon,
  label,
  errorMessage,
}: {
  ok?: boolean;
  icon: React.ElementType;
  label: string;
  errorMessage?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`
            rounded-full p-1.5 cursor-default
            ${ok
              ? 'bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400'
              : 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400'
            }
          `}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">{label}: {ok ? 'OK' : 'Failed'}</p>
        {!ok && errorMessage && (
          <p className="text-muted-foreground mt-0.5 max-w-[200px]">{errorMessage}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function SystemConnectionStatus({ connection }: ConnectionProps) {
  return (
    <div className="flex items-center gap-1.5">
      <TooltipProvider delayDuration={200}>
        <ConnectionIcon
          ok={connection?.pingOk}
          icon={Wifi}
          label="Network"
        />
        <ConnectionIcon
          ok={connection?.sshOk}
          icon={Shield}
          label="SSH"
          errorMessage={connection?.lastError}
        />
      </TooltipProvider>
    </div>
  );
}

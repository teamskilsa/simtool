// modules/systems/components/shared/service-status.tsx
import { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";

interface ServiceStatusProps {
  systemId: string;
  serviceName: string;
}

export function ServiceStatus({ systemId, serviceName }: ServiceStatusProps) {
  const [status, setStatus] = useState<'running' | 'stopped' | 'error'>('stopped');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/systems/${systemId}/services/${serviceName}/status`);
        if (!response.ok) throw new Error('Failed to fetch service status');
        
        const data = await response.json();
        setStatus(data.status);
      } catch (error) {
        setStatus('error');
        toast({
          title: "Service Status Error",
          description: `Failed to check ${serviceName} service status`,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [systemId, serviceName]);

  const getStatusColor = () => {
    switch (status) {
      case 'running': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'running': return CheckCircle;
      case 'error': return AlertCircle;
      default: return Activity;
    }
  };

  const StatusIcon = getStatusIcon();

  return (
    <Tooltip>
      <TooltipTrigger>
        <div className={`flex items-center gap-2 ${getStatusColor()}`}>
          <StatusIcon className="w-4 h-4" />
          <span className="text-sm font-medium capitalize">{serviceName}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{serviceName} service is {status}</p>
      </TooltipContent>
    </Tooltip>
  );
}

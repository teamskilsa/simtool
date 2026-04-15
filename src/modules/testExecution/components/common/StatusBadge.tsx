import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ExecutionStatus } from '../../types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ExecutionStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className
}) => {
  return (
    <Badge
      variant={
        status === 'success' ? 'success' :
        status === 'failure' ? 'destructive' :
        'secondary'
      }
      className={cn(
        "capitalize",
        status === 'running' && "animate-pulse",
        className
      )}
    >
      {status}
    </Badge>
  );
};

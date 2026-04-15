import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, RefreshCw } from 'lucide-react';
import { ExecutionStatus } from '../../types';

interface ExecutionControlsProps {
  status: ExecutionStatus;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  status,
  onStart,
  onPause,
  onStop,
  onReset,
  disabled = false
}) => {
  return (
    <div className="flex items-center gap-2">
      {status === 'running' ? (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onPause}
          disabled={disabled}
        >
          <Pause className="h-4 w-4 mr-2" />
          Pause
        </Button>
      ) : (
        <Button 
          variant="default" 
          size="sm" 
          onClick={onStart}
          disabled={disabled || status === 'success'}
        >
          <Play className="h-4 w-4 mr-2" />
          {status === 'pending' ? 'Start' : 'Resume'}
        </Button>
      )}

      <Button 
        variant="outline" 
        size="sm" 
        onClick={onStop}
        disabled={disabled || status === 'success' || status === 'pending'}
      >
        <Square className="h-4 w-4 mr-2" />
        Stop
      </Button>

      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onReset}
        disabled={disabled || status === 'running'}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Reset
      </Button>
    </div>
  );
};

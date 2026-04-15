// modules/systems/components/list/MonitoringControls.tsx
import { Tooltip } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';

export function MonitoringControls({ duration, interval, onChange, disabled }: MonitoringControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <Tooltip content="Duration in seconds for each monitoring session">
        <Input
          type="number"
          value={duration}
          onChange={(e) => onChange('duration', parseInt(e.target.value))}
          placeholder="Duration (s)"
          className="w-24"
          disabled={disabled}
        />
      </Tooltip>
      <Tooltip content="Refresh interval in seconds">
        <Input
          type="number"
          value={interval}
          onChange={(e) => onChange('interval', parseInt(e.target.value))}
          placeholder="Interval (s)"
          className="w-24"
          disabled={disabled}
        />
      </Tooltip>
    </div>
  );
}

// modules/systems/components/list/table/SystemInfo.tsx
import { SystemIcon } from './SystemIcon';
import type { System } from '../../../types';

export function SystemInfo({ system }: { system: System }) {
  return (
    <div className="flex items-center gap-3">
      <SystemIcon type={system.type} />
      <div>
        <div className="font-medium text-gray-900">{system.name}</div>
        <div className="text-sm text-gray-500">{system.ip}</div>
      </div>
    </div>
  );
}

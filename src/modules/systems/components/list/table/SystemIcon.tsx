// modules/systems/components/list/table/SystemIcon.tsx
import { Radio, Smartphone } from 'lucide-react';
import type { System } from '../../../types';

export function SystemIcon({ type }: { type: System['type'] }) {
  return (
    <div className="p-2 bg-gray-100 rounded-lg">
      {type === 'Callbox' ? (
        <Radio className="w-4 h-4 text-indigo-600" />
      ) : (
        <Smartphone className="w-4 h-4 text-indigo-600" />
      )}
    </div>
  );
}

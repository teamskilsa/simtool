// modules/systems/components/list/table.tsx
import { useState } from 'react';
import { SystemTableRow } from './table-row';
import { SystemFormDialog } from '../system-form-dialog';
import type { System } from '../../types';

interface SystemsTableProps {
  systems: System[];
  connections?: Map<number, {
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    lastError?: string;
    pingOk?: boolean;
    sshOk?: boolean;
  }>;
  onRefreshSystem: (systemId: number) => void;
  onEditSystem: (systemId: number, updates: Partial<System>) => Promise<void>;
  onDeleteSystem: (systemId: number) => Promise<void>;
  onConnectionUpdate?: (systemId: number, status: {
    pingOk: boolean;
    sshOk: boolean;
    lastError?: string;
  }) => void;
}

export function SystemsTable({ 
  systems, 
  connections = new Map(),
  onRefreshSystem,
  onEditSystem,
  onDeleteSystem 
}: SystemsTableProps) {
  const [editingSystem, setEditingSystem] = useState<System | null>(null);

  const handleSystemSubmit = async (_mode: 'add' | 'edit', systemId: number | undefined, updates: Partial<System>) => {
    if (!systemId) return;
    try {
      await onEditSystem(systemId, updates);
      setEditingSystem(null);
    } catch (error) {
      console.error('Failed to update system:', error);
    }
  };
  
  if (!systems.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        No systems found. Click "Add System" to get started.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                System Info
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                Connection
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                Resources
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                Configuration
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {systems.map((system) => (
              <SystemTableRow
              key={system.id}
              system={system}
              connection={connections.get(system.id)}
              onRefresh={() => onRefreshSystem(system.id)}
              onEdit={() => setEditingSystem(system)}
              onDelete={() => onDeleteSystem(system.id)}
              onConnectionUpdate={(status) => onConnectionUpdate?.(system.id, status)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {editingSystem && (
        <SystemFormDialog
          mode="edit"
          system={editingSystem}
          open={!!editingSystem}
          onOpenChange={(open) => !open && setEditingSystem(null)}
          onSubmit={handleSystemSubmit}
        />
      )}
    </>
  );
}
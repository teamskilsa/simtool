// modules/systems/components/list/table/SystemsTable.tsx
import { useState, useEffect } from 'react';
import { SystemTableRow } from './SystemTableRow';
import { SystemDialog } from '../../shared/SystemDialog';
import { toast } from "@/components/ui/use-toast";
import type { System } from '../../../types';
import type { ConnectionStatus } from '../../../types/connection';
import type { ProvisionResult } from '../../../services/provision';

interface SystemsTableProps {
  systems: System[];
  connections?: Map<number, ConnectionStatus>;
  onRefreshSystem: (systemId: number) => Promise<void>;
  onEditSystem: (systemId: number, updates: Partial<System>) => Promise<void>;
  onDeleteSystem: (systemId: number) => Promise<void>;
  onProvisionComplete?: (systemId: number, result: ProvisionResult) => void;
  updateSystemProvisionStatus?: (systemId: number, patch: Partial<System>) => void;
}

export function SystemsTable({
  systems,
  connections = new Map(),
  onRefreshSystem,
  onEditSystem,
  onDeleteSystem,
  onProvisionComplete,
  updateSystemProvisionStatus,
}: SystemsTableProps) {
  const [editingSystem, setEditingSystem] = useState<System | null>(null);
  const [localConnections, setLocalConnections] = useState(connections);

  // Update local state when props change
  useEffect(() => {
    setLocalConnections(new Map(connections));
  }, [connections]);

  const handleConnectionUpdate = (systemId: number, status: {
    pingOk: boolean;
    sshOk: boolean;
    lastError?: string;
  }) => {
    setLocalConnections(prev => {
      const newMap = new Map(prev);
      newMap.set(systemId, {
        status: status.sshOk ? 'connected' : 'error',
        ...status
      });
      return newMap;
    });
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
                connection={localConnections.get(system.id)}
                onRefresh={() => onRefreshSystem(system.id)}
                onEdit={() => setEditingSystem(system)}
                onDelete={() => onDeleteSystem(system.id)}
                onConnectionUpdate={(status) => handleConnectionUpdate(system.id, status)}
                onProvisionComplete={onProvisionComplete}
                updateSystemProvisionStatus={updateSystemProvisionStatus}
              />
            ))}
          </tbody>
        </table>
      </div>

      {editingSystem && (
        <SystemDialog
          mode="edit"
          system={editingSystem}
          open={!!editingSystem}
          onOpenChange={(open) => !open && setEditingSystem(null)}
          onSubmit={async (mode, systemId, updates) => {
            if (systemId) {
              await onEditSystem(systemId, updates);
              setEditingSystem(null);
            }
          }}
        />
      )}
    </>
  );
}

// modules/systems/components/list/table/SystemsTable.tsx
import { useState, useEffect } from 'react';
import { Server, PlusCircle } from 'lucide-react';
import { SystemTableRow } from './SystemTableRow';
import { SystemDialog } from '../../shared/SystemDialog';
import { Button } from '@/components/ui/button';
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
  /** Passed down to the empty-state CTA so it can open the add dialog */
  onAddSystem?: (data: Partial<System>) => Promise<System | void>;
}

const TABLE_HEADERS = [
  { label: 'System Info' },
  { label: 'Connection' },
  { label: 'Status' },
  { label: 'Resources' },
  { label: 'Configuration' },
  { label: 'Actions', align: 'right' as const },
];

export function SystemsTable({
  systems,
  connections = new Map(),
  onRefreshSystem,
  onEditSystem,
  onDeleteSystem,
  onProvisionComplete,
  updateSystemProvisionStatus,
  onAddSystem,
}: SystemsTableProps) {
  const [editingSystem, setEditingSystem] = useState<System | null>(null);
  const [localConnections, setLocalConnections] = useState(connections);

  useEffect(() => {
    setLocalConnections(new Map(connections));
  }, [connections]);

  const handleConnectionUpdate = (
    systemId: number,
    status: { pingOk: boolean; sshOk: boolean; lastError?: string }
  ) => {
    setLocalConnections((prev) => {
      const next = new Map(prev);
      next.set(systemId, { status: status.sshOk ? 'connected' : 'error', ...status });
      return next;
    });
  };

  if (!systems.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Server className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">No systems yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Add your first test system to start running automated network tests.
        </p>
        {onAddSystem && (
          <Button
            onClick={() => {
              // Trigger the parent's add flow by dispatching a click event on the AddSystem button
              // The parent header already renders <AddSystem>; this CTA re-uses it via the prop.
              document.getElementById('add-system-trigger')?.click();
            }}
            className="gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Add First System
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {TABLE_HEADERS.map((h) => (
                <th
                  key={h.label}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${h.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {h.label}
                </th>
              ))}
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
                onConnectionUpdate={(s) => handleConnectionUpdate(system.id, s)}
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

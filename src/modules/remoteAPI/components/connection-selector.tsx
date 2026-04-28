// src/modules/remoteAPI/components/connection-selector.tsx
//
// Connection picker for the Remote API page.
//
// The dropdown is now sourced from the shared Systems list
// (`useSystems()` — same store the Test Systems page manages) instead of a
// separate "savedConnections" localStorage entry. That used to drift out of
// sync the moment a system's IP changed in the Test Systems page; now there
// is one source of truth.
//
// Picking a system fills in the IP. Module type (ENB / UE / MME / IMS /
// MBMS) and port stay user-controlled — the user decides which subsystem
// they want to query, since a single Callbox typically runs several
// (eNB on 9001, MME on 9000, IMS on 9003, etc.).

import { useState, useEffect, useMemo } from 'react';
import type { ThemeConfig } from '@/components/theme/types/theme.types';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import type { System, SystemType } from '@/modules/systems/types';

type ComponentType = 'ENB' | 'UE' | 'MME' | 'IMS' | 'MBMS';

interface ConnectionDetails {
  ip: string;
  type: ComponentType;
  port: string;
  name?: string;
  /** Optional remote-API password — only needed when the callbox config
   *  sets `com_password`. Empty string for unauthenticated deployments. */
  password?: string;
}

interface ConnectionSelectorProps {
  themeConfig: ThemeConfig;
  onConnectionChange: (details: ConnectionDetails) => void;
}

const DEFAULT_PORTS: Record<ComponentType, string> = {
  'ENB': '9001',
  'UE':  '9002',
  'MME': '9000',
  'IMS': '9003',
  'MBMS':'9004',
};

/**
 * Suggest a default ComponentType for a saved system. The user can always
 * override after picking — this is just so the type chooser lands on the
 * obvious choice (eNB for callboxes, UE for sim boxes).
 */
function suggestType(systemType: SystemType): ComponentType {
  switch (systemType) {
    case 'Callbox': return 'ENB';
    case 'UESim':   return 'UE';
    case 'MME':     return 'MME';
    case 'SPGW':    return 'MME'; // SPGW shares the MME remote-API surface in this app
    default:        return 'ENB';
  }
}

export function ConnectionSelector({ themeConfig, onConnectionChange }: ConnectionSelectorProps) {
  const { systems } = useSystems();

  const [formData, setFormData] = useState<ConnectionDetails>({
    ip: '',
    type: 'ENB',
    port: '9001',
    password: '',
  });

  // Track which system the user picked so we can highlight it in the
  // dropdown when they come back. -1 means "manual entry / not from list".
  const [selectedSystemId, setSelectedSystemId] = useState<string>('');

  // Stable, unique list — the systems hook may have transient duplicates
  // during hot reload; dedupe by id.
  const sortedSystems = useMemo(() => {
    const seen = new Set<number>();
    const out: System[] = [];
    for (const s of systems) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(s);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [systems]);

  // When the user changes module type, snap the port to the default for
  // that type (they can still override). We avoid touching the IP here —
  // the IP belongs to the system selection, not the module type.
  useEffect(() => {
    setFormData(prev => ({ ...prev, port: DEFAULT_PORTS[prev.type] }));
  }, [formData.type]);

  const handlePickSystem = (id: string) => {
    setSelectedSystemId(id);
    if (!id) return;
    const sys = sortedSystems.find(s => String(s.id) === id);
    if (!sys) return;
    const suggestedType = suggestType(sys.type);
    const next: ConnectionDetails = {
      ...formData,
      ip: sys.ip,
      type: suggestedType,
      port: DEFAULT_PORTS[suggestedType],
      name: sys.name,
    };
    setFormData(next);
    onConnectionChange(next);
  };

  const handleChange = (field: keyof ConnectionDetails, value: string) => {
    const newData = { ...formData, [field]: value } as ConnectionDetails;
    setFormData(newData);
    onConnectionChange(newData);
    // If the user manually edits the IP, they're no longer "on" a saved
    // system — clear the dropdown selection so it doesn't lie.
    if (field === 'ip' && selectedSystemId) {
      const sys = sortedSystems.find(s => String(s.id) === selectedSystemId);
      if (sys && sys.ip !== value) setSelectedSystemId('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Module type selector */}
      <div className="flex items-center space-x-4">
        {(Object.keys(DEFAULT_PORTS) as ComponentType[]).map((type) => (
          <button
            key={type}
            onClick={() => handleChange('type', type)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium
              transition-colors
              ${formData.type === type
                ? `${themeConfig.components.button.variants.default}`
                : `${themeConfig.surfaces.card.background} ${themeConfig.surfaces.card.border} border hover:bg-white/10`
              }
            `}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Connection form */}
      <div className="flex items-center space-x-4">
        {/* Systems dropdown — sourced from the Test Systems list */}
        <div className="w-72">
          <select
            value={selectedSystemId}
            onChange={(e) => handlePickSystem(e.target.value)}
            disabled={sortedSystems.length === 0}
            className={`
              w-full px-3 py-2 rounded-lg
              ${themeConfig.surfaces.card.background}
              border ${themeConfig.surfaces.card.border}
              ${themeConfig.surfaces.card.foreground}
              disabled:opacity-50
            `}
          >
            <option value="">
              {sortedSystems.length === 0
                ? 'No systems — add one in Test Systems'
                : 'Select system…'}
            </option>
            {sortedSystems.map((sys) => (
              <option key={sys.id} value={String(sys.id)}>
                {sys.name} — {sys.ip} ({sys.type})
              </option>
            ))}
          </select>
        </div>

        {/* IP Address — editable, populated from system pick or typed manually */}
        <div className="flex-1">
          <input
            type="text"
            value={formData.ip}
            onChange={(e) => handleChange('ip', e.target.value)}
            placeholder="IP Address"
            className={`
              w-full px-3 py-2 rounded-lg
              ${themeConfig.surfaces.card.background}
              border ${themeConfig.surfaces.card.border}
              ${themeConfig.surfaces.card.foreground}
              placeholder:text-white/40
            `}
          />
        </div>

        {/* Port */}
        <div className="w-32">
          <input
            type="text"
            value={formData.port}
            onChange={(e) => handleChange('port', e.target.value)}
            placeholder="Port"
            className={`
              w-full px-3 py-2 rounded-lg
              ${themeConfig.surfaces.card.background}
              border ${themeConfig.surfaces.card.border}
              ${themeConfig.surfaces.card.foreground}
              placeholder:text-white/40
            `}
          />
        </div>

        {/* Password (optional — only required when the callbox sets
            com_password in its remote-API config) */}
        <div className="w-44">
          <input
            type="password"
            value={formData.password ?? ''}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="Password (optional)"
            autoComplete="off"
            className={`
              w-full px-3 py-2 rounded-lg
              ${themeConfig.surfaces.card.background}
              border ${themeConfig.surfaces.card.border}
              ${themeConfig.surfaces.card.foreground}
              placeholder:text-white/40
            `}
          />
        </div>
      </div>
    </div>
  );
}

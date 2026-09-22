// Connection picker for the Remote API page.
//
// The system dropdown is sourced from the shared Systems list (`useSystems()`,
// the store the Test Systems page manages), so an IP change there is picked up
// here. Picking a system fills in the IP; the component (ENB / MME / IMS / UE
// / MBMS / LICENSE) and port stay user-controlled since one callbox runs
// several remote API servers.

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/stat';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ThemeConfig } from '@/components/theme/types/theme.types';
import { useSystems } from '@/modules/systems/hooks/use-systems';
import type { System, SystemType } from '@/modules/systems/types';
import { COMPONENT_TYPES, DEFAULT_REMOTE_API_PORTS, type ComponentType } from '../../../shared/default/templates/remoteapi/common/types';

export interface ConnectionDetails {
  ip: string;
  type: ComponentType;
  port: string;
  name?: string;
  /** Remote API password, only when the server sets com_auth. Never persisted. */
  password?: string;
}

interface ConnectionSelectorProps {
  themeConfig?: ThemeConfig;
  /** Initial values (e.g. the last connection). */
  initial?: Partial<ConnectionDetails>;
  onConnectionChange: (details: ConnectionDetails) => void;
}

const COMPONENT_HINT: Record<ComponentType, string> = {
  ENB: 'eNB / gNB',
  MME: 'MME / AMF',
  IMS: 'IMS',
  UE: 'UE simulator',
  MBMS: 'MBMS gateway',
  LICENSE: 'License server',
};

function suggestType(systemType: SystemType): ComponentType {
  switch (systemType) {
    case 'Callbox': return 'ENB';
    case 'UESim':   return 'UE';
    case 'MME':     return 'MME';
    case 'SPGW':    return 'MME'; // SPGW shares the MME remote-API surface in this app
    default:        return 'ENB';
  }
}

export function ConnectionSelector({ initial, onConnectionChange }: ConnectionSelectorProps) {
  const { systems } = useSystems();

  const [formData, setFormData] = useState<ConnectionDetails>(() => {
    const type = initial?.type && COMPONENT_TYPES.includes(initial.type) ? initial.type : 'ENB';
    return {
      ip: initial?.ip ?? '',
      type,
      port: initial?.port ?? String(DEFAULT_REMOTE_API_PORTS[type]),
      name: initial?.name,
      password: '',
    };
  });

  const [selectedSystemId, setSelectedSystemId] = useState<string>('');

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

  const update = (next: ConnectionDetails) => {
    setFormData(next);
    onConnectionChange(next);
  };

  const handlePickSystem = (id: string) => {
    setSelectedSystemId(id);
    const sys = sortedSystems.find(s => String(s.id) === id);
    if (!sys) return;
    const type = suggestType(sys.type);
    update({ ...formData, ip: sys.ip, type, port: String(DEFAULT_REMOTE_API_PORTS[type]), name: sys.name });
  };

  const handleChange = (field: keyof ConnectionDetails, value: string) => {
    const next = { ...formData, [field]: value } as ConnectionDetails;
    // Changing the component snaps the port to its default in the same update
    // the parent sees (an effect here used to leave the parent on the old port).
    if (field === 'type') next.port = String(DEFAULT_REMOTE_API_PORTS[value as ComponentType]);
    update(next);
    if (field === 'ip' && selectedSystemId) {
      const sys = sortedSystems.find(s => String(s.id) === selectedSystemId);
      if (sys && sys.ip !== value) setSelectedSystemId('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Remote API component">
        {COMPONENT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={formData.type === type}
            onClick={() => handleChange('type', type)}
            title={`${COMPONENT_HINT[type]} · default port ${DEFAULT_REMOTE_API_PORTS[type]}`}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              formData.type === type
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-muted',
            )}
          >
            {type}
          </button>
        ))}
        <span className="ml-1 text-xs text-muted-foreground">{COMPONENT_HINT[formData.type]}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem_minmax(0,0.9fr)]">
        <div className="space-y-1">
          <Kicker>System</Kicker>
          <Select value={selectedSystemId} onValueChange={handlePickSystem} disabled={sortedSystems.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={sortedSystems.length === 0 ? 'No systems: add one in Test Systems' : 'Select system…'} />
            </SelectTrigger>
            <SelectContent>
              {sortedSystems.map((sys) => (
                <SelectItem key={sys.id} value={String(sys.id)} description={`${sys.ip} · ${sys.type}`}>
                  {sys.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Kicker>Host</Kicker>
          <Input value={formData.ip} onChange={(e) => handleChange('ip', e.target.value)} placeholder="IP address or hostname" aria-label="Host" />
        </div>
        <div className="space-y-1">
          <Kicker>Port</Kicker>
          <Input value={formData.port} onChange={(e) => handleChange('port', e.target.value.replace(/[^0-9]/g, ''))} placeholder="Port" inputMode="numeric" aria-label="Port" />
        </div>
        <div className="space-y-1">
          <Kicker>Password</Kicker>
          <Input
            type="password"
            value={formData.password ?? ''}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="only if com_auth is set"
            autoComplete="off"
            aria-label="Password"
          />
        </div>
      </div>
    </div>
  );
}

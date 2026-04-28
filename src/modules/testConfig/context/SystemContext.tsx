'use client';

// SystemContext — bridges the global useSystems() store into the ImportConfig flow.
// The system list comes from localStorage (the real user-configured callboxes),
// so there are no hardcoded IPs here.

import React, { createContext, useContext, useMemo, useState } from 'react';
import { useSystems } from '@/modules/systems/hooks/use-systems';

/** Shape expected by ImportForm / ConfigSelector */
export interface ImportSystem {
    id: string;
    name: string;
    host: string;   // IP address
    port: string;   // agent port (9050)
}

interface SystemContextType {
    systems: ImportSystem[];
    selectedSystem: ImportSystem | null;
    setSelectedSystem: (system: ImportSystem | null) => void;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export function SystemProvider({ children }: { children: React.ReactNode }) {
    const { systems: globalSystems } = useSystems();
    const [selectedSystem, setSelectedSystem] = useState<ImportSystem | null>(null);

    // Derive the import-system list from the global systems store.
    // Each saved callbox/system exposes the agent on port 9050.
    const systems = useMemo<ImportSystem[]>(() =>
        globalSystems.map(s => ({
            id: String(s.id),
            name: s.name,
            host: s.ip,
            port: '9050',
        })),
    [globalSystems]);

    return (
        <SystemContext.Provider value={{ systems, selectedSystem, setSelectedSystem }}>
            {children}
        </SystemContext.Provider>
    );
}

export function useSystem() {
    const context = useContext(SystemContext);
    if (context === undefined) {
        throw new Error('useSystem must be used within SystemProvider');
    }
    return context;
}
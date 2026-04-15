'use client';

import React, { createContext, useContext, useState } from 'react';

interface System {
    id: string;
    name: string;
    host: string;
    port: string;
}

const defaultSystems: System[] = [
    {
        id: 'system1',
        name: 'System 1',
        host: '192.168.86.28',
        port: '9050'
    }
];

interface SystemContextType {
    systems: System[];
    selectedSystem: System | null;
    setSelectedSystem: (system: System | null) => void;
    addSystem: (system: System) => void;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export function SystemProvider({ children }: { children: React.ReactNode }) {
    const [systems, setSystems] = useState<System[]>(defaultSystems);
    const [selectedSystem, setSelectedSystem] = useState<System | null>(null);

    const addSystem = (newSystem: System) => {
        setSystems(prev => [...prev, newSystem]);
    };

    const value = {
        systems,
        selectedSystem,
        setSelectedSystem,
        addSystem
    };

    return (
        <SystemContext.Provider value={value}>
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
// src/modules/remoteAPI/components/connection-selector.tsx

import { useState, useEffect } from 'react';
import { Save, Book } from 'lucide-react';
import type { ThemeConfig } from '@/components/theme/types/theme.types';

interface ConnectionDetails {
  ip: string;
  type: ComponentType;
  port: string;
  name?: string;
}

interface ConnectionSelectorProps {
  themeConfig: ThemeConfig;
  onConnectionChange: (details: ConnectionDetails) => void;
}

type ComponentType = 'ENB' | 'UE' | 'MME' | 'IMS' | 'MBMS';

const DEFAULT_PORTS: Record<ComponentType, string> = {
  'ENB': '9001',
  'UE': '9002',
  'MME': '9000',
  'IMS': '9003',
  'MBMS': '9004'
};

// Load saved connections from localStorage
const getSavedConnections = (): ConnectionDetails[] => {
  const saved = localStorage.getItem('savedConnections');
  return saved ? JSON.parse(saved) : [];
};

export function ConnectionSelector({ themeConfig, onConnectionChange }: ConnectionSelectorProps) {
  const [formData, setFormData] = useState<ConnectionDetails>({
    ip: '',
    type: 'ENB',
    port: '9001'
  });
  const [savedConnections, setSavedConnections] = useState<ConnectionDetails[]>(getSavedConnections);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [connectionName, setConnectionName] = useState('');

  // Update port when type changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      port: DEFAULT_PORTS[prev.type]
    }));
  }, [formData.type]);

  const handleSaveConnection = () => {
    if (!connectionName) return;
    
    const newConnection = { ...formData, name: connectionName };
    const updated = [...savedConnections, newConnection];
    setSavedConnections(updated);
    localStorage.setItem('savedConnections', JSON.stringify(updated));
    setConnectionName('');
    setShowSaveDialog(false);
  };

  const handleLoadSaved = (connection: ConnectionDetails) => {
    setFormData(connection);
    onConnectionChange(connection);
  };

  const handleChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onConnectionChange(newData);
  };

  return (
    <div className="space-y-4">
      {/* Command Type Selection */}
      <div className="flex items-center space-x-4">
        {Object.keys(DEFAULT_PORTS).map((type) => (
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

      {/* Connection Form */}
      <div className="flex items-center space-x-4">
        {/* Saved Connections Dropdown */}
        <div className="w-64">
          <select
            onChange={(e) => {
              const saved = savedConnections.find(c => c.name === e.target.value);
              if (saved) handleLoadSaved(saved);
            }}
            value=""
            className={`
              w-full px-3 py-2 rounded-lg
              ${themeConfig.surfaces.card.background}
              border ${themeConfig.surfaces.card.border}
              ${themeConfig.surfaces.card.foreground}
            `}
          >
            <option value="">Select saved connection...</option>
            {savedConnections.map((conn, idx) => (
              <option key={idx} value={conn.name}>
                {conn.name} ({conn.ip}:{conn.port})
              </option>
            ))}
          </select>
        </div>

        {/* IP Address */}
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

        {/* Save Button */}
        <button
          onClick={() => setShowSaveDialog(true)}
          title="Save Connection"
          className={`
            p-2 rounded-lg
            ${themeConfig.surfaces.card.background}
            border ${themeConfig.surfaces.card.border}
            hover:bg-white/10
          `}
        >
          <Save className="w-5 h-5 text-white/70" />
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            placeholder="Enter connection name..."
            className={`
              flex-1 px-3 py-2 rounded-lg
              ${themeConfig.surfaces.card.background}
              border ${themeConfig.surfaces.card.border}
              ${themeConfig.surfaces.card.foreground}
              placeholder:text-white/40
            `}
          />
          <button
            onClick={handleSaveConnection}
            className={themeConfig.components.button.variants.default}
          >
            Save
          </button>
          <button
            onClick={() => setShowSaveDialog(false)}
            className={themeConfig.components.button.variants.secondary}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
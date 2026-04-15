// modules/remoteAPI/components/command-panel.tsx

import { useState } from 'react';
import { Play, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ThemeConfig } from '@/components/theme/types/theme.types';

interface CommandPanelProps {
  selectedComponent: string;
  onExecute: (command: string, params: any) => Promise<void>;
  themeConfig: ThemeConfig;
}

const AVAILABLE_COMMANDS = [
  { value: 'config_get', label: 'Get Configuration' },
  { value: 'log_get', label: 'Get Logs' },
  { value: 'stats', label: 'Get Statistics' },
  { value: 'ue_get', label: 'Get UE List' },
  { value: 'erab_get', label: 'Get ERAB List' },
  { value: 'cell_gain', label: 'Set Cell Gain' },
  { value: 'quit', label: 'Terminate Connection' },
];

export default function CommandPanel({ selectedComponent, onExecute, themeConfig }: CommandPanelProps) {
  const [selectedCommand, setSelectedCommand] = useState('');
  const [params, setParams] = useState({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    try {
      setLoading(true);
      setError(null);
      await onExecute(selectedCommand, params);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className={`text-lg font-medium ${themeConfig.surfaces.card.foreground}`}>Command Execution</h2>
      <div className={`
        ${themeConfig.surfaces.card.background}
        rounded-xl p-4 border ${themeConfig.surfaces.card.border}
      `}>
        <select
          value={selectedCommand}
          onChange={(e) => setSelectedCommand(e.target.value)}
          className={`
            w-full bg-white/10 border border-white/20 
            rounded-lg px-3 py-2 mb-4
            ${themeConfig.surfaces.card.foreground}
          `}
        >
          <option value="">Select a command...</option>
          {AVAILABLE_COMMANDS.map(cmd => (
            <option key={cmd.value} value={cmd.value}>
              {cmd.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleExecute}
          disabled={!selectedCommand || loading}
          className={`
            w-full flex items-center justify-center 
            px-4 py-2 rounded-lg
            ${themeConfig.components.button.variants.default}
            ${themeConfig.components.button.sizes.default}
            disabled:opacity-50
          `}
        >
          <Play className="w-4 h-4 mr-2" />
          {loading ? 'Executing...' : 'Execute Command'}
        </button>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
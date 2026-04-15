// modules/remoteAPI/components/log-viewer.tsx

import { useState, useEffect } from 'react';
import { AlertCircle, Download, RefreshCcw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ThemeConfig } from '@/components/theme/types/theme.types';

interface Log {
  timestamp: string;
  level: string;
  message: string;
}

interface LogViewerProps {
  onFetchLogs: () => Promise<Log[]>;
  themeConfig: ThemeConfig;
}

export default function LogViewer({ onFetchLogs, themeConfig }: LogViewerProps) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const newLogs = await onFetchLogs();
      setLogs(newLogs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.message.toLowerCase().includes(filter.toLowerCase()) ||
    log.level.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-medium ${themeConfig.surfaces.card.foreground}`}>
          System Logs
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className={`p-2 rounded-lg ${themeConfig.surfaces.card.foreground} hover:bg-white/10`}
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
          <button className={`p-2 rounded-lg ${themeConfig.surfaces.card.foreground} hover:bg-white/10`}>
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Filter logs..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className={`
          w-full bg-white/10 border border-white/20 
          rounded-lg px-3 py-2 
          ${themeConfig.surfaces.card.foreground}
        `}
      />

      <div className={`
        ${themeConfig.surfaces.card.background}
        rounded-xl border ${themeConfig.surfaces.card.border} 
        overflow-hidden
      `}>
        <div className="max-h-96 overflow-auto">
          {filteredLogs.map((log, i) => (
            <div 
              key={i}
              className={`
                px-4 py-2 border-b border-white/10 last:border-0
                ${log.level === 'error' ? 'bg-red-500/10' : ''}
                ${log.level === 'warning' ? 'bg-amber-500/10' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">{log.timestamp}</span>
                <span className={`
                  text-xs px-2 py-0.5 rounded-full
                  ${log.level === 'error' ? 'bg-red-500/20 text-red-500' : ''}
                  ${log.level === 'warning' ? 'bg-amber-500/20 text-amber-500' : ''}
                  ${log.level === 'info' ? 'bg-blue-500/20 text-blue-500' : ''}
                `}>
                  {log.level}
                </span>
              </div>
              <div className={`text-sm mt-1 ${themeConfig.surfaces.card.foreground}`}>
                {log.message}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
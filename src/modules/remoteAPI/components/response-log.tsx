import { useState } from 'react';
import { Copy, Filter, Clock, Download, Trash2 } from 'lucide-react';
import type { ThemeConfig } from '@/components/theme/types/theme.types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LogEntry {
  command: string;
  response: any;
  timestamp: string;
  status: 'success' | 'error';
}

interface ResponseLogProps {
  logs: LogEntry[];
  themeConfig: ThemeConfig;
  onExport?: () => void;
  onClear?: () => void;
}

export function ResponseLog({ logs, themeConfig, onExport, onClear }: ResponseLogProps) {
  const [filter, setFilter] = useState('');
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Updated search functionality
  const filteredLogs = logs.filter(log => {
    if (showOnlyErrors && log.status !== 'error') return false;
    if (!filter) return true;
    
    const searchTerm = filter.toLowerCase();
    
    // Check each part of the log entry
    const matchesCommand = typeof log.command === 'string' 
      ? log.command.toLowerCase().includes(searchTerm)
      : JSON.stringify(log.command).toLowerCase().includes(searchTerm);
      
    const matchesResponse = typeof log.response === 'string'
      ? log.response.toLowerCase().includes(searchTerm)
      : JSON.stringify(log.response).toLowerCase().includes(searchTerm);

    const matchesTimestamp = log.timestamp.toLowerCase().includes(searchTerm);
    const matchesStatus = log.status.toLowerCase().includes(searchTerm);

    return matchesCommand || matchesResponse || matchesTimestamp || matchesStatus;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4">
      {/* Log Header with Entry Count and Controls */}
      <div className="flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/50 px-4 py-2 rounded-lg">
        <div className="flex items-center space-x-2">
          <h3 className={`text-sm font-medium ${themeConfig.surfaces.card.foreground}`}>
            Response Log
          </h3>
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
            {logs.length} entries
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Filter className="absolute left-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search logs..."
              className={`
                pl-9 pr-4 py-1.5 w-56 text-sm rounded-lg
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                text-gray-900 dark:text-gray-100
                placeholder:text-gray-400 dark:placeholder:text-gray-500
                focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/30
              `}
            />
          </div>

          {/* Show Only Errors Toggle */}
          <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showOnlyErrors}
              onChange={(e) => setShowOnlyErrors(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Show Only Errors</span>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg 
                         text-sm bg-teal-500/10 text-teal-600 hover:bg-teal-500/20
                         dark:text-teal-400 dark:hover:bg-teal-500/10"
                title="Export logs"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            )}
            
            {onClear && logs.length > 0 && (
              <button
                onClick={() => setShowClearDialog(true)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg 
                         text-sm bg-red-500/10 text-red-600 hover:bg-red-500/20
                         dark:text-red-400 dark:hover:bg-red-500/10"
                title="Clear all logs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Log Entries */}
      <div className="space-y-4 max-h-96 overflow-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div
              key={i}
              className={`
                p-4 rounded-lg border
                ${log.status === 'error' 
                  ? 'border-red-500/50 bg-red-500/10' 
                  : 'border-gray-200 dark:border-gray-700 bg-white/5 dark:bg-gray-800/5'
                }
              `}
            >
              {/* Log Header */}
              <div className="flex items-center justify-between text-xs mb-3">
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-medium
                  ${log.status === 'error' 
                    ? 'bg-red-500/20 text-red-500' 
                    : 'bg-emerald-500/20 text-emerald-500'
                  }
                `}>
                  {log.status.toUpperCase()}
                </span>
              </div>

              {/* Command Section */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Command:</span>
                  <button
                    onClick={() => handleCopy(log.command)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Copy command"
                  >
                    <Copy className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
                <pre className={`
                  p-2 rounded overflow-x-auto text-sm
                  bg-gray-50 dark:bg-gray-900
                  text-gray-900 dark:text-gray-100
                  border border-gray-200 dark:border-gray-700
                `}>
                  {log.command}
                </pre>
              </div>

              {/* Response Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Response:</span>
                  <button
                    onClick={() => handleCopy(
                      typeof log.response === 'string' 
                        ? log.response 
                        : JSON.stringify(log.response, null, 2)
                    )}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Copy response"
                  >
                    <Copy className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
                <pre className={`
                  p-2 rounded overflow-x-auto text-sm font-mono
                  bg-gray-50 dark:bg-gray-900
                  text-gray-900 dark:text-gray-100
                  border border-gray-200 dark:border-gray-700
                `}>
                  {typeof log.response === 'string' 
                    ? log.response 
                    : JSON.stringify(log.response, null, 2)
                  }
                </pre>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Response Logs</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all response logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                onClear?.();
                setShowClearDialog(false);
              }}
            >
              Clear Logs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
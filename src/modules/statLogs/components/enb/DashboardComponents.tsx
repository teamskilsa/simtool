// Settings sub-form for the monitoring dashboard.
//
// The old ConfigurationPanel (single IP textbox) and DashboardHeader (just
// re-displaying that IP) were removed when the dashboard switched to a
// system-list dropdown + module selector. Only DashboardSettings remains,
// rendered inside the Settings tab.
import React from 'react';

interface MonitoringSettings {
  pollInterval: number;
  maxDataPoints: number;
  showDetailedStats: boolean;
}

interface DashboardSettingsProps {
  settings: MonitoringSettings;
  onSettingsChange: (settings: MonitoringSettings) => void;
}

export function DashboardSettings({ settings, onSettingsChange }: DashboardSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Poll Interval (ms)</label>
        <input
          type="number"
          value={settings.pollInterval}
          onChange={(e) =>
            onSettingsChange({
              ...settings,
              pollInterval: parseInt(e.target.value, 10) || 1000,
            })
          }
          className="w-full p-2 border rounded"
        />
        <p className="text-[11px] text-muted-foreground">
          How often the dashboard polls the remote API for new stats. Lower =
          smoother charts but more load on the callbox.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Max Data Points</label>
        <input
          type="number"
          value={settings.maxDataPoints}
          onChange={(e) =>
            onSettingsChange({
              ...settings,
              maxDataPoints: parseInt(e.target.value, 10) || 60,
            })
          }
          className="w-full p-2 border rounded"
        />
        <p className="text-[11px] text-muted-foreground">
          Rolling window size — older points get discarded once this fills up.
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={settings.showDetailedStats}
          onChange={(e) =>
            onSettingsChange({
              ...settings,
              showDetailedStats: e.target.checked,
            })
          }
          id="detailed-stats"
        />
        <label htmlFor="detailed-stats" className="text-sm font-medium">
          Show Detailed Statistics
        </label>
      </div>
    </div>
  );
}

// src/modules/statLogs/components/enb/components/DashboardComponents.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, RefreshCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConfigurationPanelProps {
  ip: string;
  onIpChange: (ip: string) => void;
  onConfigure: () => void;
}

export function ConfigurationPanel({ ip, onIpChange, onConfigure }: ConfigurationPanelProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={ip}
            onChange={(e) => onIpChange(e.target.value)}
            placeholder="ENB IP Address"
            className="flex-1 p-2 border rounded"
          />
          <Button onClick={onConfigure}>
            Connect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardHeaderProps {
  ip: string;
  onReset: () => void;
  onBack: () => void;
  settings: any;
  onSettingsChange: (settings: any) => void;
}

export function DashboardHeader({ 
  ip, 
  onReset, 
  onBack,
  settings,
  onSettingsChange
}: DashboardHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">ENB Stats Monitor</h1>
        <p className="text-sm text-gray-500">Monitoring {ip}</p>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button 
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="flex items-center"
        >
          <RefreshCcw className="w-4 h-4 mr-1" />
          Reset
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center">
              <Settings className="w-4 h-4 mr-1" />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dashboard Settings</DialogTitle>
            </DialogHeader>
            <DashboardSettings 
              settings={settings}
              onSettingsChange={onSettingsChange}
            />
          </DialogContent>
        </Dialog>

        <Button 
          variant="outline"
          size="sm"
          onClick={onBack}
        >
          Change IP
        </Button>
      </div>
    </div>
  );
}

interface DashboardSettingsProps {
  settings: any;
  onSettingsChange: (settings: any) => void;
}

export function DashboardSettings({ settings, onSettingsChange }: DashboardSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Poll Interval (ms)</label>
        <input
          type="number"
          value={settings.pollInterval}
          onChange={(e) => onSettingsChange({ 
            ...settings, 
            pollInterval: parseInt(e.target.value) 
          })}
          className="w-full p-2 border rounded"
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Max Data Points</label>
        <input
          type="number"
          value={settings.maxDataPoints}
          onChange={(e) => onSettingsChange({ 
            ...settings, 
            maxDataPoints: parseInt(e.target.value) 
          })}
          className="w-full p-2 border rounded"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={settings.showDetailedStats}
          onChange={(e) => onSettingsChange({ 
            ...settings, 
            showDetailedStats: e.target.checked 
          })}
          id="detailed-stats"
        />
        <label htmlFor="detailed-stats" className="text-sm font-medium">
          Show Detailed Statistics
        </label>
      </div>
    </div>
  );
}
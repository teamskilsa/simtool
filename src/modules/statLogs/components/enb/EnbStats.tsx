// 1. Enhanced EnbStats.tsx - Main component improvements
import React from 'react';
import { useEnbStats } from '../../hooks/useEnbStats';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlayCircle, StopCircle, AlertCircle, Signal, Activity, Cpu } from 'lucide-react';

interface EnbStatsProps {
  ip: string;
  pollInterval?: number;
  autoConnect?: boolean;
  onStatsUpdate?: (stats: any) => void;
}

// Utility functions moved to separate file but kept here for now
const formatBitrate = (bps: number) => {
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(2)} Mbps`;
  if (bps >= 1000) return `${(bps / 1000).toFixed(2)} Kbps`;
  return `${bps.toFixed(2)} bps`;
};

const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function EnbStats({ 
  ip, 
  pollInterval = 5000,
  autoConnect = false,
  onStatsUpdate 
}: EnbStatsProps): JSX.Element {
  const {
    stats,
    isConnected,
    error,
    startMonitoring,
    stopMonitoring,
    lastUpdate
  } = useEnbStats(ip, {
    pollInterval,
    autoConnect,
    onStatsUpdate
  });

  // Add status check for stale data
  const isDataStale = lastUpdate && (Date.now() - lastUpdate.getTime() > pollInterval * 2);

  return (
    <div className="space-y-4">
      {/* Connection Controls with Status */}
      <ConnectionControls 
        isConnected={isConnected}
        isDataStale={isDataStale}
        onStart={startMonitoring}
        onStop={stopMonitoring}
        ip={ip}
      />

      {/* Error Handling */}
      {error && <ErrorAlert error={error} />}

      {/* Stats Display */}
      {stats && (
        <StatsDisplay stats={stats} formatters={{ formatBitrate, formatPercentage }} />
      )}
    </div>
  );
}

// Extracted Components
interface ConnectionControlsProps {
  isConnected: boolean;
  isDataStale: boolean;
  onStart: () => void;
  onStop: () => void;
  ip: string;
}

function ConnectionControls({ isConnected, isDataStale, onStart, onStop, ip }: ConnectionControlsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-x-2">
        <Button
          onClick={isConnected ? onStop : onStart}
          variant={isConnected ? "destructive" : "default"}
        >
          {isConnected ? (
            <>
              <StopCircle className="w-4 h-4 mr-2" />
              Stop Monitoring
            </>
          ) : (
            <>
              <PlayCircle className="w-4 h-4 mr-2" />
              Start Monitoring
            </>
          )}
        </Button>
      </div>

      {isConnected && (
        <div className="flex items-center space-x-2">
          <span className={`text-sm flex items-center ${isDataStale ? 'text-yellow-500' : 'text-green-500'}`}>
            <Signal className="w-4 h-4 mr-1" />
            Connected to {ip}
          </span>
          {isDataStale && (
            <span className="text-xs text-yellow-500">
              (Data may be stale)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorAlert({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

interface StatsDisplayProps {
  stats: any;
  formatters: {
    formatBitrate: (value: number) => string;
    formatPercentage: (value: number) => string;
  };
}

function StatsDisplay({ stats, formatters }: StatsDisplayProps) {
  const { formatBitrate, formatPercentage } = formatters;

  return (
    <div className="grid grid-cols-2 gap-4">
      <SystemInfoCard stats={stats} />
      <GtpTrafficCard stats={stats} formatBitrate={formatBitrate} />
      <CellStatisticsCards stats={stats} formatters={formatters} />
      <RfPortStatisticsCard stats={stats} />
    </div>
  );
}

// Individual Card Components
function SystemInfoCard({ stats }: { stats: any }) {
  return (
    <Card className="p-4">
      <h3 className="font-medium mb-4 flex items-center">
        <Cpu className="w-4 h-4 mr-2" />
        System Information
      </h3>
      <div className="space-y-2">
        <InfoRow label="CPU Usage" value={`${stats.cpu?.global || 0}%`} />
        <InfoRow label="Instance ID" value={stats.instance_id} />
        <InfoRow label="Uptime" value={`${stats.duration?.toFixed(1)} s`} />
      </div>
    </Card>
  );
}

function GtpTrafficCard({ stats, formatBitrate }: { stats: any; formatBitrate: (value: number) => string }) {
  return (
    <Card className="p-4">
      <h3 className="font-medium mb-4 flex items-center">
        <Activity className="w-4 h-4 mr-2" />
        GTP Traffic
      </h3>
      <div className="space-y-2">
        <InfoRow label="RX Bitrate" value={formatBitrate(stats.gtp_rx_bitrate)} />
        <InfoRow label="TX Bitrate" value={formatBitrate(stats.gtp_tx_bitrate)} />
      </div>
    </Card>
  );
}

// Helper Component
function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span>{label}:</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
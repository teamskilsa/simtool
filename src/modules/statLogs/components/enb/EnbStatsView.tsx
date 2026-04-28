// Pure render component for the Overview tab. Connection state is owned by
// EnbMonitoringDashboard now — this just visualizes whatever stats it gets
// passed. Nothing here calls the WebSocket directly.
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface EnbStatsViewProps {
  isConnected: boolean;
  timeSeriesData: any[];
  currentStats: any;
}

/**
 * Fold per-cell stats into a single set of numbers for the headline cards.
 * Modern Amarisoft puts the interesting fields under cells["1"], cells["2"]
 * etc.; we sum throughput across cells and take the cell-1 values for
 * single-cell metrics like Cell ID and DRB count.
 */
function rollUp(currentStats: any) {
  const cells = currentStats?.cells && typeof currentStats.cells === 'object'
    ? Object.entries(currentStats.cells as Record<string, any>)
    : [];

  let dlBpsSum = 0, ulBpsSum = 0, dlUseMax = 0, ulUseMax = 0;
  let connectedUes = 0, activeUes = 0, drbCount = 0;
  let firstCellId: string | number = 0;
  for (const [id, c] of cells as [string, any][]) {
    dlBpsSum   += Number(c?.dl_bitrate ?? 0) || 0;
    ulBpsSum   += Number(c?.ul_bitrate ?? 0) || 0;
    dlUseMax    = Math.max(dlUseMax, Number(c?.dl_use_avg ?? 0) || 0);
    ulUseMax    = Math.max(ulUseMax, Number(c?.ul_use_avg ?? 0) || 0);
    connectedUes += Number(c?.ue_count_avg ?? 0) || 0;
    activeUes    += Number(c?.ue_active_count_avg ?? 0) || 0;
    drbCount     += Number(c?.drb_count_avg ?? 0) || 0;
    if (firstCellId === 0) firstCellId = id;
  }

  // Legacy top-level fallback if there were no cells in the response.
  if (cells.length === 0 && currentStats) {
    dlBpsSum     = Number(currentStats?.throughput?.dl ?? 0) || 0;
    ulBpsSum     = Number(currentStats?.throughput?.ul ?? 0) || 0;
    dlUseMax     = Number(currentStats?.prb_utilization?.dl ?? 0) || 0;
    ulUseMax     = Number(currentStats?.prb_utilization?.ul ?? 0) || 0;
    connectedUes = Number(currentStats?.connected_ue_count ?? 0) || 0;
    activeUes    = Number(currentStats?.active_ue_count ?? 0) || 0;
    firstCellId  = currentStats?.cell_id ?? 0;
  }

  return {
    cellCount: cells.length,
    firstCellId,
    connectedUes,
    activeUes,
    drbCount,
    dlMbps: dlBpsSum / 1_000_000,
    ulMbps: ulBpsSum / 1_000_000,
    dlPrbPct: dlUseMax * 100,
    ulPrbPct: ulUseMax * 100,
  };
}

export function EnbStatsView({
  isConnected,
  timeSeriesData,
  currentStats,
}: EnbStatsViewProps) {
  // Empty state: not connected and no data yet.
  if (!isConnected && (!timeSeriesData || timeSeriesData.length === 0)) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Click <span className="font-medium">Connect</span> above to start
          streaming stats from the selected module.
        </CardContent>
      </Card>
    );
  }

  const k = rollUp(currentStats);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Throughput Chart */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Throughput (Mbps)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={ts => new Date(ts).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={ts => new Date(ts).toLocaleTimeString()}
                  formatter={(value: number) => [`${value.toFixed(2)} Mbps`]}
                />
                <Line
                  type="monotone" dataKey="dl_bitrate" name="DL"
                  stroke="#8884d8" dot={false} isAnimationActive={false}
                />
                <Line
                  type="monotone" dataKey="ul_bitrate" name="UL"
                  stroke="#82ca9d" dot={false} isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Status — totals across all cells */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Row label="Connected UEs" value={k.connectedUes.toFixed(1)} mono />
              <Row label="Active UEs"    value={k.activeUes.toFixed(1)} mono />
              <Row label="Cells"         value={k.cellCount || 0} mono />
              <Row label="DL Throughput" value={`${k.dlMbps.toFixed(2)} Mbps`} mono />
              <Row label="UL Throughput" value={`${k.ulMbps.toFixed(2)} Mbps`} mono />
              <Row label="DL PRB (max)"  value={`${k.dlPrbPct.toFixed(1)}%`} mono />
              <Row label="UL PRB (max)"  value={`${k.ulPrbPct.toFixed(1)}%`} mono />
            </div>
          </CardContent>
        </Card>

        {/* System / RF Info — pulled from top-level fields that Amarisoft
            reports outside the per-cell map. */}
        <Card>
          <CardHeader>
            <CardTitle>System Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Row label="First Cell ID" value={String(k.firstCellId)} mono />
              <Row label="DRB Count"     value={k.drbCount.toFixed(1)} mono />
              <Row label="CPU Usage"
                value={typeof currentStats?.cpu?.global === 'number'
                  ? `${Number(currentStats.cpu.global).toFixed(1)}%`
                  : '—'} mono />
              <Row label="Uptime"
                value={typeof currentStats?.duration === 'number'
                  ? `${Number(currentStats.duration).toFixed(0)} s`
                  : '—'} mono />
              <Row label="RF Samples"
                value={typeof currentStats?.rf_samples === 'number'
                  ? Number(currentStats.rf_samples).toLocaleString()
                  : '—'} mono />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span>{label}:</span>
      <span className={mono ? 'font-mono' : ''}>{value}</span>
    </div>
  );
}

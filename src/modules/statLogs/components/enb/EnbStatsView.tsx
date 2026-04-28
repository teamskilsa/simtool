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

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Row label="Connected UEs" value={currentStats?.connected_ue_count ?? 0} mono />
              <Row label="Active UEs"    value={currentStats?.active_ue_count ?? 0} mono />
              <Row label="Cell ID"       value={currentStats?.cell_id ?? 0} mono />
              <Row label="DL Throughput" value={`${((currentStats?.throughput?.dl ?? 0) / 1_000_000).toFixed(2)} Mbps`} mono />
              <Row label="UL Throughput" value={`${((currentStats?.throughput?.ul ?? 0) / 1_000_000).toFixed(2)} Mbps`} mono />
              <Row label="DL PRB"        value={`${((currentStats?.prb_utilization?.dl ?? 0) * 100).toFixed(1)}%`} mono />
              <Row label="UL PRB"        value={`${((currentStats?.prb_utilization?.ul ?? 0) * 100).toFixed(1)}%`} mono />
            </div>
          </CardContent>
        </Card>

        {/* Cell Information */}
        <Card>
          <CardHeader>
            <CardTitle>Cell Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Row label="Active UEs"    value={currentStats?.cells?.['1']?.ue_active_count_avg ?? 0} mono />
              <Row label="Connected UEs" value={currentStats?.cells?.['1']?.ue_count_avg ?? 0} mono />
              <Row label="DRB Count"     value={currentStats?.cells?.['1']?.drb_count_avg ?? 0} mono />
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

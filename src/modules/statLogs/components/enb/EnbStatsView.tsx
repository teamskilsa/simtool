import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlayCircle, StopCircle, AlertCircle, Signal } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEnbStats } from '../../hooks/useEnbStats';

interface EnbStatsViewProps {
  ip: string;
  pollInterval?: number;
  onStatsUpdate?: (stats: any) => void;
  timeSeriesData: any[];
  currentStats: any;
}

export function EnbStatsView({ 
  ip, 
  pollInterval = 1000,
  onStatsUpdate,
  timeSeriesData,
  currentStats
}: EnbStatsViewProps) {
  console.log('EnbStatsView received:', {
    ip,
    pollInterval,
    timeSeriesDataLength: timeSeriesData?.length,
    currentStats: JSON.stringify(currentStats, null, 2)
  });
  
  const {
    isConnected,
    error,
    startMonitoring,
    stopMonitoring
  } = useEnbStats(ip, {
    pollInterval,
    onStatsUpdate
  });

  // Validate data is available
  const hasValidData = React.useMemo(() => {
    const hasStats = Boolean(currentStats);
    const hasTimeSeriesData = Array.isArray(timeSeriesData) && timeSeriesData.length > 0;
    console.log('Data validation:', { hasStats, hasTimeSeriesData });
    return hasStats || hasTimeSeriesData;
  }, [currentStats, timeSeriesData]);

  return (
    <div className="space-y-4">
      {/* Connection Controls */}
      <div className="flex items-center justify-between">
        <Button
          onClick={isConnected ? stopMonitoring : startMonitoring}
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

        {isConnected && (
          <span className="text-sm text-green-500 flex items-center">
            <Signal className="w-4 h-4 mr-1" />
            Connected to {ip}
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Charts and Stats */}
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
                  tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                  formatter={(value: number) => [`${value.toFixed(2)} Mbps`]}
                />
                <Line 
                  type="monotone" 
                  dataKey="dl_bitrate" 
                  name="DL" 
                  stroke="#8884d8" 
                  dot={false}
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="ul_bitrate" 
                  name="UL" 
                  stroke="#82ca9d" 
                  dot={false}
                  isAnimationActive={false}
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
      <div className="flex justify-between">
        <span>Connected UEs:</span>
        <span className="font-mono">
          {currentStats?.connected_ue_count || 0}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Active UEs:</span>
        <span className="font-mono">
          {currentStats?.active_ue_count || 0}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Cell ID:</span>
        <span className="font-mono">
          {currentStats?.cell_id || 0}
        </span>
      </div>
      <div className="flex justify-between">
        <span>DL Throughput:</span>
        <span className="font-mono">
          {((currentStats?.throughput?.dl || 0) / 1000000).toFixed(2)} Mbps
        </span>
      </div>
      <div className="flex justify-between">
        <span>UL Throughput:</span>
        <span className="font-mono">
          {((currentStats?.throughput?.ul || 0) / 1000000).toFixed(2)} Mbps
        </span>
      </div>
      <div className="flex justify-between">
        <span>DL PRB:</span>
        <span className="font-mono">
          {((currentStats?.prb_utilization?.dl || 0) * 100).toFixed(1)}%
        </span>
      </div>
      <div className="flex justify-between">
        <span>UL PRB:</span>
        <span className="font-mono">
          {((currentStats?.prb_utilization?.ul || 0) * 100).toFixed(1)}%
        </span>
      </div>
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
              <div className="flex justify-between">
                <span>Active UEs:</span>
                <span className="font-mono">
                  {currentStats?.cells?.['1']?.ue_active_count_avg || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Connected UEs:</span>
                <span className="font-mono">
                  {currentStats?.cells?.['1']?.ue_count_avg || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>DRB Count:</span>
                <span className="font-mono">
                  {currentStats?.cells?.['1']?.drb_count_avg || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
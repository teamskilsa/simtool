// src/modules/statLogs/components/enb/views/StatsViews.tsx
import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Activity, Signal, Cpu, Radio, Users, Database } from 'lucide-react';

interface TimeSeriesDataPoint {
  timestamp: number;
  dl_bitrate: number;
  ul_bitrate: number;
  dl_prb: number;
  ul_prb: number;
}

interface PerformanceViewProps {
  timeSeriesData: TimeSeriesDataPoint[];
  currentStats: any;
}

interface DetailedStatsViewProps {
  stats: any;
  showDetailed: boolean;
}

export function PerformanceView({ timeSeriesData, currentStats }: PerformanceViewProps) {
  const performanceMetrics = useMemo(() => {
    if (!timeSeriesData.length || !currentStats) return null;

    const lastPoint = timeSeriesData[timeSeriesData.length - 1];
    return {
      throughput: {
        dl: lastPoint.dl_bitrate,
        ul: lastPoint.ul_bitrate,
        peak_dl: Math.max(...timeSeriesData.map(d => d.dl_bitrate)),
        peak_ul: Math.max(...timeSeriesData.map(d => d.ul_bitrate))
      },
      resource_utilization: {
        dl: lastPoint.dl_prb,
        ul: lastPoint.ul_prb,
        avg_dl: timeSeriesData.reduce((acc, d) => acc + d.dl_prb, 0) / timeSeriesData.length,
        avg_ul: timeSeriesData.reduce((acc, d) => acc + d.ul_prb, 0) / timeSeriesData.length
      }
    };
  }, [timeSeriesData, currentStats]);

  if (!performanceMetrics) return null;

  return (
    <div className="space-y-6">
      {/* Throughput Charts */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center text-lg font-medium">
            <Activity className="w-5 h-5 mr-2" />
            Throughput Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
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
                  name="DL Throughput"
                  dataKey="dl_bitrate" 
                  stroke="#8884d8" 
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  name="UL Throughput"
                  dataKey="ul_bitrate" 
                  stroke="#82ca9d" 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Resource Utilization */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="flex items-center text-lg font-medium">
            <Cpu className="w-5 h-5 mr-2" />
            Resource Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesData.slice(-20)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp"
                  tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  labelFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                  formatter={(value: number) => [`${value.toFixed(1)}%`]}
                />
                <Bar dataKey="dl_prb" name="DL PRB" fill="#8884d8" />
                <Bar dataKey="ul_prb" name="UL PRB" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Summary */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          title="Peak Performance"
          icon={Signal}
          metrics={[
            { label: 'Peak DL Throughput', value: `${performanceMetrics.throughput.peak_dl.toFixed(2)} Mbps` },
            { label: 'Peak UL Throughput', value: `${performanceMetrics.throughput.peak_ul.toFixed(2)} Mbps` },
          ]}
        />
        <MetricCard
          title="Average Utilization"
          icon={Database}
          metrics={[
            { label: 'Avg DL PRB', value: `${performanceMetrics.resource_utilization.avg_dl.toFixed(1)}%` },
            { label: 'Avg UL PRB', value: `${performanceMetrics.resource_utilization.avg_ul.toFixed(1)}%` },
          ]}
        />
      </div>
    </div>
  );
}

export function DetailedStatsView({ stats, showDetailed }: DetailedStatsViewProps) {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg font-medium">
            <Cpu className="w-5 h-5 mr-2" />
            System Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <DetailItem label="CPU Usage" value={`${stats.cpu?.global || 0}%`} />
            <DetailItem label="Memory Usage" value={`${stats.memory?.used || 0} MB`} />
            <DetailItem label="Temperature" value={`${stats.temperature || 0}°C`} />
            <DetailItem label="Uptime" value={`${(stats.duration || 0).toFixed(1)} s`} />
          </div>
        </CardContent>
      </Card>

      {/* Cell Information */}
      {stats.cells && Object.entries(stats.cells).map(([cellId, cell]: [string, any]) => (
        <Card key={cellId}>
          <CardHeader>
            <CardTitle className="flex items-center text-lg font-medium">
              <Radio className="w-5 h-5 mr-2" />
              Cell {cellId} Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div className="space-y-4">
                <DetailItem 
                  label="Physical Cell ID" 
                  value={cell.pci || 'N/A'} 
                />
                <DetailItem 
                  label="DL Bandwidth" 
                  value={`${cell.dl_bandwidth || 0} MHz`} 
                />
                <DetailItem 
                  label="UL Bandwidth" 
                  value={`${cell.ul_bandwidth || 0} MHz`} 
                />
                <DetailItem 
                  label="DL EARFCN" 
                  value={cell.dl_earfcn || 'N/A'} 
                />
              </div>
              {showDetailed && (
                <div className="space-y-4">
                  <DetailItem 
                    label="PBCH Power" 
                    value={`${cell.pbch_power || 0} dBm`} 
                  />
                  <DetailItem 
                    label="PSS Power" 
                    value={`${cell.pss_power || 0} dBm`} 
                  />
                  <DetailItem 
                    label="SSS Power" 
                    value={`${cell.sss_power || 0} dBm`} 
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Connected UEs */}
      {stats.cells && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg font-medium">
              <Users className="w-5 h-5 mr-2" />
              Connected UEs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.cells).map(([cellId, cell]: [string, any]) => (
                <div key={cellId} className="grid grid-cols-2 gap-4">
                  <DetailItem 
                    label="Total UEs" 
                    value={cell.ue_count_avg || 0} 
                  />
                  <DetailItem 
                    label="Active UEs" 
                    value={cell.ue_active_count_avg || 0} 
                  />
                  <DetailItem 
                    label="DL Scheduled Users" 
                    value={(cell.dl_sched_users_avg || 0).toFixed(2)} 
                  />
                  <DetailItem 
                    label="UL Scheduled Users" 
                    value={(cell.ul_sched_users_avg || 0).toFixed(2)} 
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper Components
interface MetricCardProps {
  title: string;
  icon: React.FC<{ className?: string }>;
  metrics: Array<{ label: string; value: string | number }>;
}

function MetricCard({ title, icon: Icon, metrics }: MetricCardProps) {
  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle className="flex items-center text-lg font-medium">
          <Icon className="w-5 h-5 mr-2" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {metrics.map((metric, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{metric.label}</span>
              <span className="font-medium">{metric.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
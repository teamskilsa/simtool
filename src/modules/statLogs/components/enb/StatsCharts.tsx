import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StatsChartsProps {
  timeSeriesData: any[];
  currentStats: any;
}

export function StatsCharts({ timeSeriesData, currentStats }: StatsChartsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Throughput (Mbps)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
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

      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>PRB Utilization (%)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeriesData}>
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
              <Line 
                type="monotone" 
                dataKey="dl_prb" 
                name="DL" 
                stroke="#8884d8" 
                dot={false}
                isAnimationActive={false}
              />
              <Line 
                type="monotone" 
                dataKey="ul_prb" 
                name="UL" 
                stroke="#82ca9d" 
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Message Counters */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Message Counters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {currentStats?.cells?.['1']?.counters?.messages && (
              <div>
                <h4 className="font-medium mb-2">Cell Messages</h4>
                <div className="space-y-1">
                  {Object.entries(currentStats.cells['1'].counters.messages)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span>{key}:</span>
                        <span className="font-mono">{value}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {currentStats?.counters?.messages && (
              <div>
                <h4 className="font-medium mb-2">System Messages</h4>
                <div className="space-y-1">
                  {Object.entries(currentStats.counters.messages)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span>{key}:</span>
                        <span className="font-mono">{value}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
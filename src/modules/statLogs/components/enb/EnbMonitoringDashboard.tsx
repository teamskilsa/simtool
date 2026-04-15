// src/modules/statLogs/components/enb/EnbMonitoringDashboard.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnbStatsView } from './EnbStatsView';
import { PerformanceView, DetailedStatsView } from './StatsViews';
import {
  ConfigurationPanel,
  DashboardHeader,
  DashboardSettings
} from './DashboardComponents';

interface TimeSeriesDataPoint {
  timestamp: number;
  dl_bitrate: number;
  ul_bitrate: number;
  dl_prb: number;
  ul_prb: number;
}

interface DashboardState {
  ip: string;
  isConfigured: boolean;
  timeSeriesData: TimeSeriesDataPoint[];
  currentStats: any;
  activeTab: string;
  chartPeriod: '1min' | '5min' | '15min' | '1hour';
}

export function EnbMonitoringDashboard() {
  console.log('🎯 Dashboard - Rendering');

  // State Management
  const [state, setState] = useState<DashboardState>({
    ip: '192.168.86.28',
    isConfigured: false,
    timeSeriesData: [],
    currentStats: null,
    activeTab: 'overview',
    chartPeriod: '5min'
  });

  // Settings State
  const [settings, setSettings] = useState({
    pollInterval: 1000,
    maxDataPoints: 60,
    showDetailedStats: true
  });

  // Memoized derived data
  const filteredTimeSeriesData = useMemo(() => {
    const now = Date.now();
    const periodInMs = {
      '1min': 60 * 1000,
      '5min': 5 * 60 * 1000,
      '15min': 15 * 60 * 1000,
      '1hour': 60 * 60 * 1000
    }[state.chartPeriod];

    return state.timeSeriesData.filter(point => 
      (now - point.timestamp) <= periodInMs
    );
  }, [state.timeSeriesData, state.chartPeriod]);

  // Handlers
// In EnbMonitoringDashboard.tsx
// EnbMonitoringDashboard.tsx
// EnbMonitoringDashboard.tsx
const handleStatsUpdate = useCallback((stats: any) => {
  console.log('📊 Raw stats received:', stats);

  // Parse the stats if it's a string
  let parsedStats;
  try {
    parsedStats = typeof stats === 'string' ? JSON.parse(stats) : stats;
    console.log('📊 Parsed stats:', parsedStats);

    const timestamp = parsedStats.timestamp || Date.now();
    
    // Create new data point
    const newDataPoint = {
      timestamp,
      dl_bitrate: 0,
      ul_bitrate: 0,
      dl_prb: 0,
      ul_prb: 0
    };

    // Add any available data
    if (parsedStats.throughput) {
      newDataPoint.dl_bitrate = parsedStats.throughput.dl ? parsedStats.throughput.dl / 1000000 : 0;
      newDataPoint.ul_bitrate = parsedStats.throughput.ul ? parsedStats.throughput.ul / 1000000 : 0;
    }

    if (parsedStats.prb_utilization) {
      newDataPoint.dl_prb = parsedStats.prb_utilization.dl ? parsedStats.prb_utilization.dl * 100 : 0;
      newDataPoint.ul_prb = parsedStats.prb_utilization.ul ? parsedStats.prb_utilization.ul * 100 : 0;
    }

    console.log('📈 New data point:', newDataPoint);

    setState(prev => ({
      ...prev,
      timeSeriesData: [...prev.timeSeriesData, newDataPoint].slice(-settings.maxDataPoints),
      currentStats: parsedStats
    }));
  } catch (error) {
    console.error('Error processing stats:', error);
  }
}, [settings.maxDataPoints]);

  const handleSettingsChange = useCallback((newSettings: typeof settings) => {
    console.log('⚙️ Dashboard - Settings updated:', newSettings);
    setSettings(newSettings);
  }, []);

  const handleReset = useCallback(() => {
    console.log('🔄 Dashboard - Resetting data');
    setState(prev => ({
      ...prev,
      timeSeriesData: [],
      currentStats: null
    }));
  }, []);

  return (
    <div className="space-y-4">
      {/* Configuration Panel */}
      {!state.isConfigured ? (
        <ConfigurationPanel 
          ip={state.ip}
          onIpChange={(ip) => {
            console.log('🔧 Dashboard - IP changed:', ip);
            setState(prev => ({ ...prev, ip }));
          }}
          onConfigure={() => {
            console.log('🔧 Dashboard - Configured with IP:', state.ip);
            setState(prev => ({ ...prev, isConfigured: true }));
          }}
        />
      ) : (
        <>
          <DashboardHeader 
            ip={state.ip}
            onReset={handleReset}
            onBack={() => {
              console.log('🔙 Dashboard - Going back to configuration');
              setState(prev => ({ ...prev, isConfigured: false }));
            }}
            settings={settings}
            onSettingsChange={handleSettingsChange}
          />

          {/* Main Dashboard Content */}
          <Tabs value={state.activeTab} onValueChange={(tab) => {
            console.log('📑 Dashboard - Tab changed:', tab);
            setState(prev => ({ ...prev, activeTab: tab }));
          }}>
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="detailed">Detailed Stats</TabsTrigger>
              </TabsList>

              {/* Time Period Selector */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Period:</span>
                <select
                  value={state.chartPeriod}
                  onChange={(e) => {
                    console.log('⏱️ Dashboard - Chart period changed:', e.target.value);
                    setState(prev => ({ 
                      ...prev, 
                      chartPeriod: e.target.value as DashboardState['chartPeriod']
                    }));
                  }}
                  className="text-sm border rounded-md px-2 py-1"
                >
                  <option value="1min">1 Minute</option>
                  <option value="5min">5 Minutes</option>
                  <option value="15min">15 Minutes</option>
                  <option value="1hour">1 Hour</option>
                </select>
              </div>
            </div>

            {/* Tab Content */}
            <TabsContent value="overview">
            <EnbStatsView 
              ip={state.ip}
              port={9001}     // Explicitly set ENB port
              pollInterval={settings.pollInterval}
              onStatsUpdate={handleStatsUpdate}
              timeSeriesData={filteredTimeSeriesData}
              currentStats={state.currentStats}
            />
            </TabsContent>

            <TabsContent value="performance">
              <PerformanceView 
                timeSeriesData={filteredTimeSeriesData}
                currentStats={state.currentStats}
              />
            </TabsContent>

            <TabsContent value="detailed">
              <DetailedStatsView 
                stats={state.currentStats}
                showDetailed={settings.showDetailedStats}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
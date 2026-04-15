// src/modules/statLogs/utils/enbStatsHandler.ts
import { z } from 'zod';

// Define the expected API response schema
export const EnbStatsSchema = z.object({
  active_ue_count: z.number().default(0),
  cell_id: z.number().default(0),
  connected_ue_count: z.number().default(0),
  pci: z.number().default(0),
  prb_utilization: z.object({
    dl: z.number().default(0),
    ul: z.number().default(0)
  }).default({}),
  rf_status: z.object({
    tx_gain: z.number().default(0),
    rx_gain: z.number().default(0),
    temperature: z.number().default(0),
    tx_power: z.number().default(0),
    rx_power: z.number().default(0)
  }).default({}),
  throughput: z.object({
    dl: z.number().default(0),
    ul: z.number().default(0)
  }).default({}),
  timestamp: z.string().or(z.number()).default(''),
  ue_list: z.array(z.unknown()).default([])
});

export type EnbStats = z.infer<typeof EnbStatsSchema>;

export interface TimeSeriesDataPoint {
  timestamp: number;
  dl_bitrate: number;
  ul_bitrate: number;
  dl_prb: number;
  ul_prb: number;
}

export function parseEnbStats(rawStats: unknown): EnbStats {
  console.log('Parsing raw stats:', rawStats);
  try {
    return EnbStatsSchema.parse(rawStats);
  } catch (error) {
    console.error('Failed to parse ENB stats:', error);
    return EnbStatsSchema.parse({}); // Return default values
  }
}

export function createTimeSeriesDataPoint(stats: EnbStats): TimeSeriesDataPoint {
  const timestamp = typeof stats.timestamp === 'string' 
    ? new Date(stats.timestamp).getTime()
    : stats.timestamp;

  return {
    timestamp,
    dl_bitrate: stats.throughput.dl / 1000000, // Convert to Mbps
    ul_bitrate: stats.throughput.ul / 1000000,
    dl_prb: stats.prb_utilization.dl * 100, // Convert to percentage
    ul_prb: stats.prb_utilization.ul * 100
  };
}

export function validateTimeSeriesData(data: TimeSeriesDataPoint[]): boolean {
  return Array.isArray(data) && 
    data.every(point => (
      typeof point.timestamp === 'number' &&
      typeof point.dl_bitrate === 'number' &&
      typeof point.ul_bitrate === 'number' &&
      typeof point.dl_prb === 'number' &&
      typeof point.ul_prb === 'number'
    ));
}
// Basic stat value with timestamp
export interface TimestampedValue {
  value: number;
  timestamp: Date;
}

// Individual UE statistics
export interface UeStats {
  ue_id: number;
  rnti: number;
  connection_state: string;
  dl_throughput_mbps: number;
  ul_throughput_mbps: number;
  dl_mcs: number;
  ul_mcs: number;
  dl_prb_usage: number;
  ul_prb_usage: number;
  rsrp: number;
  rsrq: number;
  sinr: number;
}

// Radio Resource utilization
export interface RfStats {
  tx_gain: number;
  rx_gain: number;
  temperature: number;
  tx_power: number;
  rx_power: number;
}

// Core stats for ENB
export interface EnbStats {
  timestamp: Date;
  connected_ue_count: number;
  active_ue_count: number;
  cell_id: number;
  pci: number;
  throughput: {
    dl: number;  // in Mbps
    ul: number;  // in Mbps
  };
  prb_utilization: {
    dl: number;  // percentage
    ul: number;  // percentage
  };
  rf_status: RfStats;
  ue_list: UeStats[];
  errors?: {
    message: string;
    code: number;
    timestamp: Date;
  }[];
}

// Configuration for stats collection
export interface EnbStatsConfig {
  pollInterval: number;  // milliseconds
  includeUeDetails: boolean;
  includeRfMetrics: boolean;
  retryAttempts: number;
}

// Stats command options
export interface EnbStatsCommand {
  message: 'stats';
  samples?: boolean;
  rf?: boolean;
  Initial_delay?: number;
  cell_id?: number;
}
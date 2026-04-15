import { EventEmitter } from 'events';
import { WebSocketClient } from '../../lib/utils/websocket';
import { EnbStats, EnbStatsConfig, EnbStatsCommand, UeStats, RfStats } from '../../types/enb.types';
import { COMPONENT_PORTS } from '../../constants/ports';

const DEFAULT_CONFIG: EnbStatsConfig = {
  pollInterval: 5000,
  includeUeDetails: true,
  includeRfMetrics: true,
  retryAttempts: 3
};

export class EnbStatsHandler extends EventEmitter {
  private wsClient: WebSocketClient;
  private pollTimer?: NodeJS.Timer;
  private lastStats?: EnbStats;
  private config: EnbStatsConfig;
  private isPolling: boolean = false;

  constructor(
    private ip: string,
    config: Partial<EnbStatsConfig> = {}
  ) {
    super(); // Initialize EventEmitter
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.wsClient = new WebSocketClient(this.ip, 'ENB', {
      reconnectAttempts: this.config.retryAttempts,
      pingInterval: 30000
    });

    // Setup WebSocket event listeners
    this.wsClient.on('error', (error) => {
      this.emit('error', error);
      this.handleError(error);
    });

    this.wsClient.on('connected', () => {
      this.emit('connected');
    });

    this.wsClient.on('disconnected', () => {
      this.emit('disconnected');
    });
  }

  private getStatsCommand(): EnbStatsCommand {
    return {
      message: 'stats',
      samples: true,
      rf: this.config.includeRfMetrics,
      Initial_delay: 0.7
    };
  }

  private parseUeStats(rawUeData: any): UeStats[] {
    if (!rawUeData || !Array.isArray(rawUeData)) return [];

    return rawUeData.map(ue => ({
      ue_id: ue.id || 0,
      rnti: ue.rnti || 0,
      connection_state: ue.state || 'unknown',
      dl_throughput_mbps: ue.dl_throughput || 0,
      ul_throughput_mbps: ue.ul_throughput || 0,
      dl_mcs: ue.dl_mcs || 0,
      ul_mcs: ue.ul_mcs || 0,
      dl_prb_usage: ue.dl_prb || 0,
      ul_prb_usage: ue.ul_prb || 0,
      rsrp: ue.rsrp || 0,
      rsrq: ue.rsrq || 0,
      sinr: ue.sinr || 0
    }));
  }

  private parseRfStats(rawRfData: any): RfStats {
    return {
      tx_gain: rawRfData?.tx_gain || 0,
      rx_gain: rawRfData?.rx_gain || 0,
      temperature: rawRfData?.temp || 0,
      tx_power: rawRfData?.tx_power || 0,
      rx_power: rawRfData?.rx_power || 0
    };
  }

  private parseStats(rawStats: any): EnbStats {
    const timestamp = new Date();
    
    const stats: EnbStats = {
      timestamp,
      connected_ue_count: rawStats.connected_ue || 0,
      active_ue_count: rawStats.active_ue || 0,
      cell_id: rawStats.cell_id || 0,
      pci: rawStats.pci || 0,
      throughput: {
        dl: rawStats.dl_throughput || 0,
        ul: rawStats.ul_throughput || 0
      },
      prb_utilization: {
        dl: rawStats.dl_prb_utilization || 0,
        ul: rawStats.ul_prb_utilization || 0
      },
      rf_status: this.parseRfStats(rawStats.rf),
      ue_list: this.config.includeUeDetails ? 
        this.parseUeStats(rawStats.ue_list) : []
    };

    // Store for history/comparison
    this.lastStats = stats;
    return stats;
  }

  private handleError(error: Error): void {
    console.error('ENB Stats Handler error:', error);
    this.emit('error', error);
  }

  async startPolling(): Promise<void> {
    if (this.isPolling) return;

    try {
      // Ensure connection
      if (!this.wsClient.getStatus().connected) {
        await this.wsClient.connect();
      }

      this.isPolling = true;
      this.pollTimer = setInterval(async () => {
        try {
          const response = await this.wsClient.sendMessage(this.getStatsCommand());
          const stats = this.parseStats(response);
          this.emit('stats', stats);
        } catch (error) {
          this.handleError(error instanceof Error ? error : new Error(String(error)));
        }
      }, this.config.pollInterval);

      this.emit('polling_started');
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    this.isPolling = false;
    this.emit('polling_stopped');
  }

  async getSnapshot(): Promise<EnbStats> {
    try {
      const response = await this.wsClient.sendMessage(this.getStatsCommand());
      const stats = this.parseStats(response);
      this.emit('snapshot', stats);
      return stats;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  getLastStats(): EnbStats | undefined {
    return this.lastStats;
  }

  isActive(): boolean {
    return this.isPolling;
  }

  async cleanup(): Promise<void> {
    this.stopPolling();
    this.wsClient.disconnect();
    this.emit('cleanup');
    this.removeAllListeners();
  }
}
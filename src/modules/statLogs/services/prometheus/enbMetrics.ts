import { Registry, Gauge } from 'prom-client';
import { EnbStats } from '../../types/enb.types';

export class EnbPrometheusMetrics {
  private registry: Registry;
  private metrics: {
    connectedUes: Gauge<string>;
    activeUes: Gauge<string>;
    dlThroughput: Gauge<string>;
    ulThroughput: Gauge<string>;
    dlPrbUtilization: Gauge<string>;
    ulPrbUtilization: Gauge<string>;
    rfTxPower: Gauge<string>;
    rfRxPower: Gauge<string>;
    rfTemperature: Gauge<string>;
    ueRsrp: Gauge<string>;
    ueSinr: Gauge<string>;
  };

  constructor(private cellId: string) {
    this.registry = new Registry();
    
    // Initialize metrics
    this.metrics = {
      connectedUes: new Gauge({
        name: 'enb_connected_ues_total',
        help: 'Total number of connected UEs',
        labelNames: ['cell_id'],
        registers: [this.registry]
      }),

      activeUes: new Gauge({
        name: 'enb_active_ues_total',
        help: 'Total number of active UEs',
        labelNames: ['cell_id'],
        registers: [this.registry]
      }),

      dlThroughput: new Gauge({
        name: 'enb_dl_throughput_mbps',
        help: 'Downlink throughput in Mbps',
        labelNames: ['cell_id'],
        registers: [this.registry]
      }),

      ulThroughput: new Gauge({
        name: 'enb_ul_throughput_mbps',
        help: 'Uplink throughput in Mbps',
        labelNames: ['cell_id'],
        registers: [this.registry]
      }),

      dlPrbUtilization: new Gauge({
        name: 'enb_dl_prb_utilization_percent',
        help: 'Downlink PRB utilization percentage',
        labelNames: ['cell_id'],
        registers: [this.registry]
      }),

      ulPrbUtilization: new Gauge({
        name: 'enb_ul_prb_utilization_percent',
        help: 'Uplink PRB utilization percentage',
        labelNames: ['cell_id'],
        registers: [this.registry]
      }),

      rfTxPower: new Gauge({
        name: 'enb_rf_tx_power_dbm',
        help: 'RF transmit power in dBm',
        labelNames: ['cell_id'],
        registers: [this.registry]
      }),

      rfRxPower: new Gauge({
        name: 'enb_rf_rx_power_dbm',
        help: 'RF receive power in dBm',
        labelNames: ['cell_id'],
        registers: [this.registry]
      }),

      rfTemperature: new Gauge({
        name: 'enb_rf_temperature_celsius',
        help: 'RF temperature in Celsius',
        labelNames: ['cell_id'],
        registers: [this.registry]
      }),

      ueRsrp: new Gauge({
        name: 'enb_ue_rsrp_dbm',
        help: 'UE RSRP in dBm',
        labelNames: ['cell_id', 'ue_id'],
        registers: [this.registry]
      }),

      ueSinr: new Gauge({
        name: 'enb_ue_sinr_db',
        help: 'UE SINR in dB',
        labelNames: ['cell_id', 'ue_id'],
        registers: [this.registry]
      })
    };
  }

  updateMetrics(stats: EnbStats): void {
    const labels = { cell_id: this.cellId };

    this.metrics.connectedUes.set(labels, stats.connected_ue_count);
    this.metrics.activeUes.set(labels, stats.active_ue_count);
    this.metrics.dlThroughput.set(labels, stats.throughput.dl);
    this.metrics.ulThroughput.set(labels, stats.throughput.ul);
    this.metrics.dlPrbUtilization.set(labels, stats.prb_utilization.dl);
    this.metrics.ulPrbUtilization.set(labels, stats.prb_utilization.ul);
    
    // RF metrics
    this.metrics.rfTxPower.set(labels, stats.rf_status.tx_power);
    this.metrics.rfRxPower.set(labels, stats.rf_status.rx_power);
    this.metrics.rfTemperature.set(labels, stats.rf_status.temperature);

    // UE specific metrics
    stats.ue_list.forEach(ue => {
      const ueLabels = { ...labels, ue_id: ue.ue_id.toString() };
      this.metrics.ueRsrp.set(ueLabels, ue.rsrp);
      this.metrics.ueSinr.set(ueLabels, ue.sinr);
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  resetMetrics(): void {
    Object.values(this.metrics).forEach(metric => metric.reset());
  }
}
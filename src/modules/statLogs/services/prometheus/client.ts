import { Registry, Gauge } from 'prom-client';

export class PrometheusClient {
  private registry: Registry;
  private metrics: Map<string, Gauge>;

  constructor() {
    this.registry = new Registry();
    this.metrics = new Map();
  }

  registerMetric(name: string, help: string, labelNames: string[] = []): Gauge {
    const gauge = new Gauge({
      name,
      help,
      labelNames,
      registers: [this.registry]
    });
    this.metrics.set(name, gauge);
    return gauge;
  }

  setMetricValue(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.set(labels, value);
    }
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

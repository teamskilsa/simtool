// Single-runner queue — one case at a time, FIFO. The same callbox
// + UE-sim pair can't run two test cases concurrently (they'd fight
// over /root/enb/config/enb.cfg, the lte systemd unit, port 9001,
// etc.) so we serialise globally for v1.
//
// Future: per-callbox-pair parallelism via a "system in-use" flag
// on each system in the systems list. Not needed for the first
// QA wave.

type QueuedJob = {
  runId: string;
  fn: () => Promise<void>;
};

class RunnerQueue {
  private q: QueuedJob[] = [];
  private running = false;

  enqueue(runId: string, fn: () => Promise<void>): number {
    this.q.push({ runId, fn });
    this.tickle();
    return this.q.length;
  }

  /** Approximate length — includes the in-flight job if there is one. */
  length(): number {
    return this.q.length + (this.running ? 1 : 0);
  }

  /**
   * Cancel any not-yet-started job for this runId. The currently
   * running job is NOT interrupted — it has its own cancellation
   * mechanism via the run record's `cancelled` status that the
   * runner checks between phases.
   */
  cancel(runId: string): boolean {
    const before = this.q.length;
    this.q = this.q.filter((j) => j.runId !== runId);
    return this.q.length < before;
  }

  private tickle() {
    if (this.running) return;
    const job = this.q.shift();
    if (!job) return;
    this.running = true;
    Promise.resolve(job.fn())
      .catch((e) => {
        // Swallow — the runner is responsible for persisting any
        // failure state into the Run record. A throw out here would
        // stall the queue.
        // eslint-disable-next-line no-console
        console.error(`[qa-queue] job ${job.runId} threw:`, e?.message ?? e);
      })
      .finally(() => {
        this.running = false;
        this.tickle();
      });
  }
}

// Module-level singleton. Next.js dev mode may load this file twice
// (once per route hit) — guard against duplicate queues by stashing
// on globalThis.
declare global {
  // eslint-disable-next-line no-var
  var __qa_queue: RunnerQueue | undefined;
}
export const runnerQueue: RunnerQueue =
  globalThis.__qa_queue ?? (globalThis.__qa_queue = new RunnerQueue());

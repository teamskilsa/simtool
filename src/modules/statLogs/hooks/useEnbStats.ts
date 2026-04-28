// Generic Amarisoft remote-API stats poller. Despite the file name, this hook
// is module-agnostic — eNB (port 9001), gNB (9002), MME (9000), IMS (9003), UE
// (9002) all expose a websocket remote API that responds to the `stats` message
// in the same protocol shape, just with different stat fields.
//
// Caller must pass `ip` AND `port` — there is no default port. The dashboard
// resolves the right port from the module selector + per-system override.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRemoteAPI } from '@/modules/remoteAPI';

export type MonitoringPhase = 'idle' | 'connecting' | 'connected' | 'error';

interface UseAmariStatsOptions {
  pollInterval?: number;
  onStatsUpdate?: (stats: any) => void;
}

/**
 * @param ip   target host (no scheme, no port)
 * @param port remote-API port for the chosen module
 */
export function useEnbStats(
  ip: string,
  port: number,
  options: UseAmariStatsOptions = {},
) {
  const { pollInterval = 1000, onStatsUpdate } = options;

  const remoteAPI = useRemoteAPI({
    server: ip,
    port,
    ssl: false,
  });

  const [phase, setPhase] = useState<MonitoringPhase>('idle');
  const [error, setError] = useState<Error | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout>();

  // Keep a ref to the latest onStatsUpdate so we don't re-create fetchStats
  // every render (which would otherwise cancel the polling interval).
  const onStatsUpdateRef = useRef(onStatsUpdate);
  useEffect(() => { onStatsUpdateRef.current = onStatsUpdate; }, [onStatsUpdate]);

  const fetchStats = useCallback(async () => {
    if (!remoteAPI.connected) return;
    try {
      const response = await remoteAPI.execute('stats', {
        message: 'stats',
        samples: true,
        rf: true,
      });
      onStatsUpdateRef.current?.(response);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to fetch stats');
      setError(e);
      // Don't tear down — keep polling; the next tick may succeed.
    }
  }, [remoteAPI]);

  const startMonitoring = useCallback(async () => {
    setError(null);
    setPhase('connecting');
    try {
      if (!remoteAPI.connected) {
        await remoteAPI.connect();
      }
      setPhase('connected');
      await fetchStats();
      pollIntervalRef.current = setInterval(fetchStats, pollInterval);
    } catch (err) {
      // The websocket-client emits raw browser errors (Event objects). Pull a
      // useful message out of whatever shape it gave us.
      const msg = friendlyWsError(err, ip, port);
      setError(new Error(msg));
      setPhase('error');
    }
  }, [remoteAPI, fetchStats, pollInterval, ip, port]);

  const stopMonitoring = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = undefined;
    }
    remoteAPI.disconnect();
    setPhase('idle');
    setError(null);
  }, [remoteAPI]);

  // When the underlying socket drops (server gone, network blip), reflect that
  // in our phase so the UI can show a "disconnected" banner instead of a stale
  // "connected" status.
  useEffect(() => {
    if (phase === 'connected' && !remoteAPI.connected) {
      setPhase('error');
      if (!error) setError(new Error(`Connection to ${ip}:${port} closed`));
    }
  }, [remoteAPI.connected, phase, ip, port, error]);

  // Cleanup on unmount only.
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  return {
    phase,
    error: error || (remoteAPI.error as Error | null),
    isConnected: remoteAPI.connected,
    startMonitoring,
    stopMonitoring,
  };
}

/**
 * Browser WebSocket errors arrive as opaque Event objects with no message.
 * Translate the most common failure modes into something a user can act on.
 */
function friendlyWsError(err: unknown, host: string, port: number): string {
  if (err instanceof Error && err.message) return err.message;
  // Mixed content (page is https, ws is ws://) — bail with a hint.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return `Cannot reach ws://${host}:${port} from an HTTPS page (mixed content). Serve the app over HTTP or enable WSS on the callbox.`;
  }
  return `Failed to connect to ${host}:${port}. Verify the callbox is up, the remote API is enabled on this port, and the host is reachable from this browser.`;
}
